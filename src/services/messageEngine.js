/**
 * Message Engine
 * محرك توليد وإرسال الرسائل اليومية
 */

import { FamilyModel, GuardianModel, ChildModel, InteractionModel, ScheduledMessageModel } from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { WeatherService } from './weatherService.js';
import { format } from 'date-fns';
import { getDatabase } from '../database/init.js';

const TRACK_METADATA = {
  child_sleep: {
    title: 'نوم الطفل',
    category: 'child',
    tone: 'هادئ ومطمئن',
    focus: 'تعزيز روتين نوم متوازن وتخفيف التوتر قبل النوم',
    keywords: ['نوم', 'روتين', 'تهدئة', 'استرخاء'],
    preferredFormat: 'checklist'
  },
  child_nutrition: {
    title: 'تغذية الطفل',
    category: 'child',
    tone: 'مشجع وعملي',
    focus: 'تنويع الوجبات وتشجيع التجربة الإيجابية',
    keywords: ['تغذية', 'وجبة', 'خضروات', 'بروتين'],
    preferredFormat: 'checklist'
  },
  child_play: {
    title: 'لعب الطفل',
    category: 'child',
    tone: 'مرح ومحفّز',
    focus: 'أنشطة لعب بسيطة تنمّي مهارة محددة',
    keywords: ['لعب', 'نشاط', 'مهارات', 'تنمية'],
    preferredFormat: 'text'
  },
  child_language: {
    title: 'تطوير اللغة',
    category: 'child',
    tone: 'داعم وتفاعلي',
    focus: 'تشجيع الحوار والقراءة المشتركة',
    keywords: ['لغة', 'كلمات', 'تواصل', 'قصة'],
    preferredFormat: 'text'
  },
  parents_mental: {
    title: 'الصحة النفسية للوالدين',
    category: 'parents',
    tone: 'حنون ومطمئن',
    focus: 'تنظيم التنفس وتخفيف الضغط اليومي',
    keywords: ['استرخاء', 'تنفس', 'دعم', 'طاقة'],
    preferredFormat: 'quick_tip'
  },
  weekend_movies: {
    title: 'أفلام نهاية الأسبوع',
    category: 'family',
    tone: 'حيوي ومتحمس',
    focus: 'اختيار أفلام عائلية ممتعة ومناسبة',
    keywords: ['فيلم', 'نهاية الأسبوع', 'ترفيه'],
    preferredFormat: 'checklist'
  },
  weekend_outings: {
    title: 'خروجات عائلية',
    category: 'family',
    tone: 'مغامر وودود',
    focus: 'تخطيط خروجة بسيطة تناسب الطقس والميزانية',
    keywords: ['خروجة', 'نشاط', 'عائلة', 'هواء طلق'],
    preferredFormat: 'checklist'
  },
  weekly_report: {
    title: 'التقرير الأسبوعي',
    category: 'summary',
    tone: 'احترافي وداعم',
    focus: 'تلخيص الإنجازات والتحديات مع هدف الأسبوع القادم',
    keywords: ['تقرير', 'إنجاز', 'هدف', 'مراجعة'],
    preferredFormat: 'text'
  }
};

