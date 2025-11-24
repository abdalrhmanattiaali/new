/**
 * Database Models and Helper Functions
 * نماذج قاعدة البيانات ودوال مساعدة
 */

import { getDatabase } from './init.js';
import { createHash } from 'crypto';
import { format } from 'date-fns';

/**
 * Family Model
 */
export class FamilyModel {
  static create(familyName, timezone = 'Africa/Cairo', language = 'ar') {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO families (family_name, timezone, language)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(familyName, timezone, language);
    return result.lastInsertRowid;
  }

  static getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM families WHERE id = ?').get(id);
  }

  static updateOnboarding(id, completed = true) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE families
      SET onboarding_completed = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(completed ? 1 : 0, id);
  }

  static getAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM families').all();
  }
}

/**
 * Guardian Model
 */
export class GuardianModel {
  static create(familyId, name, role, phoneNumber, preferredTime = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO guardians (family_id, name, role, phone_number, preferred_time)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(familyId, name, role, phoneNumber, preferredTime);
    return result.lastInsertRowid;
  }

  static getAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM guardians').all();
  }

  static getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM guardians WHERE id = ?').get(id);
  }

  static getByPhoneNumber(phoneNumber) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM guardians WHERE phone_number = ?').get(phoneNumber);
  }

  static getByFamily(familyId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM guardians WHERE family_id = ?').all(familyId);
  }

  static updatePreferredTime(id, time) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE guardians
      SET preferred_time = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(time, id);
  }
}

/**
 * Guardian Presence Log Model
 */
export class GuardianPresenceLogModel {
  static create(guardianId, status, notes = null, source = 'manual') {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO guardian_presence_logs (guardian_id, status, notes, source)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(guardianId, status, notes, source);
  }

  static getLatest(guardianId) {
    const db = getDatabase();
    return db
      .prepare(
        'SELECT * FROM guardian_presence_logs WHERE guardian_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(guardianId);
  }

  static hasRecentEntry(guardianId, hours = 8) {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT 1 FROM guardian_presence_logs
         WHERE guardian_id = ? AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(guardianId, `-${hours} hours`);
  }
}

/**
 * Child Model
 */
export class ChildModel {
  static create(familyId, name, birthDate, allergies = null, healthNotes = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO children (family_id, name, birth_date, allergies, health_notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(familyId, name, birthDate, allergies, healthNotes);
    return result.lastInsertRowid;
  }

  static getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM children WHERE id = ?').get(id);
  }

  static getByFamily(familyId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM children WHERE family_id = ?').all(familyId);
  }

  static updateDevelopmentStage(id, stage) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE children
      SET development_stage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(stage, id);
  }
}

/**
 * Interaction Model
 */
export class InteractionModel {
  static create(familyId, guardianId, messageType, messageContent, buttonClicked = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO interactions (family_id, guardian_id, message_type, message_content, button_clicked, clicked_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(familyId, guardianId, messageType, messageContent, buttonClicked);
    return result.lastInsertRowid;
  }

  static updateButtonClick(id, buttonClicked, responseTimeSeconds) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE interactions
      SET button_clicked = ?, clicked_at = CURRENT_TIMESTAMP, response_time_seconds = ?
      WHERE id = ?
    `);
    return stmt.run(buttonClicked, responseTimeSeconds, id);
  }

  static getByGuardian(guardianId, limit = 50) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM interactions
      WHERE guardian_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(guardianId, limit);
  }

  static getByFamily(familyId, limit = 50) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM interactions
      WHERE family_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(familyId, limit);
  }

  static getFamilyNotificationStats(familyId, messageType = null, windowDays = 30) {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT message_type, created_at FROM interactions
         WHERE family_id = ?
         ORDER BY created_at DESC
         LIMIT 600`
      )
      .all(familyId);

    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    const typeCounts = {};
    let recentCount = 0;

