/**
 * Couple Insight Service
 * تذكير أسبوعي لسؤال الزوجين عن الإيجابيات والتحديات
 */

import {
  FamilyModel,
  GuardianModel,
  ChildModel,
  InteractionModel,
  CoupleFeedbackModel
} from '../database/models.js';
import { getDatabase } from '../database/init.js';
import { LLMService } from '../ai/llm.js';
import InteractiveDialogueService from './interactiveDialogueService.js';

export class CoupleInsightService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
    this.dialogue = new InteractiveDialogueService(bot, config);
  }

  async sendPrompts(focus = 'checkin') {
    if (this.config.couple_feedback?.enabled === false) return;

    const families = FamilyModel.getAll();
    const historyWindow = this.config.couple_feedback?.history_window || 8;

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      const guardians = (GuardianModel.getByFamily(family.id) || []).filter(
        (guardian) => guardian.notification_enabled !== 0 && guardian.phone_number
      );
      if (!guardians.length) continue;

      const children = ChildModel.getByFamily(family.id);
      const child = children?.[0] || null;
      const childAge = child ? this.calculateAge(child.birth_date) : 'طفل';
      const relationshipInsights = CoupleFeedbackModel.getRecentByFamily(family.id, historyWindow);
      const activeIssues = this.getActiveIssues(family.id);

      for (const guardian of guardians) {
        const partner = this.findPartner(guardians, guardian);
        const messageType = focus === 'gratitude' ? 'couple_feedback_gratitude' : 'couple_feedback_checkin';
        const previousInteractions = InteractionModel.getByGuardian(guardian.id, 12);
        const additionalContext = this.buildAdditionalContext({ guardian, partner, focus });

        const context = {
          messageType,
          guardianName: guardian.name,
          childName: child?.name || family.family_name,
          childAge,
          timeOfDay: focus === 'gratitude' ? 'الصباح' : 'المساء',
          additionalContext,
          previousInteractions,
          activeIssues,
          trackMetadata: {
            title: 'محادثة زوجية',
            category: 'couple',
            tone: focus === 'gratitude' ? 'ممتن وودود' : 'صادق وآمن',
            focus: 'منح مساحة لتبادل الإيجابيات ومناقشة التحديات بدون أحكام'
          },
          preferredFormat: 'text',
          relationshipInsights,
          familyId: family.id
        };

        let message;
        try {
          message = await this.llm.generateMessage(context);
        } catch (error) {
          console.error('CoupleInsightService: failed to generate prompt', error);
          message = this.getFallbackMessage(guardian, partner, focus);
        }

        if (!message) continue;

        try {
          await this.bot.sendMessageWithButtons(
            guardian.phone_number,
            message,
            this.buildButtons(focus)
          );
          InteractionModel.create(family.id, guardian.id, messageType, message, null);
          const session = this.dialogue.ensureSession({
            familyId: family.id,
            type: 'couple_feedback',
            topic: focus,
            participants: guardians.map((member) => member.id),
            metadata: { prompt: messageType, focus }
          });
          await this.dialogue.appendAssistantMessage(session, message);
          await this.sleep(500);
        } catch (error) {
          console.error(`CoupleInsightService: failed to send to ${guardian.phone_number}`, error);
        }
      }
    }
  }

  buildAdditionalContext({ guardian, partner, focus }) {
    const partnerLabel = partner ? `${partner.name} (${partner.role === 'father' ? 'الأب' : 'الأم'})` : 'الشريك';
    if (focus === 'gratitude') {
      return `ذكّر ${guardian.name} بذكر شيئين إيجابيين عن ${partnerLabel} ثم جملة امتنان صغيرة، وبعدها مقترح دعم عملي لليوم.`;
    }

    return `اطلب من ${guardian.name} مشاركة أبرز إيجابية لاحظها في ${partnerLabel} هذا الأسبوع ثم تحدٍ واحد يود تحسينه بنبرة لطيفة. امنحه شعور الأمان والسرية.`;
  }

  buildButtons(focus) {
    const configured = this.config.couple_feedback?.buttons;
    if (configured?.length) return configured;
    return focus === 'gratitude'
      ? ['إيجابيات اليوم 🌟', 'أشارك لاحقاً ⏰']
      : ['احتاج أفضفض 📝', 'إيجابيات اليوم 🌟', 'أشارك لاحقاً ⏰'];
  }

  findPartner(guardians, guardian) {
    return guardians.find((member) => member.id !== guardian.id && member.role !== guardian.role) || null;
  }

  getFallbackMessage(guardian, partner, focus) {
    const partnerName = partner?.name || 'شريكك';
    if (focus === 'gratitude') {
      return `💌 ${guardian.name}، خذ دقيقة لكتابة شيئين تحبهما في ${partnerName} اليوم ثم جملة امتنان قصيرة. أرسلها لي وسأذكر ${partnerName} بلطف.`;
    }
    return `📝 ${guardian.name}، كيف تشعر تجاه ${partnerName} هذا الأسبوع؟ اذكر إيجابية واحدة وتحدياً واحداً، وسأساعدكما على تطوير الحوار.`;
  }

  getActiveIssues(familyId) {
    if (!familyId) return [];
    let db;
    try {
      db = getDatabase();
      const rows = db.prepare(`
        SELECT i.issue_type, i.issue_title, i.status, c.name AS child_name
        FROM child_issues i
        INNER JOIN children c ON c.id = i.child_id
        WHERE i.family_id = ? AND i.status IN ('active', 'monitoring')
        ORDER BY i.updated_at DESC
        LIMIT 5
      `).all(familyId);
      return rows;
    } catch (error) {
      console.warn('CoupleInsightService: failed to load issues', error.message);
      return [];
    } finally {
      if (db) {
        try {
          db.close();
        } catch (error) {
          console.warn('CoupleInsightService: failed to close db', error.message);
        }
      }
    }
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

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export default CoupleInsightService;
