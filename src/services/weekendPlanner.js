/**
 * Weekend Planner Service
 * خدمة تخطيط نهاية الأسبوع
 */

import {
  FamilyModel,
  GuardianModel,
  ChildModel,
  WeekendPlanModel,
  CoupleFeedbackModel,
  InteractionModel
} from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { format, startOfWeek } from 'date-fns';
import { getDatabase } from '../database/init.js';

export class WeekendPlannerService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
  }

  /**
   * Generate weekend plans for all families
   */
  async generateWeekendPlans() {
    console.log('🎬 Generating weekend plans...');

    const families = FamilyModel.getAll();
    const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        // Check if plan already exists for this week
        const existingPlan = WeekendPlanModel.getByWeek(family.id, weekStart);
        if (existingPlan) {
          console.log(`Plan already exists for family ${family.id}`);
          continue;
        }

        await this.generateFamilyWeekendPlan(family, weekStart);
      } catch (error) {
        console.error(`Error generating weekend plan for family ${family.id}:`, error);
      }
    }

    console.log('✅ Weekend plans generated');
  }

  /**
   * Generate weekend plan for a specific family
   */
  async generateFamilyWeekendPlan(family, weekStart) {
    const children = ChildModel.getByFamily(family.id);
    if (children.length === 0) return;

    const child = children[0]; // Primary child for recommendations
    const childAge = this.calculateAge(child.birth_date);

    // Generate movie suggestions
    const movies = await this.generateMovieSuggestions(family, child.name, childAge);

    // Generate outing suggestions
    const outings = await this.generateOutingSuggestions(family, child.name, childAge);

    // Generate checklist
    const checklist = this.generateChecklist();

    // Generate home alternative
    const homeAlternative = await this.generateHomeAlternative(child.name, childAge);

    // Save to database
    WeekendPlanModel.create(
      family.id,
      weekStart,
      movies,
      outings,
      checklist,
      homeAlternative
    );

    console.log(`✅ Weekend plan created for family ${family.id}`);
  }

  /**
   * Send weekend plans to families
   */
  async sendWeekendPlans() {
    console.log('📨 Sending weekend plans...');

    const families = FamilyModel.getAll();
    const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        const plan = WeekendPlanModel.getByWeek(family.id, weekStart);
        if (!plan || plan.sent) continue;

        await this.sendFamilyWeekendPlan(family, plan);
        WeekendPlanModel.markAsSent(plan.id);

      } catch (error) {
        console.error(`Error sending weekend plan for family ${family.id}:`, error);
      }
    }

    console.log('✅ Weekend plans sent');
  }

  /**
   * Send weekend plan to a family
   */
  async sendFamilyWeekendPlan(family, plan) {
    const guardians = GuardianModel.getByFamily(family.id);
    if (guardians.length === 0) return;

    const movies = this.safeJsonParse(plan.movies, []);
    const outings = this.safeJsonParse(plan.outings, []);
    const checklist = this.safeJsonParse(plan.checklist, []);
    const homeAlternative = this.safeJsonParse(plan.home_alternative, { activities: [] });

    const issues = this.getActiveIssuesSummary(family.id);
    const message = this.formatWeekendMessage(movies, outings, checklist, homeAlternative, issues);

    // Send to all guardians
    for (const guardian of guardians) {
      try {
        await this.bot.sendMessage(guardian.phone_number, message);
        console.log(`✅ Weekend plan sent to ${guardian.name}`);
        await this.sleep(1000);
      } catch (error) {
        console.error(`Error sending to ${guardian.name}:`, error);
      }
    }
  }

  /**
   * Generate movie suggestions
   */
  async generateMovieSuggestions(family, childName, childAge) {
    const config = this.config.weekend?.movies;
    if (!config?.enabled) return [];

    const context = {
      messageType: 'weekend_movies',
      childName,
      childAge,
      guardianName: 'العائلة',
      timeOfDay: 'المساء',
      additionalContext: `التقييم: ${config.age_rating_max || 'PG'}, اللغة: ${config.language_pref || 'ar_en_dubbed'}`,
      relationshipInsights: this.getRelationshipInsights(family?.id),
      notificationStats: family?.id
        ? InteractionModel.getFamilyNotificationStats(family.id, 'weekend_movies', 60)
        : null,
      familyId: family?.id
    };

    try {
      const suggestions = await this.llm.generateMessage(context);
      const parsed = this.parseStructuredList(suggestions, config.count || 2, 'movie');
      if (parsed.length) return parsed;
      return this.getDefaultMovies();
    } catch (error) {
      console.error('Error generating movie suggestions:', error);
      return this.getDefaultMovies();
    }
  }

  /**
   * Generate outing suggestions
   */
  async generateOutingSuggestions(family, childName, childAge) {
    const config = this.config.weekend?.outings;
    if (!config?.enabled) return [];

    const context = {
      messageType: 'weekend_outings',
      childName,
      childAge,
      guardianName: 'العائلة',
      timeOfDay: 'النهار',
      additionalContext: `الميزانية: ${config.budget || 'متوسطة'}, المدة: ${config.duration_hours || 2} ساعات`,
      relationshipInsights: this.getRelationshipInsights(family?.id),
      notificationStats: family?.id
        ? InteractionModel.getFamilyNotificationStats(family.id, 'weekend_outings', 60)
        : null,
      familyId: family?.id
    };

    try {
      const suggestions = await this.llm.generateMessage(context);
      const parsed = this.parseStructuredList(suggestions, 2, 'outing');
      if (parsed.length) return parsed;
      return this.getDefaultOutings();
    } catch (error) {
      console.error('Error generating outing suggestions:', error);
      return this.getDefaultOutings();
    }
  }

  /**
   * Generate checklist
   */
  generateChecklist() {
    const defaultChecklist = this.config.weekend?.checklist?.items || [
      'حقيبة الطفل',
      'وجبات خفيفة',
      'مياه',
      'مناديل',
      'ألعاب صغيرة',
      'إسعافات أولية'
    ];

    return defaultChecklist.map(item => ({
      item,
      checked: false
    }));
  }

  /**
   * Generate home alternative
   */
  async generateHomeAlternative(childName, childAge) {
    return {
      title: 'أنشطة منزلية ممتعة',
      activities: [
        'طبخ معاً (بيتزا منزلية أو كوكيز)',
        'العاب عائلية (أونو، ليدو، بازل)',
        'قراءة قصص',
        'نشاط فني (رسم أو صناعة يدوية بسيطة)'
      ]
    };
  }

  /**
   * Format weekend message
   */
  formatWeekendMessage(movies, outings, checklist, homeAlternative, issues = []) {
    let message = `
🎉 *خطة نهاية الأسبوع*

🎬 *أفلام مقترحة:*
`;

    movies.forEach((movie, idx) => {
      message += `\n${idx + 1}. ${movie.title}\n   📝 ${movie.reason}\n   ⏱️ ${movie.duration}`;
    });

    message += `\n\n🚀 *اقتراحات للخروج:*\n`;

    outings.forEach((outing, idx) => {
      message += `\n${idx + 1}. ${outing.activity}\n   ⏱️ ${outing.duration}\n   💰 ميزانية: ${outing.budget}`;
    });

    message += `\n\n✅ *Checklist التجهيز:*\n`;
    checklist.forEach((item, idx) => {
      message += `${idx + 1}. ${item.item}\n`;
    });

    message += `\n🏡 *بديل منزلي (إذا لم تتمكنوا من الخروج):*\n`;
    homeAlternative.activities.forEach((activity, idx) => {
      message += `${idx + 1}. ${activity}\n`;
    });

    if (this.config.weekend?.include_issue_summary !== false) {
      message += `\n\n🩺 *متابعة مشاكل الطفل:*\n`;
      if (issues.length === 0) {
        message += 'لا توجد تحديات نشطة، استمتعوا بالراحة!';
      } else {
        issues.forEach((issue, idx) => {
          message += `${idx + 1}. ${issue.child_name}: ${issue.issue_title} — حالة ${issue.status} (شدة ${issue.severity || 'متوسطة'})\n`;
        });
      }
    }

    message += `\n\nنتمنى لكم نهاية أسبوع سعيدة! 💙`;

    return message.trim();
  }

  formatWeekendPreviewMessage(movies, outings, issues = []) {
    const firstMovie = movies[0];
    const firstOuting = outings[0];
    let message = '⏳ *نظرة منتصف الأسبوع على عطلة عطية*\n';

    if (firstMovie) {
      message += `\n🎬 فيلم مقترح: ${firstMovie.title} — ${firstMovie.reason || 'قصة ممتعة للتجمع العائلي'}`;
    }
    if (firstOuting) {
      message += `\n🚗 خروجة مرشحة: ${firstOuting.activity} (${firstOuting.duration || 'ساعتان'})`;
    }

    if (this.config.weekend?.include_issue_summary !== false) {
      if (issues.length) {
        message += '\n\n🩺 *تذكير المتابعة*:';
        issues.slice(0, 2).forEach((issue, idx) => {
          message += `\n${idx + 1}. ${issue.child_name}: ${issue.issue_title} — راجعوا خطة المتابعة قبل الخروج.`;
        });
      } else {
        message += '\n\n🩺 لا توجد متابعات معلّقة، اختاروا النشاط المريح لكم.';
      }
    }

    message += '\n\nهل تحتاجون تعديلات؟ أخبروني قبل الخميس!';
    return message;
  }

  parseStructuredList(text, maxItems, type) {
    if (!text) return [];
    const items = [];

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];
        arr.slice(0, maxItems).forEach((entry) => {
          if (type === 'movie') {
            items.push({
              title: entry.title || entry.name || 'فيلم عائلي',
              reason: entry.reason || entry.summary || 'ممتع وآمن للأطفال',
              duration: entry.duration || entry.runtime || '90 دقيقة'
            });
          } else {
            items.push({
              activity: entry.activity || entry.title || 'نزهة في الحديقة',
              duration: entry.duration || '2 ساعات',
              budget: entry.budget || 'منخفضة'
            });
          }
        });
        if (items.length) return items;
      }
    } catch (error) {
      console.warn('Failed to parse structured weekend list:', error);
    }

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, maxItems);

    lines.forEach((line) => {
      if (type === 'movie') {
        items.push({ title: line, reason: line, duration: '90 دقيقة' });
      } else {
        items.push({ activity: line, duration: '2 ساعات', budget: 'منخفضة' });
      }
    });

    return items;
  }

  getActiveIssuesSummary(familyId) {
    try {
      const db = getDatabase();
      return db
        .prepare(
          `SELECT i.issue_title, i.status, i.severity, c.name as child_name
           FROM child_issues i
           INNER JOIN children c ON i.child_id = c.id
           WHERE i.family_id = ? AND i.status IN ('active', 'monitoring')
           ORDER BY i.severity DESC, i.updated_at DESC
           LIMIT 3`
        )
        .all(familyId);
    } catch (error) {
      console.error('Failed to load child issues for weekend summary:', error);
      return [];
    }
  }

  async sendWeekendPreview() {
    console.log('👀 Sending weekend previews...');
    const families = FamilyModel.getAll();
    const weekStart = format(startOfWeek(new Date()), 'yyyy-MM-dd');

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        let plan = WeekendPlanModel.getByWeek(family.id, weekStart);
        if (!plan) {
          await this.generateFamilyWeekendPlan(family, weekStart);
          plan = WeekendPlanModel.getByWeek(family.id, weekStart);
        }
        if (!plan || plan.preview_sent) continue;

        await this.sendWeekendPreviewToFamily(family, plan);
        WeekendPlanModel.markPreviewSent(plan.id);
        await this.sleep(500);
      } catch (error) {
        console.error(`Error sending weekend preview to family ${family.id}:`, error);
      }
    }
  }

  async sendWeekendPreviewToFamily(family, plan) {
    const guardians = GuardianModel.getByFamily(family.id);
    if (guardians.length === 0) return;

    const movies = this.safeJsonParse(plan.movies, []);
    const outings = this.safeJsonParse(plan.outings, []);
    const issues = this.getActiveIssuesSummary(family.id);
    const message = this.formatWeekendPreviewMessage(movies, outings, issues);

    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessageToGroup(family.family_group_id, message);
    } else {
      for (const guardian of guardians) {
        if (!guardian.notification_enabled || !guardian.phone_number) continue;
        await this.bot.sendMessage(guardian.phone_number, message);
      }
    }
  }

  /**
   * Default movie suggestions
   */
  getDefaultMovies() {
    return [
      {
        title: 'Moana (موانا)',
        reason: 'فيلم ديزني جميل عن المغامرة والشجاعة',
        duration: '107 دقيقة'
      },
      {
        title: 'Coco (كوكو)',
        reason: 'قصة مؤثرة عن العائلة والذكريات',
        duration: '105 دقيقة'
      }
    ];
  }

  /**
   * Default outing suggestions
   */
  getDefaultOutings() {
    return [
      {
        activity: 'نزهة في الحديقة القريبة',
        duration: '2-3 ساعات',
        budget: 'منخفضة'
      }
    ];
  }

  /**
   * Calculate age
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

  getRelationshipInsights(familyId) {
    if (!familyId) return [];
    return CoupleFeedbackModel.getRecentByFamily(
      familyId,
      this.config.couple_feedback?.history_window || 6
    );
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  safeJsonParse(payload, fallback) {
    if (!payload) return fallback;
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.warn('Failed to parse JSON payload in WeekendPlannerService:', error);
      return fallback;
    }
  }
}

export default WeekendPlannerService;
