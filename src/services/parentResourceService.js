/**
 * Parent Resource Service
 * ترشيحات الكتب والدورات للوالدين
 */

import { differenceInCalendarDays } from 'date-fns';
import {
  FamilyModel,
  GuardianModel,
  ChildModel,
  ParentResourceLogModel,
  CoupleFeedbackModel,
  InteractionModel
} from '../database/models.js';
import { LLMService } from '../ai/llm.js';

export class ParentResourceService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
  }

  async sendBookRecommendationsIfDue() {
    if (this.config.parent_resources?.enabled === false) return;

    const families = FamilyModel.getAll();
    const booksConfig = this.config.parent_resources?.books || {};
    const minGap = booksConfig.min_gap_days ?? 14;
    const maxGap = booksConfig.max_gap_days ?? 21;

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      const child = this.getPrimaryChild(family.id);
      if (!child) continue;

      const lastLog = ParentResourceLogModel.getLastSent(family.id, 'book');
      const today = new Date();
      const targetGap = lastLog?.metadata?.gap_target_days || this.randomBetween(minGap, maxGap);

      if (lastLog) {
        const lastDate = new Date(lastLog.sent_at);
        const daysSince = differenceInCalendarDays(today, lastDate);
        if (daysSince < targetGap) {
          continue;
        }
      }

      await this.sendBookRecommendation(family, child, booksConfig, targetGap);
      await this.sleep(800);
    }
  }

  async sendWeeklyCourseRecommendations() {
    if (this.config.parent_resources?.enabled === false) return;

    const courseConfig = this.config.parent_resources?.courses || {};
    const minGap = courseConfig.min_gap_days ?? 7;
    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      const child = this.getPrimaryChild(family.id);
      if (!child) continue;

      const guardians = GuardianModel.getByFamily(family.id) || [];
      for (const guardian of guardians) {
        if (!guardian.notification_enabled) continue;
        if (!guardian.phone_number && !family.family_group_id) continue;

        const roleKey = guardian.role === 'father' ? 'course_father' : guardian.role === 'mother' ? 'course_mother' : 'course_parent';
        const lastLog = ParentResourceLogModel.getLastSent(family.id, roleKey);
        if (lastLog) {
          const daysSince = differenceInCalendarDays(new Date(), new Date(lastLog.sent_at));
          if (daysSince < minGap) {
            continue;
          }
        }

        await this.sendCourseRecommendation(family, guardian, child, courseConfig);
        await this.sleep(600);
      }
    }
  }

  async sendVideoRecommendationsIfDue() {
    if (this.config.parent_resources?.enabled === false) return;

    const videosConfig = this.config.parent_resources?.videos || {};
    if (videosConfig.enabled === false) return;

    const minGap = videosConfig.min_gap_days ?? 3;
    const maxGap = videosConfig.max_gap_days ?? 5;
    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      const child = this.getPrimaryChild(family.id);
      if (!child) continue;

      const lastLog = ParentResourceLogModel.getLastSent(family.id, 'video');
      const gapTarget = lastLog?.metadata?.gap_target_days || this.randomBetween(minGap, maxGap);

      if (lastLog) {
        const daysSince = differenceInCalendarDays(new Date(), new Date(lastLog.sent_at));
        if (daysSince < gapTarget) {
          continue;
        }
      }

      await this.sendVideoRecommendation(family, child, videosConfig, gapTarget);
      await this.sleep(600);
    }
  }

  async sendEducationHubIfDue() {
    if (this.config.parent_resources?.enabled === false) return;
    const hubConfig = this.config.parent_resources?.education_hub || {};
    if (hubConfig.enabled === false) return;

    const minGap = hubConfig.min_gap_days ?? 4;
    const maxGap = hubConfig.max_gap_days ?? 6;
    const allowedDomains = hubConfig.allowed_domains || ['youtube.com', 'youtu.be', 'facebook.com', 'fb.watch'];
    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;
      const child = this.getPrimaryChild(family.id);
      if (!child) continue;

      const lastLog = ParentResourceLogModel.getLastSent(family.id, 'education_bundle');
      const targetGap = lastLog?.metadata?.gap_target_days || this.randomBetween(minGap, maxGap);

      if (lastLog) {
        const daysSince = differenceInCalendarDays(new Date(), new Date(lastLog.sent_at));
        if (daysSince < targetGap) {
          continue;
        }
      }

      await this.sendEducationBundle(family, child, hubConfig, allowedDomains, targetGap);
      await this.sleep(800);
    }
  }

  async sendBookRecommendation(family, child, booksConfig, gapTarget) {
    const topics = (booksConfig.topics || []).join(', ');

    const notificationStats = InteractionModel.getFamilyNotificationStats(family.id, 'parent_book', 120);
    const childDay = this.calculateDayOfLife(child.birth_date);

    const context = {
      messageType: 'parent_book',
      guardianName: family.family_name,
      childName: child.name,
      childAge: this.calculateAge(child.birth_date),
      childDay,
      timeOfDay: 'الصباح',
      additionalContext: topics ? `ركّز على مواضيع: ${topics}` : '',
      trackMetadata: {
        title: 'كتاب الوالدين',
        category: 'parents_learning',
        tone: 'ملهم وعملي',
        focus: 'كتاب واحد عميق يساعد الأسرة في الأسبوعين القادمين'
      },
      relationshipInsights: this.getRelationshipInsights(family.id),
      notificationStats,
      familyId: family.id
    };

    let message;
    try {
      message = await this.llm.generateMessage(context);
    } catch (error) {
      console.error('Error generating book recommendation:', error);
      message = '📚 *ترشيح كتاب*: جرّبوا كتاب "الأبوان الواعيان"، 20 دقيقة يومياً ستصنع فرقاً كبيراً.';
    }

    await this.dispatchToFamily(family, message, booksConfig.buttons);
    ParentResourceLogModel.log(family.id, 'book', this.extractTitle(message), {
      gap_target_days: gapTarget,
      topics: booksConfig.topics || []
    });
  }

  async sendCourseRecommendation(family, guardian, child, courseConfig) {
    const sharedTopics = courseConfig.topics?.shared || [];
    const roleTopics = guardian.role === 'father' ? courseConfig.topics?.father : courseConfig.topics?.mother;
    const topicLine = [...(roleTopics || []), ...sharedTopics].join(', ');

    const roleLabel = guardian.role === 'father' ? 'الأب' : guardian.role === 'mother' ? 'الأم' : 'الوالد';
    const notificationStats = InteractionModel.getFamilyNotificationStats(family.id, 'parent_course', 90);
    const childDay = this.calculateDayOfLife(child.birth_date);

    const context = {
      messageType: 'parent_course',
      guardianName: guardian.name,
      childName: child.name,
      childAge: this.calculateAge(child.birth_date),
      childDay,
      timeOfDay: 'المساء',
      additionalContext: topicLine
        ? `الدور: ${roleLabel} | المواضيع المفضلة: ${topicLine}`
        : `الدور: ${roleLabel}`,
      trackMetadata: {
        title: 'كورس أسبوعي',
        category: 'parents_learning',
        tone: 'تشجيعي وسريع',
        focus: 'درس مصغر لا يتجاوز 60 دقيقة للأب أو الأم'
      },
      relationshipInsights: this.getRelationshipInsights(family.id),
      notificationStats,
      familyId: family.id
    };

    let message;
    try {
      message = await this.llm.generateMessage(context);
    } catch (error) {
      console.error('Error generating course recommendation:', error);
      message = '🎓 *كورس مصغر*: شاهد فيديو "تنظيم مشاعر الوالدين" (15 دقيقة) هذا الأسبوع وشارك شريكك أبرز نقطة.';
    }

    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessageToGroup(family.family_group_id, message);
    } else if (guardian.phone_number) {
      await this.bot.sendMessage(guardian.phone_number, message);
    }

    const logType = guardian.role === 'father' ? 'course_father' : guardian.role === 'mother' ? 'course_mother' : 'course_parent';
    ParentResourceLogModel.log(family.id, logType, this.extractTitle(message), {
      guardian_id: guardian.id,
      role: guardian.role
    });
  }

  async sendVideoRecommendation(family, child, videosConfig, gapTarget) {
    const allowedDomains = videosConfig.allowed_domains || ['youtube.com', 'youtu.be', 'facebook.com', 'fb.watch'];
    const guardians = GuardianModel.getByFamily(family.id) || [];
    const notificationStats = InteractionModel.getFamilyNotificationStats(family.id, 'parent_video', 45);
    const childDay = this.calculateDayOfLife(child.birth_date);

    const context = {
      messageType: 'parent_video',
      guardianName: family.family_name,
      childName: child.name,
      childAge: this.calculateAge(child.birth_date),
      childDay,
      timeOfDay: 'المساء',
      additionalContext: `روابط مسموحة فقط من: ${allowedDomains.join(', ')}`,
      trackMetadata: {
        title: 'فيديو اليوم',
        category: 'parents_learning',
        tone: 'خفيف وتفاعلي',
        focus: 'فيديو ممتع أو مريح أو تعليمي يمكن مشاهدته اليوم'
      },
      relationshipInsights: this.getRelationshipInsights(family.id),
      notificationStats,
      familyId: family.id
    };

    let message;
    try {
      message = await this.llm.generateMessage(context);
    } catch (error) {
      console.error('Error generating video recommendation:', error);
      message = '🎥 فيديو اليوم: استمتعوا بمشاهدة حلقة خفيفة عن التواصل الهادئ مع الطفل. رابط سريع: https://www.youtube.com/watch?v=ah4bUxlN-6M';
    }

    const link = this.extractAllowedLink(message, allowedDomains);
    let finalMessage = message;
    const fallbackLink = this.chooseFallbackLink(videosConfig);
    const usedFallback = !link && fallbackLink;

    if (usedFallback) {
      finalMessage = `${message}\n\n🔗 رابط موثوق: ${fallbackLink}`;
    }

    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessageToGroup(family.family_group_id, finalMessage);
      InteractionModel.create(family.id, null, 'parent_video', finalMessage, null);
    } else {
      for (const guardian of guardians) {
        if (!guardian.notification_enabled || !guardian.phone_number) continue;
        if (videosConfig.buttons?.length) {
          await this.bot.sendMessageWithButtons(guardian.phone_number, finalMessage, videosConfig.buttons);
        } else {
          await this.bot.sendMessage(guardian.phone_number, finalMessage);
        }
        InteractionModel.create(family.id, guardian.id, 'parent_video', finalMessage, null);
      }
    }

    ParentResourceLogModel.log(family.id, 'video', this.extractTitle(finalMessage), {
      gap_target_days: gapTarget,
      allowed_domains: allowedDomains,
      fallback_used: Boolean(usedFallback)
    });
  }

  async sendEducationBundle(family, child, hubConfig, allowedDomains, gapTarget) {
    const guardians = GuardianModel.getByFamily(family.id) || [];
    const notificationStats = InteractionModel.getFamilyNotificationStats(family.id, 'parent_education_hub', 90);
    const childDay = this.calculateDayOfLife(child.birth_date);
    const recentResources = this.buildResourceHistorySummary(family.id);

    const context = {
      messageType: 'parent_education_hub',
      guardianName: family.family_name,
      childName: child.name,
      childAge: this.calculateAge(child.birth_date),
      childDay,
      timeOfDay: 'المساء',
      additionalContext: [
        hubConfig.categories?.length ? `المسارات: ${hubConfig.categories.join(' | ')}` : null,
        allowedDomains?.length ? `النطاقات المسموحة للروابط: ${allowedDomains.join(', ')}` : null,
        recentResources ? `آخر الموارد المرسلة:\n${recentResources}` : null
      ]
        .filter(Boolean)
        .join('\n'),
      trackMetadata: {
        title: 'حزمة تعلّم الوالدين',
        category: 'parents_learning',
        tone: 'مهني دافئ',
        focus: 'حزمة يومية تجمع كتاباً/كورساً/فيديوهات خبراء وتمارين ذهنية'
      },
      relationshipInsights: this.getRelationshipInsights(family.id),
      notificationStats,
      familyId: family.id
    };

    let message;
    try {
      message = await this.llm.generateMessage(context);
    } catch (error) {
      console.error('Error generating education hub bundle:', error);
      message = '📚 حزمة تعلّم اليوم: ملخص كتاب أبوة عملي + كورس 40 دقيقة عن تهدئة الطفل + فيديو يوغا تنفس (https://www.youtube.com/watch?v=5w4rUrwRj8s).';
    }

    const allowedLink = this.extractAllowedLink(message, allowedDomains);
    const fallbackLink = this.chooseFallbackLink(hubConfig);
    const needsFallback = !allowedLink && Boolean(fallbackLink);
    const finalMessage = needsFallback ? `${message}\n\n🔗 رابط موثوق: ${fallbackLink}` : message;

    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessageToGroup(family.family_group_id, finalMessage);
      InteractionModel.create(family.id, null, 'parent_education_hub', finalMessage, null);
    } else {
      for (const guardian of guardians) {
        if (!guardian.notification_enabled || !guardian.phone_number) continue;
        if (hubConfig.buttons?.length) {
          await this.bot.sendMessageWithButtons(guardian.phone_number, finalMessage, hubConfig.buttons);
        } else {
          await this.bot.sendMessage(guardian.phone_number, finalMessage);
        }
        InteractionModel.create(family.id, guardian.id, 'parent_education_hub', finalMessage, null);
      }
    }

    ParentResourceLogModel.log(family.id, 'education_bundle', this.extractTitle(finalMessage), {
      gap_target_days: gapTarget,
      categories: hubConfig.categories || [],
      allowed_domains: allowedDomains,
      fallback_used: needsFallback
    });
  }

  async dispatchToFamily(family, message, buttons = []) {
    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessageToGroup(family.family_group_id, message);
      return;
    }

    const guardians = GuardianModel.getByFamily(family.id) || [];
    for (const guardian of guardians) {
      if (!guardian.notification_enabled || !guardian.phone_number) continue;
      if (buttons?.length) {
        await this.bot.sendMessageWithButtons(guardian.phone_number, message, buttons);
      } else {
        await this.bot.sendMessage(guardian.phone_number, message);
      }
    }
  }

  getPrimaryChild(familyId) {
    const children = ChildModel.getByFamily(familyId);
    return children?.[0] || null;
  }

  calculateAge(birthDate) {
    if (!birthDate) return 'طفل';
    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 12) return `${months} شهر`;
    const years = Math.floor(months / 12);
    return years <= 1 ? 'سنة' : `${years} سنوات`;
  }

  calculateDayOfLife(birthDate) {
    if (!birthDate) return null;
    try {
      const days = differenceInCalendarDays(new Date(), new Date(birthDate));
      return days + 1;
    } catch (error) {
      return null;
    }
  }

  extractTitle(message = '') {
    const boldMatch = message.match(/\*\*(.+?)\*\*/);
    if (boldMatch) return boldMatch[1];
    return message.split('\n')[0]?.replace(/[*_]/g, '').trim().slice(0, 80) || 'resource';
  }

  extractAllowedLink(message = '', allowedDomains = []) {
    if (!message) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let match;
    while ((match = urlRegex.exec(message)) !== null) {
      try {
        const url = new URL(match[0]);
        const host = url.hostname.toLowerCase();
        const valid = allowedDomains.some((domain) => host.includes(domain.toLowerCase()));
        if (valid) return url.toString();
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  chooseFallbackLink(videosConfig = {}) {
    const links = videosConfig.fallback_links || [];
    if (!links.length) return null;
    const index = Math.floor(Math.random() * links.length);
    return links[index];
  }

  buildResourceHistorySummary(familyId) {
    const recent = ParentResourceLogModel.getRecent(familyId, null, 6);
    if (!recent.length) return '';

    return recent
      .map((item) => {
        const label = item.resource_type || 'resource';
        const title = item.title || 'بدون عنوان';
        const date = item.sent_at ? new Date(item.sent_at).toISOString().split('T')[0] : '';
        return `- ${label}: ${title}${date ? ` (${date})` : ''}`;
      })
      .join('\n');
  }

  randomBetween(min, max) {
    const minSafe = Math.max(1, Math.floor(min));
    const maxSafe = Math.max(minSafe, Math.floor(max));
    return Math.floor(Math.random() * (maxSafe - minSafe + 1)) + minSafe;
  }

  getRelationshipInsights(familyId) {
    if (!familyId) return [];
    return CoupleFeedbackModel.getRecentByFamily(
      familyId,
      this.config.couple_feedback?.history_window || 6
    );
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ParentResourceService;
