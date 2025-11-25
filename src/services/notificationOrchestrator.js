import { format } from 'date-fns';
import manifest from '../../config/notification_manifest.json' assert { type: 'json' };
import { NotificationHistoryModel, ScheduledMessageModel } from '../database/models.js';

/**
 * Unified notification orchestrator that validates types, records history,
 * and ensures every scheduled message is tracked with digest-friendly context.
 */
export class NotificationOrchestrator {
  constructor(config = {}) {
    this.config = config;
    this.allowedPatterns = [...(manifest.allowed_patterns || [])];
    if (Array.isArray(config.notifications?.allowed_patterns)) {
      this.allowedPatterns.push(...config.notifications.allowed_patterns);
    }
  }

  isAllowed(messageType) {
    if (!messageType) return false;
    return this.allowedPatterns.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return messageType.startsWith(prefix);
      }
      return pattern === messageType;
    });
  }

  normalizeTime(time) {
    if (!time) return null;
    if (typeof time === 'string') return time;
    try {
      return format(time, 'yyyy-MM-dd HH:mm:ss');
    } catch (err) {
      return null;
    }
  }

  schedule({
    familyId,
    guardianId,
    messageType,
    content,
    scheduledTime,
    buttons = [],
    slotLabel = null,
    metadata = null
  }) {
    if (!this.isAllowed(messageType)) {
      console.warn(`🚫 Skipping notification type ${messageType} (not in manifest)`);
      return null;
    }

    const normalizedTime = this.normalizeTime(scheduledTime);
    const historyId = NotificationHistoryModel.record({
      familyId,
      guardianId,
      messageType,
      content,
      scheduledTime: normalizedTime,
      slotLabel,
      metadata,
      scheduledMessageId: null
    });

    const scheduledId = ScheduledMessageModel.create(
      familyId,
      guardianId,
      messageType,
      content,
      normalizedTime,
      buttons
    );

    NotificationHistoryModel.linkScheduled(historyId, scheduledId);
    return scheduledId;
  }

  markSent(scheduledMessageId) {
    NotificationHistoryModel.markSentByScheduledId(scheduledMessageId);
  }

  getSnapshot(familyId, limit = 12) {
    return NotificationHistoryModel.getSnapshot(familyId, limit);
  }
}

export default NotificationOrchestrator;
