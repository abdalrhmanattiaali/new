import { differenceInHours, formatDistanceToNow, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { GuardianPresenceLogModel } from '../database/models.js';

export default class PresenceService {
  getLatestStatus(guardianId) {
    return GuardianPresenceLogModel.getLatest(guardianId);
  }

  recordStatus(guardianId, status, notes = '', source = 'manual') {
    const normalized = status === 'home' ? 'home' : 'away';
    return GuardianPresenceLogModel.create(guardianId, normalized, notes, source);
  }

  needsRefresh(guardianId, hours = 8) {
    const recent = GuardianPresenceLogModel.hasRecentEntry(guardianId, hours);
    return !recent;
  }

  buildContext(guardianId) {
    const latest = this.getLatestStatus(guardianId);
    if (!latest) {
      return {
        status: 'unknown',
        summary: 'لا يوجد سجل تواجد، اسأله أين هو الآن لإعداد نصيحة مناسبة.',
        description:
          'اطلب من الأب أن يخبرك إن كان في البيت أو خارجه حتى تضبط النصائح على وضعه الحالي.'
      };
    }

    const createdAt = typeof latest.created_at === 'string' ? parseISO(latest.created_at) : latest.created_at;
    const hoursAgo = createdAt ? differenceInHours(new Date(), createdAt) : null;
    const since = createdAt
      ? formatDistanceToNow(createdAt, { addSuffix: true, locale: ar })
      : 'منذ قليل';

    const status = latest.status === 'home' ? 'home' : 'away';
    const summary = status === 'home' ? `آخر تحديث: في البيت (${since})` : `آخر تحديث: خارج المنزل (${since})`;

    const description =
      status === 'home'
        ? 'الأب متواجد بالبيت الآن؛ اقترح تفاعلات مباشرة ودعم للأم وشعور بالامتنان.'
        : 'الأب خارج المنزل؛ قدم أفكار دعم عن بعد، كلمات تقدير لتعبه، وربط زوجته بأن غيابه لصالح العائلة.';

    return { status, summary, description, hoursAgo };
  }

  buildPromptIfNeeded(guardianId, guardianName, childName) {
    if (!this.needsRefresh(guardianId, 8)) return null;

    const name = guardianName || 'الأب';
    const child = childName || 'الطفل';

    return `
💬 *تحديث سريع للأب ${name}*

أخبرني بسطر واحد:
- هل أنت في البيت الآن أم خارج المنزل؟
- لو برة، راجع إمتى تقريباً؟

كلما عرفت وضعك الحالي أقدر أرسل لك نصائح تناسب وجودك مع ${child} أو دعمك من بعيد. 💙
    `.trim();
  }
}
