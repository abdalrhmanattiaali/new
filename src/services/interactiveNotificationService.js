import {
  FamilyModel,
  GuardianModel,
  ChildModel,
  InteractiveNotificationModel,
  ConversationSessionModel
} from '../database/models.js';
import { getDatabase } from '../database/init.js';
import { LLMService } from '../ai/llm.js';
import InteractiveDialogueService from './interactiveDialogueService.js';

export class InteractiveNotificationService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
    this.dialogue = new InteractiveDialogueService(bot, config);
  }

  async evaluateAndDispatch() {
    if (this.config.interactive_notifications?.enabled === false) {
      return;
    }

    const families = FamilyModel.getAll() || [];
    for (const family of families) {
      if (!family.onboarding_completed) continue;

      const guardians = (GuardianModel.getByFamily(family.id) || []).filter(
        (guardian) => guardian.notification_enabled !== 0 && guardian.phone_number
      );
      if (!guardians.length) continue;

      const limit = this.config.interactive_notifications?.max_per_day ?? 3;
      if (InteractiveNotificationModel.countForFamilyToday(family.id) >= limit) {
        continue;
      }

      const minGap = this.config.interactive_notifications?.min_gap_minutes ?? 90;
      if (InteractiveNotificationModel.lastSentWithinMinutes(family.id, minGap)) {
        continue;
      }

      const context = await this.buildFamilyContext(family, guardians);
      let decision;
      try {
        decision = await this.llm.evaluateInteractiveNotification(context);
      } catch (error) {
        console.warn('InteractiveNotificationService: AI decision failed', error.message);
        continue;
      }

      if (!decision?.send) {
        continue;
      }

      const targets = this.resolveTargets(decision.target, guardians);
      if (!targets.length) continue;

      const buttons = this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰', 'بدّل التوقيت 🔄', 'تخطي ⏭️'];
      for (const guardian of targets) {
        await this.bot.sendMessageWithButtons(guardian.phone_number, decision.message, buttons);
        InteractiveNotificationModel.log({
          familyId: family.id,
          guardianId: guardian.id,
          topic: decision.topic || decision.sessionType || 'interactive',
          aiReason: decision.reason || 'contextual_support',
          messageText: decision.message,
          payload: decision
        });
      }

      const participantIds = targets.map((guardian) => guardian.id);
      const session = this.dialogue.ensureSession({
        familyId: family.id,
        type: decision.sessionType || 'interactive_notification',
        topic: decision.topic || 'adaptive_support',
        participants: participantIds,
        metadata: { reason: decision.reason, urgency: decision.urgency }
      });
      await this.dialogue.appendAssistantMessage(session, decision.message);
    }
  }

  async buildFamilyContext(family, guardians) {
    const children = ChildModel.getByFamily(family.id) || [];
    const coupleNotes = this.getCoupleInsights(family.id);
    const issues = this.getActiveIssues(family.id);
    const sessions = ConversationSessionModel.getOpenByFamily(family.id) || [];

    return {
      familyName: family.family_name,
      timezone: family.timezone,
      guardians: guardians.map((guardian) => ({
        id: guardian.id,
        name: guardian.name,
        role: guardian.role,
        preferred_time: guardian.preferred_time
      })),
      children: children.map((child) => ({
        name: child.name,
        birth_date: child.birth_date,
        development_stage: child.development_stage
      })),
      coupleNotes,
      issues,
      openSessions: sessions.map((session) => ({ type: session.type, topic: session.topic, updated_at: session.updated_at })),
      config: {
        tone: this.config.interactive_notifications?.tone || 'empathetic',
        topics: this.config.interactive_notifications?.topics || []
      }
    };
  }

  getActiveIssues(familyId) {
    try {
      const db = getDatabase();
      return db.prepare(`
        SELECT issue_type, issue_title, status, updated_at
        FROM child_issues
        WHERE family_id = ? AND status IN ('active', 'monitoring')
        ORDER BY updated_at DESC
        LIMIT 5
      `).all(familyId);
    } catch (error) {
      console.warn('InteractiveNotificationService: failed to load issues', error.message);
      return [];
    }
  }

  getCoupleInsights(familyId) {
    try {
      const db = getDatabase();
      return db.prepare(`
        SELECT sentiment, positives_text, challenges_text, gratitude_text, created_at
        FROM couple_feedback_logs
        WHERE family_id = ?
        ORDER BY created_at DESC
        LIMIT 6
      `).all(familyId);
    } catch (error) {
      console.warn('InteractiveNotificationService: failed to load couple insights', error.message);
      return [];
    }
  }

  resolveTargets(target, guardians) {
    if (!target || target === 'both') return guardians;
    if (target === 'father') return guardians.filter((g) => g.role === 'father');
    if (target === 'mother') return guardians.filter((g) => g.role === 'mother');
    return guardians;
  }
}

export default InteractiveNotificationService;
