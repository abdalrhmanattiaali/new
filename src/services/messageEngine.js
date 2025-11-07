/**
 * Message Engine
 * محرك توليد وإرسال الرسائل اليومية
 */

import { FamilyModel, GuardianModel, ChildModel, ScheduledMessageModel } from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { format, addHours } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export class MessageEngine {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
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

  /**
   * Schedule a single message
   */
  async scheduleMessage(guardian, child, messageType, time, timezone) {
    const childAge = this.calculateAge(child.birth_date);
    const timeOfDay = this.getTimeOfDay(time);

    // Generate message using LLM
    const context = {
      messageType,
      guardianName: guardian.name,
      childName: child.name,
      childAge,
      timeOfDay,
      additionalContext: null
    };

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

        // Send message with buttons
        const buttons = message.buttons ? JSON.parse(message.buttons) : [];
        await this.bot.sendMessageWithButtons(
          guardian.phone_number,
          message.message_content,
          buttons
        );

        // Mark as sent
        ScheduledMessageModel.markAsSent(message.id);

        console.log(`✅ Sent ${message.message_type} to ${guardian.name}`);

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
    const childAge = this.calculateAge(child.birth_date);
    const now = new Date();
    const timeOfDay = this.getTimeOfDay(format(now, 'HH:mm'));

    const context = {
      messageType,
      guardianName: guardian.name,
      childName: child.name,
      childAge,
      timeOfDay,
      additionalContext: null
    };

    const messageContent = await this.llm.generateMessage(context);
    const buttons = this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰'];

    await this.bot.sendMessageWithButtons(
      guardian.phone_number,
      messageContent,
      buttons
    );

    console.log(`✅ Sent instant ${messageType} to ${guardian.name}`);
  }
}

export default MessageEngine;
