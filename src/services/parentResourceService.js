/**
 * Parent Resource Service
 * ترشيحات الكتب والدورات للوالدين
 */

import { differenceInCalendarDays } from 'date-fns';
import { FamilyModel, GuardianModel, ChildModel, ParentResourceLogModel } from '../database/models.js';
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

  async sendBookRecommendation(family, child, booksConfig, gapTarget) {
    const topics = (booksConfig.topics || []).join(', ');

    const context = {
      messageType: 'parent_book',
      guardianName: family.family_name,
      childName: child.name,
      childAge: this.calculateAge(child.birth_date),
      timeOfDay: 'الصباح',
      additionalContext: topics ? `ركّز على مواضيع: ${topics}` : '',
      trackMetadata: {
        title: 'كتاب الوالدين',
        category: 'parents_learning',
        tone: 'ملهم وعملي',
        focus: 'كتاب واحد عميق يساعد الأسرة في الأسبوعين القادمين'
      }
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
    const context = {
      messageType: 'parent_course',
      guardianName: guardian.name,
      childName: child.name,
      childAge: this.calculateAge(child.birth_date),
      timeOfDay: 'المساء',
      additionalContext: topicLine
        ? `الدور: ${roleLabel} | المواضيع المفضلة: ${topicLine}`
        : `الدور: ${roleLabel}`,
      trackMetadata: {
        title: 'كورس أسبوعي',
        category: 'parents_learning',
        tone: 'تشجيعي وسريع',
        focus: 'درس مصغر لا يتجاوز 60 دقيقة للأب أو الأم'
      }
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

  extractTitle(message = '') {
    const boldMatch = message.match(/\*\*(.+?)\*\*/);
    if (boldMatch) return boldMatch[1];
    return message.split('\n')[0]?.replace(/[*_]/g, '').trim().slice(0, 80) || 'resource';
  }

  randomBetween(min, max) {
    const minSafe = Math.max(1, Math.floor(min));
    const maxSafe = Math.max(minSafe, Math.floor(max));
    return Math.floor(Math.random() * (maxSafe - minSafe + 1)) + minSafe;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ParentResourceService;
