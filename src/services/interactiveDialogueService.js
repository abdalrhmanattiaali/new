import {
  ConversationSessionModel,
  ConversationMessageModel,
  GuardianModel,
  FamilyModel,
  ChildModel,
  CoupleFeedbackModel,
  InteractionModel
} from '../database/models.js';
import { getDatabase } from '../database/init.js';
import { LLMService } from '../ai/llm.js';

export class InteractiveDialogueService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
  }

  getActiveSessionForGuardian(guardian) {
    if (!guardian?.family_id) return null;
    const sessions = ConversationSessionModel.getOpenByFamily(guardian.family_id) || [];
    return sessions.find((session) => this.sessionIncludesGuardian(session, guardian.id)) || null;
  }

  ensureSession({ familyId, type, topic, participants = [], metadata = {} }) {
    const openSessions = ConversationSessionModel.getOpenByFamily(familyId) || [];
    const existing = openSessions.find((session) => session.type === type && (!topic || session.topic === topic));
    if (existing) {
      const combined = this.mergeParticipants(existing, participants);
      if (combined.changed) {
        ConversationSessionModel.updateParticipants(existing.id, combined.ids);
      }
      if (metadata && Object.keys(metadata).length) {
        ConversationSessionModel.updateMetadata(existing.id, {
          ...(this.safeJSON(existing.metadata) || {}),
          ...metadata
        });
      }
      return ConversationSessionModel.getById(existing.id);
    }

    const session = ConversationSessionModel.create({
      familyId,
      type,
      topic,
      participants,
      metadata
    });
    return session;
  }

  async recordGuardianMessage(session, guardian, text) {
    ConversationMessageModel.log({
      sessionId: session.id,
      authorType: 'guardian',
      guardianId: guardian.id,
      message: text
    });
    await this.ensureGuardianInSession(session, guardian.id);
    ConversationSessionModel.touch(session.id);
  }

  async appendAssistantMessage(session, text) {
    ConversationMessageModel.log({
      sessionId: session.id,
      authorType: 'assistant',
      message: text
    });
    ConversationSessionModel.touch(session.id);
  }

  async respond(session, guardian, latestText, { channel = 'general' } = {}) {
    const family = FamilyModel.getById(session.family_id);
    const children = ChildModel.getByFamily(session.family_id) || [];
    const coupleInsights = CoupleFeedbackModel.getRecentByFamily
      ? CoupleFeedbackModel.getRecentByFamily(session.family_id, 6)
      : [];
    const activeIssues = this.getActiveChildIssues(session.family_id);
    const history = ConversationMessageModel.getBySession(session.id, 20).reverse();
    const interactions = InteractionModel.getByFamily
      ? InteractionModel.getByFamily(session.family_id, 20)
      : [];

    const context = {
      sessionType: session.type,
      topic: session.topic,
      guardianName: guardian.name,
      guardianRole: guardian.role,
      participants: this.getParticipantProfiles(session),
      latestMessage: latestText,
      childSnapshot: children.map((child) => ({
        name: child.name,
        birth_date: child.birth_date,
        stage: child.development_stage
      })),
      history,
      coupleInsights,
      activeIssues,
      channel,
      interactions
    };

    const aiResult = await this.llm.generateDialogueExchange(context);
    if (!aiResult?.reply) {
      return null;
    }

    const finalMessage = aiResult.follow_up
      ? `${aiResult.reply}\n\n${aiResult.follow_up}`
      : aiResult.reply;

    await this.appendAssistantMessage(session, finalMessage);

    const recipients = this.getParticipantGuardians(session);
    await Promise.all(
      recipients.map((recipient) =>
        recipient?.phone_number
          ? this.bot.sendMessageWithButtons(
              recipient.phone_number,
              finalMessage,
              this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰', 'بدّل التوقيت 🔄', 'تخطي ⏭️']
            )
          : Promise.resolve()
      )
    );

    if (aiResult.close_session) {
      ConversationSessionModel.updateStatus(session.id, 'closed');
    }

    return finalMessage;
  }

  closeSession(session) {
    if (!session) return;
    ConversationSessionModel.updateStatus(session.id, 'closed');
  }

  async ensureGuardianInSession(session, guardianId) {
    const participants = this.safeJSON(session.participants) || [];
    if (participants.includes(guardianId)) return;
    const updated = [...participants, guardianId];
    ConversationSessionModel.updateParticipants(session.id, updated);
  }

  mergeParticipants(session, newParticipants = []) {
    const participants = this.safeJSON(session.participants) || [];
    let changed = false;
    for (const id of newParticipants) {
      if (id && !participants.includes(id)) {
        participants.push(id);
        changed = true;
      }
    }
    return { ids: participants, changed };
  }

  getParticipantProfiles(session) {
    const participants = this.getParticipantGuardians(session);
    return participants.map((guardian) => ({
      id: guardian?.id,
      name: guardian?.name,
      role: guardian?.role,
      preferred_time: guardian?.preferred_time
    }));
  }

  getParticipantGuardians(session) {
    const ids = this.safeJSON(session.participants) || [];
    return ids
      .map((guardianId) => GuardianModel.getById(guardianId))
      .filter((guardian) => !!guardian);
  }

  sessionIncludesGuardian(session, guardianId) {
    const ids = this.safeJSON(session.participants) || [];
    return ids.includes(guardianId);
  }

  safeJSON(value) {
    if (!value) return null;
    try {
      return typeof value === 'string' ? JSON.parse(value) : value;
    } catch (error) {
      return null;
    }
  }

  getActiveChildIssues(familyId) {
    try {
      const db = getDatabase();
      const rows = db.prepare(`
        SELECT issue_type, issue_title, status
        FROM child_issues
        WHERE family_id = ? AND status IN ('active', 'monitoring')
        ORDER BY updated_at DESC
        LIMIT 5
      `).all(familyId);
      return rows || [];
    } catch (error) {
      console.warn('InteractiveDialogueService: failed to load child issues', error.message);
      return [];
    }
  }
}

export default InteractiveDialogueService;