    rows.forEach((row) => {
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : null;

      if (!typeCounts[row.message_type]) {
        typeCounts[row.message_type] = {
          count: 0,
          lastSentAt: row.created_at || null,
          recent: 0
        };
      }

      typeCounts[row.message_type].count += 1;

      if (createdAt && now - createdAt <= windowMs) {
        typeCounts[row.message_type].recent += 1;
        recentCount += 1;
      }
    });

    const lastSentAt = rows[0]?.created_at || null;
    const nextSequenceForType = messageType
      ? (typeCounts[messageType]?.count || 0) + 1
      : null;

    return {
      totalSent: rows.length,
      lastSentAt,
      recentWindowDays: windowDays,
      recentCount,
      typeCounts,
      nextSequenceForType
    };
  }

  static getStats(guardianId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT
        COUNT(*) as total_interactions,
        SUM(CASE WHEN button_clicked IS NOT NULL THEN 1 ELSE 0 END) as responded,
        AVG(response_time_seconds) as avg_response_time
      FROM interactions
      WHERE guardian_id = ?
    `).get(guardianId);
  }

  static getRecentNotificationDigest(familyId, limit = 30) {
    const db = getDatabase();
    const rows = db.prepare(
      `SELECT id, message_type, message_content, created_at
       FROM interactions
       WHERE family_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(familyId, limit);

    return rows.map((row) => ({
      id: row.id,
      message_type: row.message_type || 'general',
      created_at: row.created_at,
      message_content: row.message_content || ''
    }));
  }
}

/**
 * Conversation Session Model
 */
export class ConversationSessionModel {
  static create({ familyId, type, topic = null, participants = [], metadata = {} }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO conversation_sessions (family_id, type, topic, participants, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      familyId,
      type,
      topic,
      JSON.stringify(participants || []),
      JSON.stringify(metadata || {})
    );
    return this.getById(result.lastInsertRowid);
  }

  static updateMetadata(id, metadata = {}) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE conversation_sessions
      SET metadata = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(JSON.stringify(metadata || {}), id);
    return this.getById(id);
  }

  static updateParticipants(id, participants = []) {
    const db = getDatabase();
    db.prepare(`
      UPDATE conversation_sessions
      SET participants = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(participants || []), id);
  }

  static updateStatus(id, status = 'closed') {
    const db = getDatabase();
    db.prepare(`
      UPDATE conversation_sessions
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);
  }

  static touch(id) {
    const db = getDatabase();
    db.prepare(`
      UPDATE conversation_sessions
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
  }

  static getById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM conversation_sessions WHERE id = ?').get(id);
  }

  static getOpenByFamily(familyId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM conversation_sessions
      WHERE family_id = ? AND status = 'open'
      ORDER BY updated_at DESC
    `).all(familyId);
  }
}

/**
 * Conversation Messages Model
 */
export class ConversationMessageModel {
  static log({ sessionId, authorType, guardianId = null, message }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO conversation_messages (session_id, author_type, guardian_id, message_content)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(sessionId, authorType, guardianId, message);
  }

  static getBySession(sessionId, limit = 50) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM conversation_messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(sessionId, limit);
  }
}

/**
 * Interactive Notification Model
 */
export class InteractiveNotificationModel {
  static log({ familyId, guardianId = null, topic = null, aiReason = null, messageText = null, payload = {} }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO interactive_notifications (family_id, guardian_id, topic, ai_reason, message_text, decision_payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(familyId, guardianId, topic, aiReason, messageText, JSON.stringify(payload || {}));
  }

  static countForFamilyToday(familyId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT COUNT(*) as total
      FROM interactive_notifications
      WHERE family_id = ? AND DATE(sent_at) = DATE('now', 'localtime')
    `).get(familyId);
    return row?.total || 0;
  }

  static lastSentWithinMinutes(familyId, minutes = 60) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT sent_at FROM interactive_notifications
      WHERE family_id = ?
      ORDER BY sent_at DESC
      LIMIT 1
    `).get(familyId);
    if (!row?.sent_at) return false;
    const sent = new Date(row.sent_at).getTime();
    return Date.now() - sent < minutes * 60 * 1000;
  }
}

