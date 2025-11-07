/**
 * Weekly Report Service
 * خدمة التقارير الأسبوعية
 */

import {
  FamilyModel,
  GuardianModel,
  ChildModel,
  DailyTrackingModel,
  InteractionModel
} from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { getDatabase } from '../database/init.js';

export class WeeklyReportService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
  }

  /**
   * Generate and send weekly reports for all families
   */
  async generateAndSendReports() {
    console.log('📊 Generating weekly reports...');

    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        await this.generateFamilyReport(family);
      } catch (error) {
        console.error(`Error generating report for family ${family.id}:`, error);
      }
    }

    console.log('✅ Weekly reports sent');
  }

  /**
   * Generate report for a specific family
   */
  async generateFamilyReport(family) {
    const weekStart = format(startOfWeek(subDays(new Date(), 7)), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(subDays(new Date(), 7)), 'yyyy-MM-dd');

    const guardians = GuardianModel.getByFamily(family.id);
    const children = ChildModel.getByFamily(family.id);

    if (guardians.length === 0 || children.length === 0) return;

    // Collect data for the week
    const reportData = await this.collectWeekData(family, children, guardians, weekStart, weekEnd);

    // Generate AI-powered summary
    const aiSummary = await this.generateAISummary(reportData);

    // Format report message
    const reportMessage = this.formatReportMessage(reportData, aiSummary);

    // Send to all guardians
    for (const guardian of guardians) {
      try {
        await this.bot.sendMessage(guardian.phone_number, reportMessage);
        console.log(`✅ Weekly report sent to ${guardian.name}`);
        await this.sleep(1000);
      } catch (error) {
        console.error(`Error sending report to ${guardian.name}:`, error);
      }
    }

    // Save report to database
    this.saveReport(family.id, weekStart, weekEnd, reportData, aiSummary);
  }

  /**
   * Collect data for the week
   */
  async collectWeekData(family, children, guardians, weekStart, weekEnd) {
    const child = children[0]; // Primary child

    // Get tracking data
    const trackingData = DailyTrackingModel.getByChild(child.id, weekStart, weekEnd);
    const weeklySummary = DailyTrackingModel.getWeeklySummary(child.id, weekStart);

    // Get interaction stats
    const interactionStats = this.getWeeklyInteractionStats(guardians, weekStart, weekEnd);

    // Calculate achievements
    const achievements = this.calculateAchievements(trackingData, weeklySummary);

    // Calculate improvements needed
    const improvements = this.calculateImprovements(trackingData, weeklySummary);

    return {
      childName: child.name,
      childAge: this.calculateAge(child.birth_date),
      weekStart,
      weekEnd,
      trackingData,
      weeklySummary,
      interactionStats,
      achievements,
      improvements
    };
  }

  /**
   * Get weekly interaction stats
   */
  getWeeklyInteractionStats(guardians, weekStart, weekEnd) {
    const db = getDatabase();
    const stats = {};

    for (const guardian of guardians) {
      const result = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN button_clicked IS NOT NULL THEN 1 ELSE 0 END) as responded,
          AVG(response_time_seconds) as avg_response_time
        FROM interactions
        WHERE guardian_id = ?
          AND DATE(created_at) BETWEEN ? AND ?
      `).get(guardian.id, weekStart, weekEnd);

      stats[guardian.name] = {
        total: result.total || 0,
        responded: result.responded || 0,
        responseRate: result.total > 0 ? ((result.responded / result.total) * 100).toFixed(1) : 0
      };
    }

    return stats;
  }

  /**
   * Calculate achievements
   */
  calculateAchievements(trackingData, summary) {
    const achievements = [];

    if (summary.good_sleep_days >= 4) {
      achievements.push('نوم منتظم وجيد 😴');
    }

    if (summary.good_nutrition_days >= 5) {
      achievements.push('تغذية ممتازة 🍎');
    }

    if (summary.avg_play_minutes >= 10) {
      achievements.push('وقت لعب كافٍ 🎨');
    }

    if (summary.total_language_activities >= 7) {
      achievements.push('نشاط لغوي يومي 📚');
    }

    if (achievements.length === 0) {
      achievements.push('استمرار في المحاولة 💪');
    }

    return achievements;
  }

  /**
   * Calculate improvements needed
   */
  calculateImprovements(trackingData, summary) {
    const improvements = [];

    if (summary.good_sleep_days < 4) {
      improvements.push('تحسين روتين النوم');
    }

    if (summary.good_nutrition_days < 4) {
      improvements.push('التركيز على التغذية المتوازنة');
    }

    if (summary.avg_play_minutes < 10) {
      improvements.push('زيادة وقت اللعب الهادف');
    }

    if (improvements.length === 0) {
      improvements.push('المحافظة على الروتين الحالي');
    }

    return improvements;
  }

  /**
   * Generate AI summary
   */
  async generateAISummary(reportData) {
    const context = {
      messageType: 'weekly_report',
      guardianName: 'العائلة',
      childName: reportData.childName,
      childAge: reportData.childAge,
      timeOfDay: 'الصباح',
      additionalContext: JSON.stringify({
        achievements: reportData.achievements,
        improvements: reportData.improvements,
        summary: reportData.weeklySummary
      })
    };

    try {
      const summary = await this.llm.generateMessage(context);
      return summary;
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return 'أسبوع جيد! استمروا في المحاولة والتطوير 💙';
    }
  }

  /**
   * Format report message
   */
  formatReportMessage(data, aiSummary) {
    const message = `
📊 *التقرير الأسبوعي*
الأسبوع: ${data.weekStart} إلى ${data.weekEnd}

👶 *${data.childName}* (${data.childAge})

✨ *إنجازات الأسبوع:*
${data.achievements.map((a, i) => `${i + 1}. ${a}`).join('\n')}

📈 *الإحصائيات:*
😴 النوم: ${data.weeklySummary.good_sleep_days || 0}/7 أيام جيدة
🍎 التغذية: ${data.weeklySummary.good_nutrition_days || 0}/7 أيام جيدة
🎨 اللعب: ${Math.round(data.weeklySummary.avg_play_minutes || 0)} دقيقة يومياً
📚 النشاط اللغوي: ${data.weeklySummary.total_language_activities || 0} نشاط

🎯 *نقاط للتحسين:*
${data.improvements.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

💡 *ملخص الذكاء الاصطناعي:*
${aiSummary}

🎯 *هدف الأسبوع القادم:*
المحافظة على الروتين وتحسين نقطة واحدة من نقاط التحسين

---
أنتم تقومون بعمل رائع! 💙
    `.trim();

    return message;
  }

  /**
   * Save report to database
   */
  saveReport(familyId, weekStart, weekEnd, data, aiSummary) {
    const db = getDatabase();

    const stmt = db.prepare(`
      INSERT INTO weekly_reports (
        family_id, week_start_date, week_end_date,
        summary, achievements, improvements_needed,
        next_week_goal, sent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    stmt.run(
      familyId,
      weekStart,
      weekEnd,
      JSON.stringify(data.weeklySummary),
      JSON.stringify(data.achievements),
      JSON.stringify(data.improvements),
      'المحافظة على الروتين'
    );
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

export default WeeklyReportService;
