import http from 'http';
import { URL } from 'url';
import { differenceInCalendarDays, format } from 'date-fns';
import { NotificationOrchestrator } from '../services/notificationOrchestrator.js';
import {
  ChildModel,
  FamilyModel,
  GuardianModel,
  InteractionModel
} from '../database/models.js';
import { LLMService } from '../ai/llm.js';

export class HttpTriggerServer {
  constructor(config = {}) {
    this.config = config;
    this.server = null;
    this.orchestrator = new NotificationOrchestrator(config);
    this.llm = new LLMService(config);
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
      const familyIdParam = searchParams.get('family_id');
      const allowCreate = searchParams.get('create') === '1';
      const fast = searchParams.get('fast') === '1';

      const result = await this.scheduleWeeklyPreview({
        phone,
        familyIdParam,
        fast,
        allowCreate
      });
      this.sendJson(res, result.statusCode, result.body);
      return;
    }

    this.sendJson(res, 404, { ok: false, message: 'Not found' });
  }

  sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload, null, 2));
  }

  async scheduleWeeklyPreview({ phone, familyIdParam, fast = false, allowCreate = false }) {
    const { family, guardian, child, created } = this.resolveFamilyAndGuardian({
      phone,
      familyIdParam,
      allowCreate
    });

    const historyDigest = InteractionModel.getFamilyNotificationStats(family.id, null, 60);
    const childDay = child ? this.calculateDayOfLife(child.birth_date) : null;

    const baseTime = new Date();
    const gapMinutes = fast ? 1 : 5; // fast mode for local testing

    const messages = await this.buildRealisticMessages({ family, guardian, child, historyDigest, childDay });

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
          phone,
          demo: true,
          created_new_family: created
        }
      });
      return { scheduledTime: timestamp, messageType: msg.messageType, scheduledId: id };
    });

    const ok = scheduled.some((item) => item.scheduledId);
    const statusCode = ok ? 200 : 400;

    return {
      statusCode,
      body: {
        ok,
        phone,
        family_id: family.id,
        guardian_id: guardian.id,
        created_new_family: created,
        scheduled,
        message: ok
          ? 'تم جدولة الإشعارات اليومية التجريبية للأسرة الموجودة.'
          : 'تعذر جدولة أي إشعارات (تحقق من الصلاحيات أو أنواع الرسائل).'
      }
    };
  }

  resolveFamilyAndGuardian({ phone, familyIdParam, allowCreate }) {
    let family = null;
    let guardian = null;

    if (familyIdParam) {
      const parsedId = parseInt(familyIdParam, 10);
      if (!Number.isNaN(parsedId)) {
        family = FamilyModel.getById(parsedId);
        const guardians = family ? GuardianModel.getByFamily(family.id) : [];
        guardian = guardians.find((g) => (phone ? g.phone_number === phone : g.notification_enabled)) || guardians[0] || null;
      }
    }

    if (!guardian && phone) {
      guardian = GuardianModel.getByPhoneNumber(phone);
      family = guardian ? FamilyModel.getById(guardian.family_id) : family;
    }

    if (!family && allowCreate && phone) {
      const familyId = FamilyModel.create(`عائلة-${phone}`, 'Africa/Cairo', 'ar');
      FamilyModel.updateSendPreference(familyId, false, null);
      const guardianId = GuardianModel.create(familyId, 'الأب (تجربة يدوية)', 'father', phone);
      guardian = GuardianModel.getById(guardianId);
      family = FamilyModel.getById(familyId);
      return { family, guardian, child: null, created: true };
    }

    if (!family || !guardian) {
      throw new Error('لم يتم العثور على أسرة أو وصي مطابق. مرر family_id أو phone صحيح أو استخدم create=1.');
    }

    const child = ChildModel.getByFamily(family.id)?.[0] || null;
    return { family, guardian, child, created: false };
  }

  async buildRealisticMessages({ family, guardian, child, historyDigest, childDay }) {
    const baseContext = {
      guardianName: guardian?.name || family.family_name,
      childName: child?.name || 'طفلكم',
      childAge: child ? this.calculateAge(child.birth_date) : '',
      childDay,
      familyId: family.id,
      notificationStats: historyDigest
    };

    const prompts = [
      {
        messageType: 'weekly_preview_manual',
        slotLabel: 'manual_weekly_start',
        tone: 'ترحيبي',
        instruction: 'قدم ملخصًا قصيرًا لباقة الإشعارات القادمة لهذا الأسبوع مع ربطها بعمر الطفل.'
      },
      {
        messageType: 'weekly_learning_bundle',
        slotLabel: 'manual_weekly_learning',
        tone: 'تعليمي',
        instruction:
          'اعرض حزمة تعلم للوالدين تشمل نصيحة عملية + رابط فيديو موثوق + تمرين بسيط، مع مراعاة تاريخ الرسائل السابقة.'
      },
      {
        messageType: 'weekly_weekend_plan',
        slotLabel: 'manual_weekend',
        tone: 'مرح وعائلي',
        instruction: 'اقترح خطة نهاية أسبوع (خروج/فيلم/نشاط منزلي) تناسب عمر الطفل وحالة الأسرة الحالية.'
      },
      {
        messageType: 'weekly_ai_plus',
        slotLabel: 'manual_ai_plus',
        tone: 'تنبيهي وودود',
        instruction:
          'أرسل تنبيه AI+ يعتمد على أحدث الإشعارات أو المشاكل المعروفة، مع إبقاء الباب مفتوحًا لحوار تفاعلي.'
      }
    ];

    const messages = [];
    for (const prompt of prompts) {
      try {
        const content = await this.llm.generateMessage({
          ...baseContext,
          messageType: prompt.messageType,
          timeOfDay: 'أي وقت',
          tone: prompt.tone,
          additionalContext: prompt.instruction
        });
        messages.push({ ...prompt, content });
      } catch (err) {
        console.error('LLM generation failed for manual preview:', err);
        messages.push({ ...prompt, content: this.buildFallback(prompt, baseContext) });
      }
    }
    return messages;
  }

  buildFallback(prompt, baseContext) {
    const dayLine = baseContext.childDay ? `يومه ${baseContext.childDay}.` : '';
    switch (prompt.messageType) {
      case 'weekly_learning_bundle':
        return `🎓 حزمة تعلم للأسبوع: نصيحة سريعة + رابط فيديو موثوق + تمرين يومي قصير. ${dayLine}`;
      case 'weekly_weekend_plan':
        return `🏕️ خطة نهاية الأسبوع: نشاط عائلي بسيط يناسب عمر ${baseContext.childName}. ${dayLine}`;
      case 'weekly_ai_plus':
        return `🤖 تنبيه AI+: سنراقب إشعارات اليوم ونرسل تذكيرًا إضافيًا إذا ظهرت حاجة طارئة. ${dayLine}`;
      default:
        return `🚀 تم تفعيل المعاينة الأسبوعية للأسرة. سنرسل رسائل متتابعة تناسب ${baseContext.childName}. ${dayLine}`;
    }
  }

  calculateDayOfLife(birthDate) {
    if (!birthDate) return null;
    return differenceInCalendarDays(new Date(), new Date(birthDate)) + 1;
  }

  calculateAge(birthDate) {
    if (!birthDate) return '';
    const days = this.calculateDayOfLife(birthDate);
    return days ? `${days} يوم` : '';
  }
}

export default HttpTriggerServer;