/**
 * AI Profile Model
 */
export class AIProfileModel {
  static create(guardianId) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO ai_profiles (guardian_id, content_affinity)
      VALUES (?, '{}')
    `);
    const result = stmt.run(guardianId);
    return result.lastInsertRowid;
  }

  static getByGuardian(guardianId) {
    const db = getDatabase();
    let profile = db.prepare('SELECT * FROM ai_profiles WHERE guardian_id = ?').get(guardianId);

    if (!profile) {
      // Create if doesn't exist
      this.create(guardianId);
      profile = db.prepare('SELECT * FROM ai_profiles WHERE guardian_id = ?').get(guardianId);
    }

    return profile;
  }

  static updateBestSendTime(guardianId, time) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE ai_profiles
      SET best_send_time = ?, last_updated = CURRENT_TIMESTAMP
      WHERE guardian_id = ?
    `);
    return stmt.run(time, guardianId);
  }

  static updateContentAffinity(guardianId, affinityJson) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE ai_profiles
      SET content_affinity = ?, last_updated = CURRENT_TIMESTAMP
      WHERE guardian_id = ?
    `);
    return stmt.run(affinityJson, guardianId);
  }
}

/**
 * Weekend Plan Model
 */
let weekendPreviewColumnChecked = false;

export class WeekendPlanModel {
  static create(familyId, weekStartDate, movies, outings, checklist, homeAlternative) {
    this.ensurePreviewColumn();
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO weekend_plans (family_id, week_start_date, movies, outings, checklist, home_alternative)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      familyId,
      weekStartDate,
      JSON.stringify(movies),
      JSON.stringify(outings),
      JSON.stringify(checklist),
      JSON.stringify(homeAlternative)
    );
    return result.lastInsertRowid;
  }

  static getByWeek(familyId, weekStartDate) {
    this.ensurePreviewColumn();
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM weekend_plans
      WHERE family_id = ? AND week_start_date = ?
    `).get(familyId, weekStartDate);
  }

  static markAsSent(id) {
    this.ensurePreviewColumn();
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE weekend_plans
      SET sent = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  static markPreviewSent(id) {
    this.ensurePreviewColumn();
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE weekend_plans
      SET preview_sent = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  static ensurePreviewColumn() {
    if (weekendPreviewColumnChecked) return;
    const db = getDatabase();
    const columns = db.prepare('PRAGMA table_info(weekend_plans)').all();
    const hasColumn = columns.some((column) => column.name === 'preview_sent');
    if (!hasColumn) {
      try {
        db.exec('ALTER TABLE weekend_plans ADD COLUMN preview_sent INTEGER DEFAULT 0');
      } catch (error) {
        console.error('Failed to add preview_sent column:', error.message);
      }
    }
    weekendPreviewColumnChecked = true;
  }
}

export class ParentResourceLogModel {
  static log(familyId, resourceType, title, metadata = {}) {
    const db = getDatabase();
    const stmt = db.prepare(
      `INSERT INTO parent_resource_logs (family_id, resource_type, title, metadata)
       VALUES (?, ?, ?, ?)`
    );

    return stmt.run(familyId, resourceType, title || null, JSON.stringify(metadata || {}));
  }

  static getLastSent(familyId, resourceType) {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT * FROM parent_resource_logs
         WHERE family_id = ? AND resource_type = ?
         ORDER BY sent_at DESC
         LIMIT 1`
      )
      .get(familyId, resourceType);

    if (!row) return null;
    try {
      return { ...row, metadata: row.metadata ? JSON.parse(row.metadata) : {} };
    } catch (error) {
      console.error('Failed to parse parent resource metadata:', error);
      return { ...row, metadata: {} };
    }
  }
}

/**
 * Daily Tracking Model
 */
export class DailyTrackingModel {
  static upsert(childId, date, data) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO daily_tracking (
        child_id, tracking_date, sleep_quality, sleep_hours,
        nutrition_quality, meals_eaten, mood, play_minutes,
        language_activities, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(child_id, tracking_date) DO UPDATE SET
        sleep_quality = excluded.sleep_quality,
        sleep_hours = excluded.sleep_hours,
        nutrition_quality = excluded.nutrition_quality,
        meals_eaten = excluded.meals_eaten,
        mood = excluded.mood,
        play_minutes = excluded.play_minutes,
        language_activities = excluded.language_activities,
        notes = excluded.notes
    `);

    return stmt.run(
      childId,
      date,
      data.sleepQuality || null,
      data.sleepHours || null,
      data.nutritionQuality || null,
      data.mealsEaten || null,
      data.mood || null,
      data.playMinutes || null,
      data.languageActivities || null,
      data.notes || null
    );
  }

  static getByChild(childId, startDate, endDate) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM daily_tracking
      WHERE child_id = ? AND tracking_date BETWEEN ? AND ?
      ORDER BY tracking_date DESC
    `).all(childId, startDate, endDate);
  }

  static getWeeklySummary(childId, weekStartDate) {
    const db = getDatabase();
    return db.prepare(`
      SELECT
        AVG(sleep_hours) as avg_sleep_hours,
        SUM(CASE WHEN sleep_quality = 'good' THEN 1 ELSE 0 END) as good_sleep_days,
        SUM(CASE WHEN nutrition_quality = 'good' THEN 1 ELSE 0 END) as good_nutrition_days,
        AVG(play_minutes) as avg_play_minutes,
        SUM(language_activities) as total_language_activities
      FROM daily_tracking
      WHERE child_id = ? AND tracking_date >= ? AND tracking_date < date(?, '+7 days')
    `).get(childId, weekStartDate, weekStartDate);
  }
}

/**
 * Scheduled Message Model
 */
export class ScheduledMessageModel {
  static create(familyId, guardianId, messageType, content, scheduledTime, buttons = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO scheduled_messages (family_id, guardian_id, message_type, message_content, scheduled_time, buttons)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      familyId,
      guardianId,
      messageType,
      content,
      scheduledTime,
      buttons ? JSON.stringify(buttons) : null
    );
    return result.lastInsertRowid;
  }

  static getPending(currentTime) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM scheduled_messages
      WHERE sent = 0 AND scheduled_time <= ?
      ORDER BY scheduled_time ASC
    `).all(currentTime);
  }

  static markAsSent(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE scheduled_messages
      SET sent = 1, sent_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  static deleteOld(daysOld = 30) {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM scheduled_messages
      WHERE sent = 1 AND sent_at < datetime('now', '-' || ? || ' days')
    `);
    return stmt.run(daysOld);
  }
}

/**
 * Unified Notification History Model
 */
export class NotificationHistoryModel {
  static record({
    familyId,
    guardianId,
    messageType,
    content,
    scheduledTime = null,
    slotLabel = null,
    metadata = null,
    scheduledMessageId = null
  }) {
    const db = getDatabase();
    const sequence = this.nextSequence(familyId, messageType);
    const stmt = db.prepare(`
      INSERT INTO notification_history (
        family_id, guardian_id, message_type, sequence, status, content,
        scheduled_message_id, scheduled_time, slot_label, metadata
      )
      VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      familyId,
      guardianId || null,
      messageType,
      sequence,
      content || null,
      scheduledMessageId || null,
      scheduledTime || null,
      slotLabel || null,
      metadata ? JSON.stringify(metadata) : null
    );

    return result.lastInsertRowid;
  }

  static nextSequence(familyId, messageType) {
    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT COALESCE(MAX(sequence), 0) + 1 AS nextSeq
         FROM notification_history
         WHERE family_id = ? AND message_type = ?`
      )
      .get(familyId, messageType);
    return row?.nextSeq || 1;
  }

  static linkScheduled(historyId, scheduledMessageId) {
    if (!historyId || !scheduledMessageId) return;
    const db = getDatabase();
    db.prepare(
      `UPDATE notification_history
       SET scheduled_message_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(scheduledMessageId, historyId);
  }

  static markSentByScheduledId(scheduledMessageId) {
    if (!scheduledMessageId) return;
    const db = getDatabase();
    db.prepare(
      `UPDATE notification_history
       SET status = 'sent', sent_at = CURRENT_TIMESTAMP
       WHERE scheduled_message_id = ?`
    ).run(scheduledMessageId);
  }

  static getStats(familyId) {
    const db = getDatabase();
    const totalRow = db
      .prepare(
        `SELECT COUNT(*) as total
         FROM notification_history
         WHERE family_id = ?`
      )
      .get(familyId);

    const byTypeRows = db
      .prepare(
        `SELECT message_type, COUNT(*) as count, MAX(sent_at) as last_sent
         FROM notification_history
         WHERE family_id = ?
         GROUP BY message_type`
      )
      .all(familyId);

    const typeCounts = {};
    byTypeRows.forEach(row => {
      typeCounts[row.message_type] = {
        count: row.count,
        lastSent: row.last_sent
      };
    });

    return { total: totalRow?.total || 0, typeCounts };
  }

  static getRecentDigest(familyId, limit = 12) {
    const db = getDatabase();
    const rows = db
      .prepare(
        `SELECT message_type, sequence, status, content,
                COALESCE(sent_at, scheduled_time, created_at) as ts
         FROM notification_history
         WHERE family_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(familyId, limit);

    return rows.map(row => ({
      message_type: row.message_type,
      sequence: row.sequence,
      status: row.status,
      ts: row.ts ? format(new Date(row.ts), 'yyyy-MM-dd HH:mm') : null,
      snippet: this.truncateText(row.content)
    }));
  }

  static getSnapshot(familyId, limit = 12) {
    return {
      digest: this.getRecentDigest(familyId, limit),
      stats: this.getStats(familyId)
    };
  }

  static truncateText(text, max = 140) {
    if (!text) return '';
    const clean = `${text}`.replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max)}…`;
  }
}

