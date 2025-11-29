import { differenceInDays } from 'date-fns';
import {
  ChildModel,
  CoupleFeedbackModel,
  FamilyModel,
  GuardianModel,
  InferenceQuestionModel,
  NotificationHistoryModel
} from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import InteractiveDialogueService from './interactiveDialogueService.js';
import { getDatabase } from '../database/init.js';

export class InferenceQuestionService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
    this.dialogue = new InteractiveDialogueService(bot, config);
  }

  async runScheduledQuestions() {
    const settings = this.config.inference_questions || {};
    if (settings.enabled === false) return;

    const families = FamilyModel.getAll() || [];
    for (const family of families) {
      await this.generateForFamily(family, { settings });
    }
  }

  async startOnDemand(guardian, seedTopic) {
    const family = FamilyModel.getById(guardian.family_id);
    if (!family) return null;
    return this.generateForFamily(family, { force: true, seedTopic, requestedBy: guardian });
  }

  async generateForFamily(family, { settings = this.config.inference_questions || {}, force = false, seedTopic = null, requestedBy = null } = {}) {
    try {
      if (!family?.id) return null;
      if (!force && InferenceQuestionModel.hasRecentPending(family.id, settings.cooldown_hours || 12)) {
        return null;
      }

      const guardians = GuardianModel.getByFamily(family.id) || [];
      if (!guardians.length) return null;

      const context = this.buildContext({ family, guardians, seedTopic });
      const aiResult = await this.llm.generateInferenceQuestion(context);
      if (!aiResult?.question) return null;

      const recipients = this.pickRecipients(aiResult.target, guardians, requestedBy);
      if (!recipients.length) return null;

      const messageText = this.composeMessage(aiResult);
      const session = this.dialogue.ensureSession({
        familyId: family.id,
        type: 'inference_probe',
        topic: aiResult.topic || seedTopic || 'family_probe',
        participants: recipients.map((r) => r.id),
        metadata: {
          priority: aiResult.priority || 'medium',
          action_hint: aiResult.action_hint || null,
          seed: seedTopic || null
        }
      });

      await this.dialogue.appendAssistantMessage(session, messageText);

      const buttons = this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰', 'بدّل التوقيت 🔄', 'تخطي ⏭️'];
      await Promise.all(
        recipients
          .filter((r) => !!r.phone_number)
          .map((recipient) => this.bot.sendMessageWithButtons(recipient.phone_number, messageText, buttons))
      );

      InferenceQuestionModel.create({
        familyId: family.id,
        guardianId: recipients[0]?.id || null,
        topic: aiResult.topic || seedTopic,
        questionText: aiResult.question,
        followUp: aiResult.follow_up,
        aiPayload: aiResult,
        metadata: { requestedBy: requestedBy?.role || null }
      });

      NotificationHistoryModel.record({
        familyId: family.id,
        guardianId: recipients[0]?.id || null,
        messageType: 'inference_question',
        content: messageText,
        slotLabel: 'inference'
      });

      return messageText;
    } catch (error) {
      console.error('InferenceQuestionService error:', error.message);
      return null;
    }
  }

  buildContext({ family, guardians, seedTopic }) {
    const children = (ChildModel.getByFamily(family.id) || []).map((child) => ({
      ...child,
      day_of_life: child.birth_date ? differenceInDays(new Date(), new Date(child.birth_date)) : null
    }));

    const coupleInsights = CoupleFeedbackModel.getRecentByFamily
      ? CoupleFeedbackModel.getRecentByFamily(family.id, 5)
      : [];
    const notificationDigest = NotificationHistoryModel.getRecentDigest(family.id, 12);
    const activeIssues = this.getActiveChildIssues(family.id);

    return {
      familyName: family.family_name,
      guardians,
      children,
      notificationDigest,
      coupleInsights,
      activeIssues,
      seedTopic
    };
  }

  pickRecipients(target, guardians, requestedBy) {
    if (requestedBy) return [requestedBy];
    if (target === 'father') return guardians.filter((g) => g.role === 'father');
    if (target === 'mother') return guardians.filter((g) => g.role === 'mother');
    return guardians;
  }

  composeMessage(aiResult) {
    return `سؤال استنباطي سريع:\n${aiResult.question}${aiResult.follow_up ? `\n\n${aiResult.follow_up}` : ''}`;
  }

  getActiveChildIssues(familyId) {
    try {
      const db = getDatabase();
      return (
        db
          .prepare(
            `SELECT issue_type, issue_title, status
             FROM child_issues
             WHERE family_id = ? AND status IN ('active', 'monitoring')
             ORDER BY updated_at DESC
             LIMIT 6`
          )
          .all(familyId) || []
      );
    } catch (error) {
      console.warn('InferenceQuestionService: failed to load child issues', error.message);
      return [];
    }
  }
}

export default InferenceQuestionService;
