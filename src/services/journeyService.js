/**
 * Goals & Journey Service
 * خدمة الأهداف ورحلة التطور
 */

import { getDatabase } from '../database/init.js';
import { GuardianModel, ChildModel } from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { format, differenceInMonths } from 'date-fns';

export class JourneyService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
  }

  /**
   * Initialize journey for a new family
   */
  async initializeJourney(familyId) {
    const children = ChildModel.getByFamily(familyId);
    if (children.length === 0) return;

    const child = children[0];
    const childAgeMonths = this.calculateAgeInMonths(child.birth_date);

    // Add age-appropriate milestones
    await this.addAgeMilestones(child.id, childAgeMonths);

    // Generate initial toy recommendations
    await this.generateToyRecommendations(child.id, childAgeMonths);

    console.log(`✅ Journey initialized for child ${child.name}`);
  }

  /**
   * Calculate child age in months
   */
  calculateAgeInMonths(birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    return differenceInMonths(now, birth);
  }

  /**
   * Add age-appropriate milestones
   */
  async addAgeMilestones(childId, ageMonths) {
    const db = getDatabase();

    // Milestone templates based on age
    const milestones = this.getMilestoneTemplates(ageMonths);

    const stmt = db.prepare(`
      INSERT INTO child_milestones (
        child_id, milestone_type, title, description, expected_age_months
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const milestone of milestones) {
      try {
        stmt.run(
          childId,
          milestone.type,
          milestone.title,
          milestone.description,
          milestone.expectedAge
        );
      } catch (error) {
        // Skip duplicates
      }
    }

    console.log(`✅ Added ${milestones.length} milestones for child`);
  }

  /**
   * Get milestone templates based on age
   */
  getMilestoneTemplates(ageMonths) {
    const templates = [
      // 0-6 months
      { type: 'physical', title: 'رفع الرأس', description: 'يرفع رأسه عند الاستلقاء على البطن', expectedAge: 3, ageRange: [0, 6] },
      { type: 'social', title: 'الابتسامة الاجتماعية', description: 'يبتسم عند رؤية الوجوه المألوفة', expectedAge: 2, ageRange: [0, 6] },
      { type: 'language', title: 'المناغاة', description: 'يصدر أصوات المناغاة (آآآ، أوووو)', expectedAge: 4, ageRange: [0, 6] },

      // 6-12 months
      { type: 'physical', title: 'الجلوس بدون مساعدة', description: 'يجلس بمفرده بدون دعم', expectedAge: 7, ageRange: [6, 12] },
      { type: 'physical', title: 'الحبو', description: 'يحبو على يديه وركبتيه', expectedAge: 9, ageRange: [6, 12] },
      { type: 'cognitive', title: 'فهم "لا"', description: 'يفهم كلمة "لا" ويتوقف', expectedAge: 10, ageRange: [6, 12] },
      { type: 'language', title: 'كلمة أولى', description: 'ينطق أول كلمة ذات معنى', expectedAge: 12, ageRange: [6, 12] },

      // 12-24 months
      { type: 'physical', title: 'المشي المستقل', description: 'يمشي بمفرده بدون مساعدة', expectedAge: 14, ageRange: [12, 24] },
      { type: 'language', title: 'جملة من كلمتين', description: 'يكوّن جملة بسيطة من كلمتين', expectedAge: 18, ageRange: [12, 24] },
      { type: 'social', title: 'اللعب التخيلي', description: 'يبدأ اللعب التخيلي (يتظاهر بالطبخ)', expectedAge: 20, ageRange: [12, 24] },
      { type: 'cognitive', title: 'التعرف على الألوان', description: 'يتعرف على ألوان أساسية', expectedAge: 22, ageRange: [12, 24] },

      // 24-36 months
      { type: 'physical', title: 'الجري', description: 'يجري بثبات', expectedAge: 26, ageRange: [24, 36] },
      { type: 'language', title: 'جمل كاملة', description: 'يتحدث بجمل كاملة (4-5 كلمات)', expectedAge: 30, ageRange: [24, 36] },
      { type: 'social', title: 'اللعب مع الأطفال', description: 'يلعب مع أطفال آخرين', expectedAge: 32, ageRange: [24, 36] },
      { type: 'cognitive', title: 'العد حتى 10', description: 'يعد الأرقام حتى 10', expectedAge: 34, ageRange: [24, 36] },

      // 36+ months
      { type: 'physical', title: 'القفز', description: 'يقفز بكلتا القدمين', expectedAge: 40, ageRange: [36, 60] },
      { type: 'social', title: 'تكوين صداقات', description: 'يكوّن صداقات مع أطفال', expectedAge: 42, ageRange: [36, 60] },
      { type: 'language', title: 'سرد قصة', description: 'يسرد قصة بسيطة بالترتيب', expectedAge: 44, ageRange: [36, 60] },
      { type: 'cognitive', title: 'كتابة الاسم', description: 'يكتب اسمه الأول', expectedAge: 48, ageRange: [36, 60] }
    ];

    // Filter milestones relevant to current age
    return templates.filter(m => {
      const [minAge, maxAge] = m.ageRange;
      return ageMonths >= minAge && ageMonths <= maxAge;
    });
  }

  /**
   * Mark milestone as achieved
   */
  async achieveMilestone(milestoneId, achievedDate = new Date()) {
    const db = getDatabase();

    const milestone = db.prepare('SELECT * FROM child_milestones WHERE id = ?').get(milestoneId);
    if (!milestone) return;

    const child = ChildModel.getById(milestone.child_id);
    const ageAtAchievement = this.calculateAgeInMonths(child.birth_date);

    db.prepare(`
      UPDATE child_milestones
      SET achieved = 1,
          achieved_date = ?,
          age_at_achievement_months = ?
      WHERE id = ?
    `).run(format(achievedDate, 'yyyy-MM-dd'), ageAtAchievement, milestoneId);

    // Add to journey
    await this.addJourneyEvent(
      child.family_id,
      'milestone',
      `إنجاز: ${milestone.title}`,
      milestone.description,
      ['father', 'mother', 'child']
    );

    // Send celebration message
    await this.sendMilestoneCelebration(child, milestone);

    console.log(`🎉 Milestone achieved: ${milestone.title}`);
  }

  /**
   * Send milestone celebration message
   */
  async sendMilestoneCelebration(child, milestone) {
    const guardians = GuardianModel.getByFamily(child.family_id);
    if (guardians.length === 0) return;

    const celebrationMessage = await this.llm.generateMessage({
      messageType: 'milestone_celebration',
      guardianName: 'العائلة',
      childName: child.name,
      childAge: this.formatAge(this.calculateAgeInMonths(child.birth_date)),
      timeOfDay: 'اليوم',
      additionalContext: `أنجز ${child.name} معلماً هاماً: ${milestone.title} - ${milestone.description}`
    });

    const fullMessage = `
🎉 *إنجاز جديد!*

${celebrationMessage}

✨ معلم التطور: ${milestone.title}
📝 ${milestone.description}

أنتم تقومون بعمل رائع! استمروا في الدعم والتشجيع 💙
    `.trim();

    for (const guardian of guardians) {
      await this.bot.sendMessage(guardian.phone_number, fullMessage);
    }
  }

  /**
   * Generate toy recommendations
   */
  async generateToyRecommendations(childId, ageMonths) {
    const db = getDatabase();
    const child = ChildModel.getById(childId);

    // Generate AI-powered toy recommendations
    const toysPrompt = `
اقترح 3 ألعاب مناسبة لطفل عمره ${this.formatAge(ageMonths)}.

لكل لعبة:
1. الاسم
2. الفئة (تعليمية/إبداعية/حركية/حسية)
3. الفوائد (3 فوائد)
4. الفئة السعرية (ميزانية/متوسط/ممتاز)

اجعل الاقتراحات:
- مناسبة للعمر
- متنوعة (أنواع مختلفة)
- عملية ومتوفرة
- تدعم النمو والتطور
    `.trim();

    try {
      const response = await this.llm.generateMessage({
        messageType: 'toy_recommendations',
        guardianName: 'العائلة',
        childName: child.name,
        childAge: this.formatAge(ageMonths),
        timeOfDay: '',
        additionalContext: toysPrompt
      });

      // Parse and save recommendations (simplified)
      const toys = this.parseToyRecommendations(response, ageMonths);

      const stmt = db.prepare(`
        INSERT INTO toy_recommendations (
          child_id, toy_name, toy_category, age_range_min_months,
          age_range_max_months, benefits, price_range
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      for (const toy of toys) {
        stmt.run(
          childId,
          toy.name,
          toy.category,
          ageMonths,
          ageMonths + 6,
          JSON.stringify(toy.benefits),
          toy.priceRange
        );
      }

      console.log(`✅ Generated ${toys.length} toy recommendations`);

    } catch (error) {
      console.error('Error generating toy recommendations:', error);
    }
  }

  /**
   * Parse toy recommendations from AI response
   */
  parseToyRecommendations(response, ageMonths) {
    // Simple parsing (can be improved with structured AI output)
    const defaultToys = [
      {
        name: 'مكعبات بناء ملونة',
        category: 'educational',
        benefits: ['تطوير المهارات الحركية', 'تعلم الألوان', 'تحفيز الإبداع'],
        priceRange: 'budget'
      },
      {
        name: 'كتاب قصص مصور',
        category: 'educational',
        benefits: ['تطوير اللغة', 'تحفيز الخيال', 'وقت جودة مع الوالدين'],
        priceRange: 'budget'
      },
      {
        name: 'لعبة تركيب بسيطة',
        category: 'cognitive',
        benefits: ['تطوير حل المشكلات', 'تحسين التركيز', 'مهارات يدوية'],
        priceRange: 'moderate'
      }
    ];

    return defaultToys;
  }

  /**
   * Add journey event
   */
  async addJourneyEvent(familyId, eventType, title, description, participants) {
    const db = getDatabase();
    const child = ChildModel.getByFamily(familyId)[0];
    const ageMonths = this.calculateAgeInMonths(child.birth_date);

    db.prepare(`
      INSERT INTO development_journey (
        family_id, journey_date, child_age_months, event_type,
        event_title, event_description, participants, emotional_tone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      familyId,
      format(new Date(), 'yyyy-MM-dd'),
      ageMonths,
      eventType,
      title,
      description,
      JSON.stringify(participants),
      'joyful'
    );
  }

  /**
   * Get journey timeline
   */
  getJourneyTimeline(familyId, limit = 30) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM development_journey
      WHERE family_id = ?
      ORDER BY journey_date DESC
      LIMIT ?
    `).all(familyId, limit);
  }

  /**
   * Format age
   */
  formatAge(months) {
    if (months < 12) {
      return `${months} شهر`;
    } else if (months === 12) {
      return 'سنة واحدة';
    } else if (months < 24) {
      return `سنة و${months - 12} شهر`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      if (remainingMonths === 0) {
        return years === 2 ? 'سنتان' : `${years} سنوات`;
      }
      return `${years} سنة و${remainingMonths} شهر`;
    }
  }

  /**
   * Check and suggest milestones for all families
   */
  async checkAndSuggestMilestones() {
    console.log('📊 Checking milestones for all families...');

    const db = getDatabase();
    const { FamilyModel } = await import('../database/models.js');
    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        const children = ChildModel.getByFamily(family.id);
        for (const child of children) {
          const ageMonths = this.calculateAgeInMonths(child.birth_date);

          // Check for approaching milestones
          const upcomingMilestones = db.prepare(`
            SELECT * FROM child_milestones
            WHERE child_id = ? AND achieved = 0
              AND expected_age_months BETWEEN ? AND ?
            ORDER BY expected_age_months
            LIMIT 3
          `).all(child.id, ageMonths - 1, ageMonths + 2);

          if (upcomingMilestones.length > 0) {
            await this.sendMilestoneReminder(family, child, upcomingMilestones);
          }
        }
      } catch (error) {
        console.error(`Error checking milestones for family ${family.id}:`, error);
      }
    }

    console.log('✅ Milestone checks completed');
  }

  /**
   * Send milestone reminder
   */
  async sendMilestoneReminder(family, child, milestones) {
    const guardians = GuardianModel.getByFamily(family.id);
    if (guardians.length === 0) return;

    const milestoneList = milestones.map(m => `• ${m.title}: ${m.description}`).join('\n');

    const message = `
📊 *تحديث معالم التطور*

مرحباً! إليكم بعض المعالم التطورية المتوقعة لـ${child.name} في هذه المرحلة:

${milestoneList}

💡 تذكروا: كل طفل ينمو بوتيرته الخاصة. هذه المعالم مجرد دليل إرشادي.

عندما يحقق ${child.name} أي من هذه المعالم، أخبرونا لنحتفل معاً! 🎉
    `.trim();

    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessage(family.family_group_id, message);
    } else {
      for (const guardian of guardians) {
        await this.bot.sendMessage(guardian.phone_number, message);
      }
    }
  }

  /**
   * Send toy recommendations to all families
   */
  async sendToyRecommendations() {
    console.log('🎁 Sending toy recommendations to families...');

    const db = getDatabase();
    const { FamilyModel } = await import('../database/models.js');
    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        const children = ChildModel.getByFamily(family.id);
        for (const child of children) {
          const ageMonths = this.calculateAgeInMonths(child.birth_date);

          // Get recent toy recommendations
          const toys = db.prepare(`
            SELECT * FROM toy_recommendations
            WHERE child_id = ?
              AND age_range_min_months <= ?
              AND age_range_max_months >= ?
            ORDER BY recommended_date DESC
            LIMIT 3
          `).all(child.id, ageMonths, ageMonths);

          // If no recent recommendations, generate new ones
          if (toys.length === 0) {
            await this.generateToyRecommendations(child.id, ageMonths);
            // Fetch the newly generated ones
            const newToys = db.prepare(`
              SELECT * FROM toy_recommendations
              WHERE child_id = ?
              ORDER BY recommended_date DESC
              LIMIT 3
            `).all(child.id);

            if (newToys.length > 0) {
              await this.sendToyRecommendationMessage(family, child, newToys);
            }
          } else {
            await this.sendToyRecommendationMessage(family, child, toys);
          }
        }
      } catch (error) {
        console.error(`Error sending toy recommendations to family ${family.id}:`, error);
      }
    }

    console.log('✅ Toy recommendations sent');
  }

  /**
   * Send toy recommendation message
   */
  async sendToyRecommendationMessage(family, child, toys) {
    const guardians = GuardianModel.getByFamily(family.id);
    if (guardians.length === 0) return;

    const toyList = toys.map((toy, index) => {
      const benefits = typeof toy.benefits === 'string'
        ? JSON.parse(toy.benefits)
        : toy.benefits;

      return `
${index + 1}. *${toy.toy_name}*
   النوع: ${this.getCategoryNameArabic(toy.toy_category)}
   الفوائد: ${benefits.join('، ')}
   الفئة السعرية: ${this.getPriceRangeArabic(toy.price_range)}
      `.trim();
    }).join('\n\n');

    const message = `
🎁 *اقتراحات ألعاب لـ${child.name}*

بناءً على عمر ${child.name}، إليكم بعض الألعاب المناسبة:

${toyList}

💡 هذه الألعاب مصممة لدعم تطور ${child.name} في هذه المرحلة العمرية.

اختاروا ما يناسب ميزانيتكم واهتمامات طفلكم! 🌟
    `.trim();

    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessage(family.family_group_id, message);
    } else {
      for (const guardian of guardians) {
        await this.bot.sendMessage(guardian.phone_number, message);
      }
    }
  }

  /**
   * Get category name in Arabic
   */
  getCategoryNameArabic(category) {
    const map = {
      educational: 'تعليمية',
      creative: 'إبداعية',
      physical: 'حركية',
      sensory: 'حسية',
      cognitive: 'معرفية'
    };
    return map[category] || category;
  }

  /**
   * Get price range in Arabic
   */
  getPriceRangeArabic(range) {
    const map = {
      budget: 'اقتصادية',
      moderate: 'متوسطة',
      premium: 'ممتازة'
    };
    return map[range] || range;
  }
}

export default JourneyService;