/**
 * Child Audio Story Model
 */
export class ChildAudioStoryModel {
  static create({
    childId,
    familyId,
    storyTitle,
    storySummary = null,
    storyText,
    durationSeconds = null,
    voiceId = null,
    modelId = null,
    generatedFor
  }) {
    const db = getDatabase();

    const storyHash = createHash('sha256').update(storyText).digest('hex');

    const stmt = db.prepare(`
      INSERT INTO child_audio_stories (
        child_id, family_id, story_title, story_summary, story_text,
        story_hash, duration_seconds, voice_id, model_id, generated_for
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      childId,
      familyId,
      storyTitle,
      storySummary,
      storyText,
      storyHash,
      durationSeconds,
      voiceId,
      modelId,
      generatedFor
    );

    return result.lastInsertRowid;
  }

  static getByChildAndDate(childId, date) {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT * FROM child_audio_stories WHERE child_id = ? AND generated_for = ?`
      )
      .get(childId, date);
  }

  static getRecent(childId, { limit = 5, sinceDate = null } = {}) {
    const db = getDatabase();

    if (sinceDate) {
      return db
        .prepare(
          `SELECT *
           FROM child_audio_stories
           WHERE child_id = ? AND generated_for >= ?
           ORDER BY generated_for DESC
           LIMIT ?`
        )
        .all(childId, sinceDate, limit);
    }

    return db
      .prepare(
        `SELECT *
         FROM child_audio_stories
         WHERE child_id = ?
         ORDER BY generated_for DESC
         LIMIT ?`
      )
      .all(childId, limit);
  }