export class MessageEngine {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
    this.weatherService = new WeatherService(config);
  }

  /**
   * Generate daily messages for all families
   */
  async generateDailyMessages() {
    console.log('🔄 Generating daily messages...');

    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        await this.generateFamilyMessages(family);
      } catch (error) {
        console.error(`Error generating messages for family ${family.id}:`, error);
      }
    }

    console.log('✅ Daily messages generated');
  }

  /**
   * Generate messages for a specific family
   */
  async generateFamilyMessages(family) {
    const guardians = GuardianModel.getByFamily(family.id);
    const children = ChildModel.getByFamily(family.id);

    if (children.length === 0) return;

    const tracks = this.config.tracks?.daily || [
      'child_sleep',
      'child_nutrition',
      'child_play',
      'child_language',
      'parents_mental'
    ];

    // Check if should send to group
    if (family.send_to_group && family.family_group_id) {
      // Send to family group instead of individuals
      const timeSlots = this.getDefaultTimeSlots();
      const tracksPerSlot = this.distributeTracksToTimeSlots(tracks, timeSlots);

      for (const [time, slotTracks] of Object.entries(tracksPerSlot)) {
        for (const track of slotTracks) {
          await this.scheduleGroupMessage(family, children[0], track, time, family.timezone);
        }
      }
    } else {
      // Send to guardians individually
      for (const guardian of guardians) {
        // Get guardian's preferred times
        const timeSlots = this.getTimeSlots(guardian, family.timezone);

        // Distribute tracks across time slots
        const tracksPerSlot = this.distributeTracksToTimeSlots(tracks, timeSlots);

        // Generate and schedule messages
        for (const [time, slotTracks] of Object.entries(tracksPerSlot)) {
          for (const track of slotTracks) {
            await this.scheduleMessage(guardian, children[0], track, time, family.timezone);
          }
        }
      }
    }
  }

  /**
   * Get time slots for a guardian
   */
  getTimeSlots(guardian, timezone) {
    const density = this.config.tracks?.density || {
      morning: 1,
      noon: 1,
      evening: 1
    };

    const baseSlots = {
      morning: '07:30',
      noon: '13:30',
      evening: '19:00'
    };

    // Adjust based on guardian's preferred time
    if (guardian.preferred_time === 'morning') {
      return { morning: baseSlots.morning };
    } else if (guardian.preferred_time === 'noon') {
      return { noon: baseSlots.noon };
    } else if (guardian.preferred_time === 'evening') {
      return { evening: baseSlots.evening };
    }

    // Return all slots if no preference
    return baseSlots;
  }

  /**
   * Distribute tracks to time slots
   */
  distributeTracksToTimeSlots(tracks, timeSlots) {
    const distribution = {};
    const slots = Object.keys(timeSlots);

    tracks.forEach((track, index) => {
      const slotKey = slots[index % slots.length];
      if (!distribution[timeSlots[slotKey]]) {
        distribution[timeSlots[slotKey]] = [];
      }
      distribution[timeSlots[slotKey]].push(track);
    });

    return distribution;
  }

  async buildLLMContext({ guardian, family, child, messageType, timeOfDay, additionalContext }) {
    const memoryLimit = this.config.ai?.memory?.max_messages || 50;
    const childAge = this.calculateAge(child.birth_date);

    let previousInteractions = [];
    if (guardian) {
      previousInteractions = InteractionModel.getByGuardian(guardian.id, memoryLimit);
    } else if (family) {
      previousInteractions = InteractionModel.getByFamily(family.id, memoryLimit);
    }

    const activeIssues = this.getActiveIssuesForFamily(family?.id);
    const trackMetadata = this.getTrackMetadata(messageType);
    const preferredFormat = this.selectPreferredFormat(trackMetadata);
    const knowledgeHints = this.buildKnowledgeHints({
      trackMetadata,
      child,
      guardian,
      family,
      additionalContext,
      activeIssues
    });

    return {
      messageType,
      guardianName: guardian ? guardian.name : family?.family_name,
      childName: child.name,
      childAge,
      timeOfDay,
      additionalContext,
      previousInteractions,
      activeIssues,
      trackMetadata,
      preferredFormat,
      configFormats: this.config.tracks?.formats || [],
      knowledgeHints
    };
  }

  getTrackMetadata(messageType) {
    return TRACK_METADATA[messageType] || {
      title: 'رسالة مخصصة',
      category: 'general',
      tone: 'ودود وداعم',
      focus: 'تقديم دعم عائلي مخصص',
      keywords: [],
      preferredFormat: 'text'
    };
  }

  selectPreferredFormat(trackMetadata = {}) {
    if (trackMetadata.preferredFormat) {
      return trackMetadata.preferredFormat;
    }

    const formats = this.config.tracks?.formats;
    if (Array.isArray(formats) && formats.length > 0) {
      return formats[0];
    }

    return 'text';
  }

  getActiveIssuesForFamily(familyId) {
    if (!familyId) return [];

    let db;
    try {
      db = getDatabase();
      const rows = db.prepare(`
        SELECT
          i.id,
          i.issue_type,
          i.issue_title,
          i.status,
          i.severity,
          i.treatment_plan,
          i.progress_percentage,
          c.name AS child_name
        FROM child_issues i
        INNER JOIN children c ON c.id = i.child_id
        WHERE i.family_id = ? AND i.status IN ('active', 'monitoring')
        ORDER BY i.updated_at DESC
        LIMIT 10
      `).all(familyId);
      return rows;
    } catch (error) {
      console.warn('MessageEngine: failed to load active child issues:', error.message);
      return [];
    } finally {
      if (db) {
        try {
          db.close();
        } catch (closeError) {
          console.warn('MessageEngine: failed to close database connection:', closeError.message);
        }
      }
    }
  }

  buildKnowledgeHints({ trackMetadata, child, guardian, family, additionalContext, activeIssues }) {
    const hints = new Set();

    if (trackMetadata?.focus) hints.add(trackMetadata.focus);
    if (trackMetadata?.category) hints.add(trackMetadata.category);
    if (child?.name) hints.add(child.name);
    if (child?.development_stage) hints.add(child.development_stage);
    if (guardian?.role) hints.add(guardian.role === 'father' ? 'الأب' : 'الأم');
    if (family?.family_name) hints.add(`عائلة ${family.family_name}`);

    if (additionalContext) {
      additionalContext
        .toString()
        .split(/[^\w\u0621-\u064A]+/)
        .filter(Boolean)
        .slice(0, 5)
        .forEach((word) => hints.add(word));
    }

    if (Array.isArray(activeIssues)) {
      activeIssues.forEach((issue) => {
        if (issue.issue_type) hints.add(issue.issue_type);
        if (issue.child_name) hints.add(issue.child_name);
      });
    }

    return Array.from(hints).filter(Boolean).slice(0, 10);
  }

  /**
   * Schedule a single message
   */
  async scheduleMessage(guardian, child, messageType, time, timezone) {
    const timeOfDay = this.getTimeOfDay(time);

    const family = FamilyModel.getById(guardian.family_id);
    if (!family) {
      console.warn(`MessageEngine: family not found for guardian ${guardian.id}`);
      return;
    }

    const context = await this.buildLLMContext({
      guardian,
      family,
      child,
      messageType,
      timeOfDay,
      additionalContext: null
    });

    const messageContent = await this.llm.generateMessage(context);

    // Get buttons from config
    const buttons = this.config.ui?.buttons || [
      'تم ✅',
      'ذكّرني لاحقاً ⏰',
      'بدّل التوقيت 🔄',
      'تخطي ⏭️'
    ];

    // Calculate scheduled time (today at specified time)
    const now = new Date();
    const [hours, minutes] = time.split(':');
    const scheduledTime = new Date(now);
    scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    // Check quiet hours
    if (this.isQuietHour(scheduledTime)) {
      console.log(`Skipping message for ${guardian.name} - quiet hours`);
      return;
    }

    // Save to database
    ScheduledMessageModel.create(
      guardian.family_id,
      guardian.id,
      messageType,
      messageContent,
      format(scheduledTime, 'yyyy-MM-dd HH:mm:ss'),
      buttons
    );

    console.log(`✅ Scheduled ${messageType} for ${guardian.name} at ${time}`);
  }

  /**
   * Send pending scheduled messages
   */
  async sendPendingMessages() {
    const currentTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const pendingMessages = ScheduledMessageModel.getPending(currentTime);

    console.log(`📨 Found ${pendingMessages.length} pending messages`);

    for (const message of pendingMessages) {
      try {
        const guardian = GuardianModel.getById(message.guardian_id);
        if (!guardian) continue;

        const family = FamilyModel.getById(guardian.family_id);
        if (!family) continue;

        // Send message with buttons
        const buttons = message.buttons ? JSON.parse(message.buttons) : [];

        // Check if should send to group or individual
        if (family.send_to_group && family.family_group_id) {
          // Send to family group
          await this.bot.sendMessageWithButtons(
            family.family_group_id,
            message.message_content,
            buttons
          );
          console.log(`✅ Sent ${message.message_type} to group ${family.family_name}`);
        } else {
          // Send to individual guardian
          await this.bot.sendMessageWithButtons(
            guardian.phone_number,
            message.message_content,
            buttons
          );
          console.log(`✅ Sent ${message.message_type} to ${guardian.name}`);
        }

        // Mark as sent
        ScheduledMessageModel.markAsSent(message.id);

        // Wait a bit to avoid rate limiting
        await this.sleep(1000);

      } catch (error) {
        console.error(`Error sending message ${message.id}:`, error);
      }
    }
  }

  /**
   * Calculate child age in years
   */
  calculateAge(birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();

    if (years === 0) {
      return `${months} شهر`;
    } else if (years === 1) {
      return 'سنة واحدة';
    } else if (years === 2) {
      return 'سنتان';
    } else {
      return `${years} سنوات`;
    }
  }

  /**
   * Get time of day label
   */
  getTimeOfDay(time) {
    const [hours] = time.split(':');
    const hour = parseInt(hours);

    if (hour >= 6 && hour < 12) return 'الصباح';
    if (hour >= 12 && hour < 17) return 'الظهر';
    if (hour >= 17 && hour < 22) return 'المساء';
    return 'الليل';
  }

  /**
   * Check if current time is in quiet hours
   */
  isQuietHour(time) {
    const quietHours = this.config.app?.quiet_hours;
    if (!quietHours) return false;

    const hour = time.getHours();
    const minute = time.getMinutes();
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = quietHours.start.split(':');
    const [endH, endM] = quietHours.end.split(':');

    const startMinutes = parseInt(startH) * 60 + parseInt(startM);
    const endMinutes = parseInt(endH) * 60 + parseInt(endM);

    // Handle cases where quiet hours span midnight
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate instant message (on-demand)
   */
  async generateInstantMessage(guardian, child, messageType) {
    const now = new Date();
    const timeOfDay = this.getTimeOfDay(format(now, 'HH:mm'));

    const family = FamilyModel.getById(guardian.family_id);
    if (!family) {
      console.warn(`MessageEngine: family not found for guardian ${guardian.id}`);
      return;
    }

    const context = await this.buildLLMContext({
      guardian,
      family,
      child,
      messageType,
      timeOfDay,
      additionalContext: null
    });

    const messageContent = await this.llm.generateMessage(context);
    const buttons = this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰'];

    // For testing: if no phone number, just print the message
    if (!guardian.phone_number) {
      console.log('\n' + '='.repeat(70));
      console.log(`📱 رسالة لـ: ${guardian.name}`);
      console.log(`👶 حول: ${child.name}`);
      console.log(`📝 النوع: ${messageType}`);
      console.log('='.repeat(70));
      console.log(messageContent);
      console.log('\n🔘 الأزرار:');
      buttons.forEach((btn, i) => console.log(`   ${i + 1}. ${btn}`));
      console.log('='.repeat(70) + '\n');
    } else {
      await this.bot.sendMessageWithButtons(
        guardian.phone_number,
        messageContent,
        buttons
      );
    }

    console.log(`✅ Generated instant ${messageType} for ${guardian.name}`);
  }

  /**
   * Get default time slots
   */
  getDefaultTimeSlots() {
    return {
      morning: '07:30',
      noon: '13:30',
      evening: '19:00'
    };
  }

  /**
   * Schedule a message for family group
   */
  async scheduleGroupMessage(family, child, messageType, time, timezone) {
    const timeOfDay = this.getTimeOfDay(time);

    // Get weather info
    const cityName = this.getCityFromTimezone(timezone);
    const weather = await this.weatherService.getWeather(cityName);

    // Add weather context for outdoor activities
    let weatherContext = null;
    if (messageType === 'child_play') {
      const activity = this.weatherService.getActivitySuggestion(weather);
      weatherContext = `الطقس: ${weather.temp}°م - ${activity.suggestion}`;
    }

    const context = await this.buildLLMContext({
      guardian: null,
      family,
      child,
      messageType,
      timeOfDay,
      additionalContext: weatherContext
    });

    let messageContent = await this.llm.generateMessage(context);

    // Add weather info if relevant
    if (messageType === 'child_play' && weatherContext) {
      messageContent = `${weather.icon} ${messageContent}\n\n${weatherContext}`;
    }

    // Get buttons from config
    const buttons = this.config.ui?.buttons || [
      'تم ✅',
      'ذكّرني لاحقاً ⏰',
      'بدّل التوقيت 🔄',
      'تخطي ⏭️'
    ];

    // Calculate scheduled time (today at specified time)
    const now = new Date();
    const [hours, minutes] = time.split(':');
    const scheduledTime = new Date(now);
    scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    // Check quiet hours
    if (this.isQuietHour(scheduledTime)) {
      console.log(`Skipping group message for ${family.family_name} - quiet hours`);
      return;
    }

    // Save to database (using first guardian as reference)
    const guardians = GuardianModel.getByFamily(family.id);
    if (guardians.length > 0) {
      ScheduledMessageModel.create(
        family.id,
        guardians[0].id, // Reference guardian
        messageType,
        messageContent,
        format(scheduledTime, 'yyyy-MM-dd HH:mm:ss'),
        buttons
      );

      console.log(`✅ Scheduled ${messageType} for group ${family.family_name} at ${time}`);
    }
  }

  /**
   * Get city name from timezone
   */
  getCityFromTimezone(timezone) {
    const cityMap = {
      'Africa/Cairo': 'Cairo',
      'Asia/Riyadh': 'Riyadh',
      'Asia/Dubai': 'Dubai',
      'Asia/Kuwait': 'Kuwait',
      'Asia/Beirut': 'Beirut',
      'Africa/Casablanca': 'Casablanca'
    };

    return cityMap[timezone] || 'Cairo';
  }
}

export default MessageEngine;
