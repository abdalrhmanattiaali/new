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
          const message = await this.generateMonthlyMilestoneMessage(
            child.name,
            ageInMonths,
            birthDate
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
  async generateMonthlyMilestoneMessage(childName, ageInMonths, birthDate) {
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

    const systemPrompt = `أنت خبير تطوير الأطفال تكتب رسائل احتفالية شهرية للوالدين.
تحتفي بنمو الطفل وتذكر الوالدين بالإنجازات والمعالم التطورية.
تستخدم لغة دافئة ومحفزة بالعربية الفصحى.`;

    const userPrompt = `اكتب رسالة احتفالية شهرية للوالدين بمناسبة إتمام طفلهم ${childName} شهراً جديداً.

**معلومات:**
- اسم الطفل: ${childName}
- العمر الآن: ${ageString}
- العمر بالشهور: ${ageInMonths} شهر

**المطلوب:**
1. عنوان احتفالي (🎉 ${childName} أكمل ${ageString}!)
2. تهنئة دافئة للوالدين
3. ملخص للمعالم المتوقعة في هذا الشهر:
   ${this.getMilestoneHints(ageInMonths)}
4. كلمات تشجيع للوالدين
5. تذكير بأن كل طفل ينمو بوتيرته الخاصة
6. دعوة لطيفة

**المواصفات:**
- الطول: 180-250 كلمة
- لغة احتفالية دافئة
- إيموجي مناسب
- ابدأ بـ: 🎉 *${childName} أكمل ${ageString}!*
- اجعل الرسالة مميزة ومحفزة

اجعل الوالدين فخورين بتطور طفلهم!`;

    try {
      const message = await this.claude.generateText(systemPrompt, userPrompt, {
        temperature: 0.85,
        maxTokens: 900
      });

      return message;

    } catch (error) {
      console.error('Error generating monthly milestone:', error);
      // Fallback message
      return `🎉 *${childName} أكمل ${ageString}!*\n\nمبروك! طفلكم الغالي ${childName} أكمل اليوم ${ageString} من العمر! 🎈\n\nكل شهر هو رحلة جديدة مليئة بالنمو والتطور. نحن فخورون بكم كوالدين وبالحب الذي تقدمونه لـ ${childName}.\n\nاستمروا في هذه الرحلة الرائعة! 💝`;
    }
  }

  /**
   * Get milestone hints for AI prompt based on age
   */
  getMilestoneHints(ageInMonths) {
    const hints = {
      1: '- حركات أقل عشوائية\n- يبدأ الابتسام الاجتماعي\n- يتتبع الوجوه',
      2: '- رفع الرأس أعلى\n- المناغاة تبدأ\n- يميز الأصوات',
      3: '- يضحك بصوت عالٍ\n- يمسك الأشياء\n- يرفع صدره عند وقت البطن',
      4: '- قد يتدحرج\n- يجلس بدعم\n- ينقل الأشياء بين اليدين',
      5: '- يتدحرج في الاتجاهين\n- يجلس بوسائد\n- يلعب بأصابع قدميه',
      6: '- يجلس بدون دعم\n- قد يبدأ الحبو\n- **بداية الطعام الصلب**',
      7: '- يحبو أو يستعد للحبو\n- يشد نفسه للوقوف\n- يطعم نفسه finger foods',
      8: '- الحبو بثقة\n- يمشي ممسكاً بالأثاث\n- قبضة الكماشة متقنة',
      9: '- cruising (مشي بالتمسك)\n- يشير لما يريد\n- يفهم "لا"',
      10: '- قد يقف بدون مساعدة\n- يقلد الأفعال\n- يتبع أوامر بسيطة',
      11: '- قد يخطو خطوات\n- يمسك كوب بيديه\n- يقلب صفحات',
      12: '- **عيد الميلاد الأول!**\n- قد يمشي\n- أول كلمة حقيقية\n- يفهم 50-100 كلمة',
      15: '- يمشي بثقة\n- يركل كرة\n- 5-20 كلمة',
      18: '- يجري\n- يصعد الدرج\n- انفجار لغوي (50+ كلمة)\n- نوبات غضب قد تبدأ',
      24: '- **عيد الميلاد الثاني!**\n- يقفز\n- جمل من كلمتين\n- لعب تخيلي'
    };

    // Find closest milestone
    const ages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 24];
    let closestAge = ages[0];
    for (const age of ages) {
      if (ageInMonths >= age) {
        closestAge = age;
      }
    }

    return hints[closestAge] || '- تطور مستمر في جميع المجالات\n- نمو جسدي ومعرفي\n- مهارات اجتماعية';
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