  static findByHash(childId, storyText) {
    const db = getDatabase();
    const storyHash = createHash('sha256').update(storyText).digest('hex');
    return db
      .prepare(
        `SELECT * FROM child_audio_stories WHERE child_id = ? AND story_hash = ?`
      )
      .get(childId, storyHash);
  }
}

/**
 * Couple Feedback Model
 */
export class CoupleFeedbackModel {
  static logEntry({
    familyId,
    guardianId,
    partnerRole = null,
    sentiment = 'neutral',
    positivesText = '',
    challengesText = '',
    gratitudeText = '',
    source = 'manual',
    aiSummary = null,
    followupNeeded = 0
  }) {
    if (!familyId || !guardianId) {
      return null;
    }

    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO couple_feedback_logs (
        family_id, guardian_id, partner_role, sentiment,
        positives_text, challenges_text, gratitude_text,
        source, ai_summary, followup_needed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      familyId,
      guardianId,
      partnerRole,
      sentiment,
      positivesText || null,
      challengesText || null,
      gratitudeText || null,
      source,
      aiSummary || null,
      followupNeeded ? 1 : 0
    );

    return result.lastInsertRowid;
  }

  static getRecentByFamily(familyId, limit = 8) {
    if (!familyId) return [];
    const db = getDatabase();
    return db
      .prepare(
        `SELECT *
         FROM couple_feedback_logs
         WHERE family_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(familyId, limit);
  }

  static getRecentByGuardian(guardianId, limit = 6) {
    if (!guardianId) return [];
    const db = getDatabase();
    return db
      .prepare(
        `SELECT *
         FROM couple_feedback_logs
         WHERE guardian_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(guardianId, limit);
  }
}

/**
 * Spiritual Routine Log Model
 */
export class SpiritualRoutineLogModel {
  static wasScheduled(familyId, routineId, scheduledFor) {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT id FROM spiritual_routine_logs WHERE family_id = ? AND routine_id = ? AND scheduled_for = ?`
      )
      .get(familyId, routineId, scheduledFor);
  }

  static logSchedule({ familyId, guardianId = null, routineId, scheduledFor, scheduledMessageId = null }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO spiritual_routine_logs (family_id, guardian_id, routine_id, scheduled_for, scheduled_message_id)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(familyId, guardianId, routineId, scheduledFor, scheduledMessageId);
    return result.lastInsertRowid;
  }

  static markDeliveredByScheduledMessage(scheduledMessageId) {
    if (!scheduledMessageId) return;
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE spiritual_routine_logs
      SET delivered = 1, delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE scheduled_message_id = ?
    `);
    stmt.run(scheduledMessageId);
  }

