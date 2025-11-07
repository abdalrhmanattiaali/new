/**
 * Weekend Planner Service
 * خدمة تخطيط نهاية الأسبوع
 */

import { FamilyModel, GuardianModel, ChildModel, WeekendPlanModel } from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { format, startOfWeek, addDays } from 'date-fns';

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
    const movies = await this.generateMovieSuggestions(child.name, childAge);

    // Generate outing suggestions
    const outings = await this.generateOutingSuggestions(child.name, childAge);

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

    const movies = JSON.parse(plan.movies);
    const outings = JSON.parse(plan.outings);
    const checklist = JSON.parse(plan.checklist);
    const homeAlternative = JSON.parse(plan.home_alternative);

    const message = this.formatWeekendMessage(movies, outings, checklist, homeAlternative);

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
  async generateMovieSuggestions(childName, childAge) {
    const config = this.config.weekend?.movies;
    if (!config?.enabled) return [];

    const context = {
      messageType: 'weekend_movies',
      childName,
      childAge,
      guardianName: 'العائلة',
      timeOfDay: 'المساء',
      additionalContext: `التقييم: ${config.age_rating_max || 'PG'}, اللغة: ${config.language_pref || 'ar_en_dubbed'}`
    };

    try {
      const suggestions = await this.llm.generateMessage(context);

      // Parse suggestions into structured format
      return [
        {
          title: 'فيلم عائلي مقترح 1',
          reason: suggestions.split('\n')[0] || 'فيلم ممتع للعائلة',
          duration: '90 دقيقة'
        },
        {
          title: 'فيلم عائلي مقترح 2',
          reason: suggestions.split('\n')[1] || 'مناسب للأطفال',
          duration: '100 دقيقة'
        }
      ];

    } catch (error) {
      console.error('Error generating movie suggestions:', error);
      return this.getDefaultMovies();
    }
  }

  /**
   * Generate outing suggestions
   */
  async generateOutingSuggestions(childName, childAge) {
    const config = this.config.weekend?.outings;
    if (!config?.enabled) return [];

    const context = {
      messageType: 'weekend_outings',
      childName,
      childAge,
      guardianName: 'العائلة',
      timeOfDay: 'النهار',
      additionalContext: `الميزانية: ${config.budget || 'متوسطة'}, المدة: ${config.duration_hours || 2} ساعات`
    };

    try {
      const suggestions = await this.llm.generateMessage(context);

      return [
        {
          activity: suggestions.split('\n')[0] || 'نزهة في الحديقة',
          duration: '2-3 ساعات',
          budget: config.budget || 'منخفضة'
        }
      ];

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
  formatWeekendMessage(movies, outings, checklist, homeAlternative) {
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

    message += `\n\nنتمنى لكم نهاية أسبوع سعيدة! 💙`;

    return message.trim();
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

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default WeekendPlannerService;
