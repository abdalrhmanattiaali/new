/**
 * Database Models and Helper Functions
 * نماذج قاعدة البيانات ودوال مساعدة
 */

import { getDatabase } from './init.js';

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
export class WeekendPlanModel {
  static create(familyId, weekStartDate, movies, outings, checklist, homeAlternative) {
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
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM weekend_plans
      WHERE family_id = ? AND week_start_date = ?
    `).get(familyId, weekStartDate);
  }

  static markAsSent(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE weekend_plans
      SET sent = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
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

export default {
  FamilyModel,
  GuardianModel,
  ChildModel,
  InteractionModel,
  AIProfileModel,
  WeekendPlanModel,
  DailyTrackingModel,
  ScheduledMessageModel
};