  static getRecentForFamily(familyId, limit = 20) {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT *
         FROM spiritual_routine_logs
         WHERE family_id = ?
         ORDER BY scheduled_for DESC, created_at DESC
         LIMIT ?`
      )
      .all(familyId, limit);
  }
}

/**
 * Spiritual Custom Request Model
 */
export class SpiritualCustomRequestModel {
  static create({ familyId, guardianId, childId = null, requestText, aiResponse = null, audioUrl = null }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO spiritual_custom_requests (family_id, guardian_id, child_id, request_text, ai_response, audio_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(familyId, guardianId, childId, requestText, aiResponse, audioUrl);
    return result.lastInsertRowid;
  }

  static updateResponse(id, aiResponse, audioUrl = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE spiritual_custom_requests
      SET ai_response = ?, audio_url = ?, created_at = created_at
      WHERE id = ?
    `);
    stmt.run(aiResponse, audioUrl, id);
  }

  static getRecentByGuardian(guardianId, limit = 10) {
    const db = getDatabase();
    return db
      .prepare(
        `SELECT *
         FROM spiritual_custom_requests
         WHERE guardian_id = ?
         ORDER BY created_at DESC
         LIMIT ?`
      )
      .all(guardianId, limit);
  }
}

export default {
  FamilyModel,
  GuardianModel,
  ChildModel,
  InteractionModel,
  AIProfileModel,
  WeekendPlanModel,
  DailyTrackingModel,
  ScheduledMessageModel,
  ChildAudioStoryModel,
  CoupleFeedbackModel,
  SpiritualRoutineLogModel,
  SpiritualCustomRequestModel
};
