/**
 * Weekly Milestone Checkpoint Service
 * يلخص مسار التطور المتوقع للطفل كل أسبوع ويذكّر الأبوين بما يجب مراقبته.
 */

import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { OpenAIClient } from '../utils/openaiClient.js';
import { getWeeklyTargets } from '../utils/milestoneLibrary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WeeklyMilestoneCheckpointService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');
    this.claude = new OpenAIClient();
  }

  async sendWeeklyCheckpoints() {
    if (this.config?.celebrations?.weekly_checkpoint?.enabled === false) {
      console.log('⏸️ Weekly milestone checkpoint disabled via config.');
      return;
    }

    console.log('📈 Preparing weekly milestone checkpoints...');
    const db = new Database(this.dbPath);

    try {
      const families = db
        .prepare(
          `SELECT id, family_name, family_group_id, send_to_group
           FROM families
           WHERE onboarding_completed = 1`
        )
        .all();

      for (const family of families) {
        const children = db
          .prepare(
            `SELECT id, name, birth_date
             FROM children
             WHERE family_id = ?
             ORDER BY birth_date ASC`
          )
          .all(family.id);

        if (!children.length) continue;

        const childSummaries = children.map(child => {
          const ageInMonths = this.calculateAgeInMonths(child.birth_date);
          const targets = getWeeklyTargets(ageInMonths);

          return {
            name: child.name,
            ageInMonths,
            stageName: targets.stageName,
            focus: targets.weeklyFocus,
            checklist: targets.checklist,
            lookAhead: targets.lookAhead,
            encouragement: targets.encouragement
          };
        });

        const includeIssues = this.config?.celebrations?.weekly_checkpoint?.include_issue_snapshot !== false;
        let issueNotes = [];

        if (includeIssues) {
          issueNotes = db
            .prepare(
              `SELECT ci.issue_title, ci.severity, ci.status, c.name AS child_name, ci.followup_frequency_days
               FROM child_issues ci
               JOIN children c ON c.id = ci.child_id
               WHERE ci.family_id = ?
                 AND ci.status IN ('active', 'monitoring')
               ORDER BY ci.severity DESC, ci.reported_date DESC`
            )
            .all(family.id);
        }

        const message = await this.generateWeeklyMessage(family.family_name, childSummaries, issueNotes);
        await this.sendToFamily(family.family_group_id, family.send_to_group, message);
      }

      console.log('✅ Weekly milestone checkpoints sent.');
    } catch (error) {
      console.error('❌ Error while sending weekly milestone checkpoints:', error);
    } finally {
      db.close();
    }
  }

  async generateWeeklyMessage(familyName, childSummaries, issueNotes) {
    const weeklyConfig = this.config?.celebrations?.weekly_checkpoint || {};
    const includeNextStage = weeklyConfig.include_next_stage !== false;

    const childBlocks = childSummaries
      .map(summary => {
        const checklist = summary.checklist?.length ? `- قائمة التركيز: ${summary.checklist.join(' / ')}` : '';
        const lookAhead = includeNextStage && summary.lookAhead ? `- نظرة للأسبوع القادم: ${summary.lookAhead}` : '';

        return `👶 ${summary.name} (${summary.ageInMonths} شهر)\n- المرحلة الحالية: ${summary.stageName}\n- تركيز هذا الأسبوع: ${summary.focus}\n${checklist}\n${lookAhead}`.trim();
      })
      .join('\n\n');

    const issuesBlock = issueNotes.length
      ? `\n\n📍 *متابعة المشاكل الحالية:*\n${issueNotes
          .map(
            issue =>
              `- ${issue.child_name}: ${issue.issue_title} (${issue.severity}) → ${
                issue.status === 'active' ? 'يحتاج متابعة يومية' : 'قيد المراقبة'
              }${issue.followup_frequency_days ? ` | تذكير كل ${issue.followup_frequency_days} يوم` : ''}`
          )
          .join('\n')}`
      : '';

    const systemPrompt = `أنت مدرب تطور أطفال يقدم تقارير أسبوعية للوالدين.
اكتب بالعربية الفصحى الدافئة وامزج بين الدعم العملي والتحفيز الروحي.`;

    const userPrompt = `اكتب رسالة منظمة لعائلة ${familyName} تلخص وضع التطور الحالي لكل طفل وتوجه الوالدين لما يراقبونه هذا الأسبوع.

المعطيات:
${childBlocks}${issuesBlock}

المطلوب:
1. عنوان واضح مثل «📆 متابعة نمو الأسبوع».
2. فقرات قصيرة لكل طفل تتضمن (أ) ما تم الوصول إليه، (ب) ما يجب التركيز عليه، (ج) تلميح للأسبوع القادم.
3. فقرة ختامية تشجع الوالدين على تدوين الملاحظات والاحتفال بالإنجازات الصغيرة.
4. نبرة حنونة وخالية من التوبيخ.
5. طول الرسالة بين 180-250 كلمة.`;

    const response = await this.claude.generateText(systemPrompt, userPrompt, {
      temperature: 0.7,
      maxTokens: 20000
    });

    return response;
  }

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

  async sendToFamily(groupId, sendToGroup, message) {
    try {
      if (sendToGroup && groupId) {
        await this.bot.sendMessage(groupId, message);
      }
    } catch (error) {
      console.error('Error sending weekly milestone checkpoint:', error);
    }
  }
}
