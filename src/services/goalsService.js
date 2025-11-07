/**
 * Parent Goals Service
 * خدمة أهداف الوالدين
 */

import { getDatabase } from '../database/init.js';
import { GuardianModel } from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { format, addDays } from 'date-fns';

export class GoalsService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
  }

  /**
   * Suggest personalized goals for a guardian
   */
  async suggestGoals(guardianId) {
    const db = getDatabase();
    const guardian = GuardianModel.getById(guardianId);

    if (!guardian) return [];

    // Generate AI-powered goal suggestions
    const goalSuggestions = await this.generateGoalSuggestions(guardian);

    // Save suggested goals
    const stmt = db.prepare(`
      INSERT INTO parent_goals (
        guardian_id, goal_type, title, description, category, target_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'active')
    `);

    for (const goal of goalSuggestions) {
      try {
        stmt.run(
          guardianId,
          goal.type,
          goal.title,
          goal.description,
          goal.category,
          goal.targetDate
        );
      } catch (error) {
        console.error('Error saving goal:', error);
      }
    }

    return goalSuggestions;
  }

  /**
   * Generate goal suggestions using AI
   */
  async generateGoalSuggestions(guardian) {
    const role = guardian.role === 'father' ? 'الأب' : 'الأم';

    const prompt = `
اقترح 3 أهداف شخصية مفيدة لـ${role} لتحسين حياته الشخصية والعائلية.

الأهداف يجب أن تكون:
1. واقعية وقابلة للتحقيق
2. محددة بوقت (1-3 أشهر)
3. متنوعة (تربية، تطوير ذات، صحة، علاقة زوجية)

لكل هدف:
- النوع (كتاب/كورس/مهارة/عادة)
- العنوان
- الوصف (سطر واحد)
- الفئة
- المدة المتوقعة
    `.trim();

    try {
      const response = await this.llm.generateMessage({
        messageType: 'goal_suggestions',
        guardianName: guardian.name,
        childName: '',
        childAge: '',
        timeOfDay: '',
        additionalContext: prompt
      });

      // Parse response (simplified - can be improved)
      return this.parseGoalSuggestions(response, guardian);

    } catch (error) {
      console.error('Error generating goal suggestions:', error);
      return this.getDefaultGoals(guardian);
    }
  }

  /**
   * Parse goal suggestions
   */
  parseGoalSuggestions(response, guardian) {
    // Simplified parsing - returns default goals
    return this.getDefaultGoals(guardian);
  }

  /**
   * Get default goal templates
   */
  getDefaultGoals(guardian) {
    const isFather = guardian.role === 'father';

    const goals = [
      {
        type: 'book',
        title: isFather ? 'كتاب: الأب الفعّال' : 'كتاب: التربية الإيجابية',
        description: isFather
          ? 'قراءة كتاب عن دور الأب في تربية الأطفال'
          : 'تعلم أساليب التربية الإيجابية والتواصل الفعال',
        category: 'parenting',
        targetDate: format(addDays(new Date(), 30), 'yyyy-MM-dd')
      },
      {
        type: 'course',
        title: 'كورس: إدارة الوقت للوالدين',
        description: 'تعلم كيفية تنظيم الوقت بين العمل والعائلة والذات',
        category: 'self_development',
        targetDate: format(addDays(new Date(), 60), 'yyyy-MM-dd')
      },
      {
        type: 'habit',
        title: isFather ? 'وقت جودة يومي مع الطفل' : 'تمرين يومي 15 دقيقة',
        description: isFather
          ? '15 دقيقة لعب أو محادثة يومية مع الطفل'
          : 'ممارسة الرياضة أو اليوغا 15 دقيقة يومياً',
        category: isFather ? 'relationship' : 'health',
        targetDate: format(addDays(new Date(), 21), 'yyyy-MM-dd')
      }
    ];

    return goals;
  }

  /**
   * Get active goals for guardian
   */
  getActiveGoals(guardianId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM parent_goals
      WHERE guardian_id = ? AND status = 'active'
      ORDER BY created_at DESC
    `).all(guardianId);
  }

  /**
   * Update goal progress
   */
  updateProgress(goalId, progress) {
    const db = getDatabase();

    db.prepare(`
      UPDATE parent_goals
      SET progress = ?,
          updated_at = CURRENT_TIMESTAMP,
          completed_at = CASE WHEN ? >= 100 THEN CURRENT_TIMESTAMP ELSE NULL END,
          status = CASE WHEN ? >= 100 THEN 'completed' ELSE status END
      WHERE id = ?
    `).run(progress, progress, progress, goalId);

    // If completed, celebrate!
    if (progress >= 100) {
      this.celebrateGoalCompletion(goalId);
    }
  }

  /**
   * Celebrate goal completion
   */
  async celebrateGoalCompletion(goalId) {
    const db = getDatabase();

    const goal = db.prepare('SELECT * FROM parent_goals WHERE id = ?').get(goalId);
    if (!goal) return;

    const guardian = GuardianModel.getById(goal.guardian_id);
    if (!guardian) return;

    const celebrationMessage = `
🎉 *مبروك! هدف مُنجز!*

✨ ${goal.title}

${goal.description}

لقد أكملت هدفك بنجاح! 🌟

هذا إنجاز رائع يستحق الاحتفال. أنت قدوة رائعة لأطفالك!

💪 هل تريد وضع هدف جديد؟ أرسل "أهداف جديدة"
    `.trim();

    await this.bot.sendMessage(guardian.phone_number, celebrationMessage);

    // Save to motivational messages
    db.prepare(`
      INSERT INTO motivational_messages (
        guardian_id, message_type, message_content,
        context, sent_date
      ) VALUES (?, 'milestone_celebration', ?, ?, ?)
    `).run(
      goal.guardian_id,
      celebrationMessage,
      JSON.stringify({ goalId, goalTitle: goal.title }),
      format(new Date(), 'yyyy-MM-dd')
    );
  }

  /**
   * Send goal reminder
   */
  async sendGoalReminder(guardianId) {
    const goals = this.getActiveGoals(guardianId);
    if (goals.length === 0) return;

    const guardian = GuardianModel.getById(guardianId);
    if (!guardian) return;

    let reminderMessage = `
📚 *تذكير بأهدافك الشخصية*

`;

    for (const goal of goals.slice(0, 3)) {
      const progressBar = this.getProgressBar(goal.progress);
      reminderMessage += `
${this.getGoalIcon(goal.goal_type)} **${goal.title}**
${progressBar} ${goal.progress}%
`;
    }

    reminderMessage += `

💡 *نصيحة:* خصص 10 دقائق يومياً للعمل على أحد أهدافك

رد بـ"تقدم [رقم]" لتحديث التقدم (مثلاً: "تقدم 50")
    `.trim();

    await this.bot.sendMessage(guardian.phone_number, reminderMessage);
  }

  /**
   * Get progress bar
   */
  getProgressBar(progress) {
    const filled = Math.floor(progress / 10);
    const empty = 10 - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Get goal type icon
   */
  getGoalIcon(type) {
    const icons = {
      book: '📖',
      course: '🎓',
      skill: '🎯',
      habit: '⭐'
    };
    return icons[type] || '📌';
  }

  /**
   * Suggest learning resources
   */
  async suggestLearningResources(guardianId, topic) {
    const db = getDatabase();
    const guardian = GuardianModel.getById(guardianId);

    const prompt = `
اقترح 3 موارد تعليمية (كتب أو كورسات) عن "${topic}" باللغة العربية أو المترجمة.

لكل مورد:
1. العنوان
2. النوع (كتاب/كورس)
3. المؤلف أو المنصة
4. ملخص في سطرين لماذا مفيد
5. المدة المتوقعة للإنجاز

اجعل الاقتراحات:
- عملية وسهلة التطبيق
- مناسبة للوالدين المشغولين
- متوفرة ومجانية أو بسعر معقول
    `.trim();

    try {
      const resources = await this.llm.generateMessage({
        messageType: 'learning_resources',
        guardianName: guardian.name,
        childName: '',
        childAge: '',
        timeOfDay: '',
        additionalContext: prompt
      });

      return resources;

    } catch (error) {
      console.error('Error suggesting resources:', error);
      return this.getDefaultResources(topic);
    }
  }

  /**
   * Get default learning resources
   */
  getDefaultResources(topic) {
    return `
📚 *موارد تعليمية عن ${topic}:*

1. 📖 **كتاب: دليل الوالدين**
   - مجموعة من النصائح العملية
   - مدة القراءة: أسبوعان
   - متوفر في المكتبات

2. 🎓 **كورس: أساسيات التربية (يوديمي)**
   - 10 محاضرات قصيرة
   - مدة: 3 ساعات
   - بالعربية

3. 📝 **مقالات: موقع عائلتي**
   - مقالات يومية عن التربية
   - مجانية
   - محتوى عربي أصلي
    `.trim();
  }

  /**
   * Send goal reminders to all families (weekly)
   */
  async sendGoalReminders() {
    console.log('📚 Sending weekly goal reminders...');

    const guardians = GuardianModel.getAll();

    for (const guardian of guardians) {
      try {
        const goals = this.getActiveGoals(guardian.id);
        if (goals.length > 0) {
          await this.sendGoalReminder(guardian.id);
          await this.sleep(1000);
        }
      } catch (error) {
        console.error(`Error sending goal reminder to guardian ${guardian.id}:`, error);
      }
    }

    console.log('✅ Goal reminders sent');
  }

  /**
   * Send monthly goal review to all families
   */
  async sendMonthlyGoalReview() {
    console.log('📊 Sending monthly goal reviews...');

    const guardians = GuardianModel.getAll();

    for (const guardian of guardians) {
      try {
        await this.sendGoalReviewMessage(guardian.id);
        await this.sleep(1000);
      } catch (error) {
        console.error(`Error sending goal review to guardian ${guardian.id}:`, error);
      }
    }

    console.log('✅ Monthly goal reviews sent');
  }

  /**
   * Send goal review message
   */
  async sendGoalReviewMessage(guardianId) {
    const db = getDatabase();
    const guardian = GuardianModel.getById(guardianId);
    if (!guardian) return;

    // Get goals stats
    const completed = db.prepare(`
      SELECT COUNT(*) as count FROM parent_goals
      WHERE guardian_id = ? AND status = 'completed'
        AND completed_at >= date('now', '-1 month')
    `).get(guardianId).count;

    const active = db.prepare(`
      SELECT COUNT(*) as count FROM parent_goals
      WHERE guardian_id = ? AND status = 'active'
    `).get(guardianId).count;

    const avgProgress = db.prepare(`
      SELECT AVG(progress) as avg FROM parent_goals
      WHERE guardian_id = ? AND status = 'active'
    `).get(guardianId).avg || 0;

    const reviewMessage = `
📊 *مراجعة أهدافك الشهرية*

مرحباً ${guardian.name}! إليك ملخص تقدمك هذا الشهر:

✅ أهداف مكتملة: ${completed}
📝 أهداف نشطة: ${active}
📈 متوسط التقدم: ${Math.round(avgProgress)}%

${completed > 0 ? '🎉 رائع! لقد أنجزت أهداف هذا الشهر!' : ''}
${avgProgress > 50 ? '💪 تقدم ممتاز! استمر في الجهد الرائع!' : ''}
${avgProgress < 30 ? '💡 نصيحة: حاول تخصيص 10 دقائق يومية للعمل على أهدافك.' : ''}

🎯 *ما التالي؟*
- راجع أهدافك القديمة
- أضف أهداف جديدة إذا أردت
- احتفل بإنجازاتك!

رد بـ"أهداف جديدة" لاقتراح أهداف جديدة
رد بـ"أهدافي" لعرض أهدافك الحالية
    `.trim();

    await this.bot.sendMessage(guardian.phone_number, reviewMessage);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default GoalsService;
