/**
 * Monthly Milestone Service
 * خدمة التذكير الشهري بعمر الطفل
 *
 * Sends monthly reminders about child's age and milestones
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OpenAIClient } from '../utils/openaiClient.js';
import { getMilestoneContext, getMilestoneHighlights } from '../utils/milestoneLibrary.js';
import { getDatabase } from '../database/init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class MonthlyMilestoneService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');
    this.claude = new OpenAIClient();
  }

  /**
   * Check and send monthly milestone reminders
   */
  async checkAndSendMonthlyReminders() {
    if (this.config?.celebrations?.child_monthly?.enabled === false) {
      console.log('⏸️ Monthly milestone reminders disabled via config.');
      return;
    }

    console.log('📅 Checking monthly milestone reminders...');

    const db = new Database(this.dbPath);

    try {
      const today = new Date();
      const todayDay = today.getDate();

      // Get all children
      const children = db.prepare(`
        SELECT c.*, f.family_name, f.family_group_id, f.send_to_group
        FROM children c
        JOIN families f ON c.family_id = f.id
        WHERE f.onboarding_completed = 1
      `).all();

      for (const child of children) {
        const birthDate = new Date(child.birth_date);
        const birthDay = birthDate.getDate();

        // Check if today is the child's "monthiversary"
        if (todayDay === birthDay) {
          const ageInMonths = this.calculateAgeInMonths(child.birth_date);

          // Skip if it's the actual birth month (covered by birthday reminder)
          if (ageInMonths === 0) continue;

          // Generate and send monthly milestone message
          const context = this.buildFamilyContext(db, child.family_id, child.id);
          const milestoneContext = getMilestoneContext(ageInMonths);
          const message = await this.generateMonthlyMilestoneMessage(
            child.name,
            ageInMonths,
            birthDate,
            milestoneContext,
            context,
            child.family_name
          );

          await this.sendToFamily(
            child.family_group_id,
            child.send_to_group,
            message
          );

          console.log(`📨 Sent monthly milestone for ${child.name} (${ageInMonths} months)`);
        }
      }

      db.close();
      console.log('✅ Monthly milestone check completed');

    } catch (error) {
      db.close();
      console.error('❌ Error checking monthly milestones:', error);
    }
  }

  /**
   * Generate monthly milestone message
   */
  async generateMonthlyMilestoneMessage(
    childName,
    ageInMonths,
    birthDate,
    milestoneContext,
    context,
    familyName
  ) {
    // Calculate years and months
    const years = Math.floor(ageInMonths / 12);
    const months = ageInMonths % 12;

    // Format age string
    let ageString = '';
    if (years === 0) {
      ageString = `${ageInMonths} شهر`;
    } else if (years === 1 && months === 0) {
      ageString = `سنة واحدة`;
    } else if (years === 1) {
      ageString = `سنة و${months} شهر`;
    } else if (years === 2 && months === 0) {
      ageString = `سنتين`;
    } else if (years === 2) {
      ageString = `سنتين و${months} شهر`;
    } else {
      ageString = `${years} سنوات و${months} شهر`;
    }

    const milestoneHighlights = milestoneContext?.monthlyHighlights || getMilestoneHighlights(ageInMonths);
    const formattedHistory = context.interactions
      .slice(0, 8)
      .map((interaction) => `- ${interaction.message_type || 'رسالة'}: ${interaction.message_content?.slice(0, 110) || ''}`)
      .join('\n');
    const formattedIssues = context.issues
      .slice(0, 5)
      .map(
        (issue) =>
          `- ${issue.issue_title || issue.issue_type} (${issue.severity || 'متوسط'}): ${issue.status || 'متابعة'}`
      )
      .join('\n');
    const formattedCoupleNotes = context.coupleNotes
      .slice(0, 3)
      .map((note, index) => `#${index + 1} إيجابي: ${note.positives || ''} | تحدي: ${note.challenges || ''}`)
      .join('\n');

    const systemPrompt = `أنت خبير تطوير الأطفال تكتب رسائل احتفالية شهرية للوالدين.
تحتفي بنمو الطفل وتذكر الوالدين بالإنجازات والمعالم التطورية.
تستخدم لغة دافئة ومحفزة بالعربية الفصحى، وتربط النص بسجل العائلة وملاحظات الزوجين والمشكلات الصحية القائمة.
تضيف اقتباسًا ملهمًا أو آية أو حديثًا مختلفًا كل مرة دون تكرار القوالب.`;

    const userPrompt = `اكتب رسالة احتفالية شهرية للوالدين بمناسبة إتمام طفلهم ${childName} (${familyName}) شهراً جديداً.

**معلومات أساسية:**
- اسم الطفل: ${childName}
- العمر الآن: ${ageString}
- العمر بالشهور: ${ageInMonths} شهر
- المرحلة: ${milestoneContext.stageName}
- أعمدة النمو الرئيسية: ${milestoneContext.growthPillars?.join(', ')}
- علامات خطر راقِبها: ${milestoneContext.riskSigns?.join('; ')}
- مرتكز إيماني: ${milestoneContext.spiritualAnchor}
- حكمة نبوية: ${milestoneContext.propheticWisdom}
- اقتباس ملهم: ${milestoneContext.inspirationalQuote}

**سجل العائلة الحديث:**
${formattedHistory || '- لا توجد تفاعلات مسجلة بعد.'}

**المشكلات/القضايا النشطة للطفل:**
${formattedIssues || '- لا توجد قضايا نشطة مسجلة.'}

**مقتطفات من مراجعة الزوجين:**
${formattedCoupleNotes || '- لا توجد ملاحظات حديثة.'}

**المطلوب في الرسالة:**
1) عنوان احتفالي (ابدأ بـ: 🎉 *${childName} أكمل ${ageString}!*).
2) فقرة تهنئة + امتنان للوالدين تربط بما حدث هذا الشهر (استخدم عنصر من سجل العائلة أو حوار الزوجين).
3) فقرة رحلة النمو: لخص المعالم (${milestoneHighlights}) مع قصة واقعية قصيرة (${milestoneContext.longStoryHook}) بطول 80-120 كلمة.
4) فقرة ما القادم؟ اذكر نظرة مستقبلية (${milestoneContext.lookAhead}) مع اقتراح نشاط وتذكير علامة خطر واحدة.
5) فقرة إيمانية: استشهد بالآية أو الحديث أعلاه باختصار + دعاء شخصي للطفل.
6) فقرة تحفيزية للوالدين: تشجع على تدوين ملاحظة جديدة هذا الشهر.

**المواصفات:**
- الطول الإجمالي: 220-280 كلمة.
- لغة احتفالية، دافئة، وغير مكررة.
- اربط النص بسجل العائلة والمشاكل النشطة دون إفشاء معلومات حساسة.
- اختم بدعوة عملية واحدة واضحة (مثلاً: شاركوا لحظة نجاح أو صورة اليوم).`;

    try {
      const message = await this.claude.generateText(systemPrompt, userPrompt, {
        temperature: 0.85,
        maxTokens: 20000
      });

      return message;

    } catch (error) {
      console.error('Error generating monthly milestone:', error);
      // Fallback message
      return `🎉 *${childName} أكمل ${ageString}!*\n\nمبروك! طفلكم الغالي ${childName} أكمل اليوم ${ageString} من العمر! 🎈\n\nكل شهر هو رحلة جديدة مليئة بالنمو والتطور. نحن فخورون بكم كوالدين وبالحب الذي تقدمونه لـ ${childName}.\n\nاستمروا في هذه الرحلة الرائعة! 💝`;
    }
  }

  buildFamilyContext(db, familyId, childId) {
    const localDb = db || getDatabase();

    try {
      const interactions = localDb
        .prepare(
          `SELECT message_type, message_content
           FROM interactions
           WHERE family_id = ?
           ORDER BY created_at DESC
           LIMIT 20`
        )
        .all(familyId);

      const issues = localDb
        .prepare(
          `SELECT issue_title, issue_type, severity, status
           FROM child_issues
           WHERE family_id = ? AND child_id = ? AND status IN ('active', 'monitoring')
           ORDER BY updated_at DESC
           LIMIT 10`
        )
        .all(familyId, childId);

      const coupleNotes = localDb
        .prepare(
          `SELECT positives, challenges
           FROM couple_feedback_logs
           WHERE family_id = ?
           ORDER BY created_at DESC
           LIMIT 5`
        )
        .all(familyId);

      return { interactions, issues, coupleNotes };
    } catch (error) {
      console.warn('MonthlyMilestoneService: failed to build context:', error.message);
      return { interactions: [], issues: [], coupleNotes: [] };
    } finally {
      if (!db && localDb) {
        try {
          localDb.close();
        } catch (closeError) {
          console.warn('MonthlyMilestoneService: failed to close context db:', closeError.message);
        }
      }
    }
  }

  /**
   * Calculate age in months
   */
  calculateAgeInMonths(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();

    let months = (today.getFullYear() - birth.getFullYear()) * 12;
    months -= birth.getMonth();
    months += today.getMonth();

    if (today.getDate() < birth.getDate()) {
      months--;
    }

    return Math.max(0, months);
  }

  /**
   * Send message to family
   */
  async sendToFamily(groupId, sendToGroup, message) {
    try {
      if (sendToGroup && groupId) {
        await this.bot.sendMessage(groupId, message);
      }
    } catch (error) {
      console.error('Error sending monthly milestone:', error);
    }
  }
}

export default MonthlyMilestoneService;
