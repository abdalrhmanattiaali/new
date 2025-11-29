import http from 'http';
import { URL } from 'url';
import { format } from 'date-fns';
import { NotificationOrchestrator } from '../services/notificationOrchestrator.js';
import { FamilyModel, GuardianModel } from '../database/models.js';

export class HttpTriggerServer {
  constructor(config = {}) {
    this.config = config;
    this.server = null;
    this.orchestrator = new NotificationOrchestrator(config);
  }

  start() {
    const triggerConfig = this.config.http_trigger || {};
    if (!triggerConfig.enabled) return;

    const port = triggerConfig.port || 8080;
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        console.error('❌ HTTP trigger error:', err);
        this.sendJson(res, 500, { ok: false, error: err.message });
      });
    });

    this.server.listen(port, '0.0.0.0', () => {
      console.log(`🌐 HTTP trigger server listening on port ${port}`);
    });
  }

  async handleRequest(req, res) {
    const triggerConfig = this.config.http_trigger || {};
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');

    if (req.method !== 'GET') {
      this.sendJson(res, 405, { ok: false, message: 'Method not allowed' });
      return;
    }

    if (pathname === (triggerConfig.weekly_path || '/trigger/weekly-demo')) {
      const phone = searchParams.get('phone') || triggerConfig.default_number;
      const fast = searchParams.get('fast') === '1';

      if (!phone) {
        this.sendJson(res, 400, { ok: false, message: 'phone is required' });
        return;
      }

      const result = await this.scheduleWeeklyPreview(phone, fast);
      this.sendJson(res, 200, { ok: true, ...result });
      return;
    }

    this.sendJson(res, 404, { ok: false, message: 'Not found' });
  }

  sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
  }

  async scheduleWeeklyPreview(phoneNumber, fast = false) {
    const existingGuardian = GuardianModel.getByPhoneNumber(phoneNumber);
    const guardian = existingGuardian || this.bootstrapGuardian(phoneNumber);
    const family = FamilyModel.getById(guardian.family_id);

    const baseTime = new Date();
    const gapMinutes = fast ? 1 : 5; // fast mode for local testing

    const messages = [
      {
        messageType: 'weekly_preview_manual',
        content:
          '🚀 تم تفعيل باقة الإشعارات الأسبوعية اليدوية. ستصلك رسائل متتابعة خلال اليوم لاختبار التدفق.',
        slotLabel: 'manual_weekly_start'
      },
      {
        messageType: 'weekly_learning_bundle',
        content:
          '🎓 معاينة التعلم: نصيحة تربوية + فيديو قصير + تمرين يومي. سنراعي تاريخ الإشعارات السابقة حتى لا يتكرر المحتوى.',
        slotLabel: 'manual_weekly_learning'
      },
      {
        messageType: 'weekly_weekend_plan',
        content:
          '🏕️ معاينة نهاية الأسبوع: اقتراح نزهة أو فيلم عائلي مع روابط موثوقة. سنستخدم سجل الأسرة لتخصيص المقترحات.',
        slotLabel: 'manual_weekend'
      },
      {
        messageType: 'weekly_ai_plus',
        content:
          '🤖 AI+ تنبيه تفاعلي: سيُرسل إشعار إضافي عند الحاجة بناءً على حالة الطفل وسجل الإشعارات خلال اليوم.',
        slotLabel: 'manual_ai_plus'
      }
    ];

    const scheduled = messages.map((msg, index) => {
      const scheduledTime = new Date(baseTime.getTime() + index * gapMinutes * 60 * 1000);
      const timestamp = format(scheduledTime, 'yyyy-MM-dd HH:mm:ss');
      const id = this.orchestrator.schedule({
        familyId: family.id,
        guardianId: guardian.id,
        messageType: msg.messageType,
        content: msg.content,
        scheduledTime: timestamp,
        slotLabel: msg.slotLabel,
        metadata: {
          source: 'http_trigger',
          phone: phoneNumber,
          demo: true
        }
      });
      return { scheduledTime: timestamp, messageType: msg.messageType, scheduledId: id };
    });

    return {
      phone: phoneNumber,
      family_id: family.id,
      guardian_id: guardian.id,
      scheduled
    };
  }

  bootstrapGuardian(phoneNumber) {
    const familyId = FamilyModel.create(`عائلة-${phoneNumber}`, 'Africa/Cairo', 'ar');
    FamilyModel.updateSendPreference(familyId, false, null);
    const guardianId = GuardianModel.create(familyId, 'الأب (تجربة يدوية)', 'father', phoneNumber);
    return GuardianModel.getById(guardianId);
  }
}

export default HttpTriggerServer;
