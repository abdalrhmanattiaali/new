import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { format } from 'date-fns';
import {
  ChildModel,
  FamilyModel,
  GuardianModel,
  NotificationHistoryModel,
  ScheduledMessageModel
} from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { NotificationOrchestrator } from '../services/notificationOrchestrator.js';
import { getAllowedGroups, describeRegistrySource } from '../utils/groupRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function defaultFeatures() {
  return [
    {
      id: 'daily_bundle',
      title: 'رسائل اليوم',
      messageType: 'dashboard_daily_preview',
      description: 'حزمة يومية مختصرة للتأكد من سلامة القنوات والجدولة.'
    },
    {
      id: 'weekend_plan',
      title: 'خطة نهاية الأسبوع',
      messageType: 'dashboard_weekend_preview',
      description: 'تجربة إرسال خطة نهاية الأسبوع مع ارتباط بسجل الأسرة.'
    },
    {
      id: 'learning_hub',
      title: 'محتوى تعليمي للوالدين',
      messageType: 'dashboard_learning_snack',
      description: 'كتاب/دورة/فيديو موثوق مع مراعاة الروابط السابقة.'
    },
    {
      id: 'ai_plus',
      title: 'تنبيه AI+',
      messageType: 'dashboard_ai_plus',
      description: 'تنبيه تفاعلي يعتمد على الهيستوري ويضيف زر حوار سريع.'
    },
    {
      id: 'test_weather',
      title: 'تحديث الطقس',
      messageType: 'dashboard_weather_ping',
      description: 'تذكير طقس سريع مع نصيحة ملابس بناءً على المدينة الافتراضية.'
    }
  ];
}

export class DashboardServer {
  constructor(config = {}) {
    this.config = config;
    this.app = null;
    this.server = null;
    this.orchestrator = new NotificationOrchestrator(config);
    this.llm = new LLMService(config);
    const configured = Array.isArray(config.dashboard?.features) ? config.dashboard.features : [];
    this.features = configured.map((f) => ({
      ...f,
      messageType: f.message_type || f.messageType
    }));
    if (!this.features.length) {
      this.features = defaultFeatures();
    }
  }

  start() {
    const dashConfig = this.config.dashboard || {};
    if (dashConfig.enabled === false) return;

    this.app = express();
    this.app.use(express.json());

    this.app.get(['/','/dashboard'], (req, res) => {
      const dashboardPath = path.join(__dirname, '../../docs/dashboard_ui.html');
      res.sendFile(dashboardPath);
    });

    this.app.get('/api/dashboard/summary', (req, res) => {
      res.json(this.buildSummary());
    });

    this.app.get('/api/dashboard/history', (req, res) => {
      const familyId = parseInt(req.query.family_id || dashConfig.default_family_id, 10);
      const limit = parseInt(req.query.limit || '12', 10);
      const snapshot = Number.isNaN(familyId)
        ? []
        : NotificationHistoryModel.getSnapshot(familyId, limit).map((row) => ({
            id: row.id,
            messageType: row.message_type,
            sequence: row.sequence,
            createdAt: row.created_at,
            content: row.content,
            status: row.status,
            slotLabel: row.slot_label
          }));
      res.json({ family_id: familyId, history: snapshot });
    });

    this.app.post('/api/dashboard/test', async (req, res) => {
      try {
        const { familyId, guardianId, featureId, customMessage } = req.body || {};
        const feature = this.features.find((f) => f.id === featureId) || this.features[0];
        if (!feature) {
          res.status(400).json({ ok: false, message: 'لم يتم تحديد ميزة اختبار صالحة.' });
          return;
        }

        const targetFamilyId = familyId || this.config.dashboard?.default_family_id;
        const validFamily = targetFamilyId ? FamilyModel.getById(targetFamilyId) : null;
        if (!validFamily) {
          res.status(400).json({ ok: false, message: 'يجب تحديد أسرة صالحة قبل الاختبار.' });
          return;
        }

        const targetGuardianId = this.resolveGuardianId(targetFamilyId, guardianId || this.config.dashboard?.default_guardian_id);
        if (!targetGuardianId) {
          res.status(400).json({ ok: false, message: 'لم يتم العثور على وصي لهذه الأسرة.' });
          return;
        }
        const scheduledTime = format(new Date(Date.now() + 60 * 1000), 'yyyy-MM-dd HH:mm:ss');

        const content =
          customMessage ||
          (await this.buildTestContent({
            feature,
            familyId: targetFamilyId,
            guardianId: targetGuardianId
          }));

        const scheduledId = this.orchestrator.schedule({
          familyId: targetFamilyId,
          guardianId: targetGuardianId,
          messageType: feature.messageType,
          content,
          scheduledTime,
          slotLabel: 'dashboard_test',
          metadata: { source: 'dashboard', feature: feature.id }
        });

        res.json({ ok: Boolean(scheduledId), scheduled_id: scheduledId, message_type: feature.messageType });
      } catch (error) {
        console.error('Dashboard test error:', error);
        res.status(500).json({ ok: false, message: error.message });
      }
    });

    this.app.post('/api/dashboard/ai-suggest', async (req, res) => {
      try {
        const { topic, context, desiredFormat } = req.body || {};
        const hint = this.config.dashboard?.ai_hint || 'اقترح إعداداً أو نموذج رسالة مختصر.';
        const prompt = [
          hint,
          topic ? `الموضوع: ${topic}` : '',
          context ? `السياق الحالي:\n${context}` : '',
          desiredFormat ? `الصيغة المفضلة: ${desiredFormat}` : ''
        ]
          .filter(Boolean)
          .join('\n\n');

        const suggestion = await this.llm.generateMessage({
          messageType: 'dashboard_ai_hint',
          timeOfDay: 'any',
          tone: 'احترافي وداعم',
          guardianName: 'المشغل',
          childName: 'الأسرة',
          additionalContext: prompt
        });

        res.json({ ok: true, suggestion });
      } catch (error) {
        console.error('AI suggestion failed:', error);
        res.status(500).json({ ok: false, message: error.message });
      }
    });

    const port = dashConfig.port || 8090;
    this.server = this.app.listen(port, '0.0.0.0', () => {
      console.log(`🖥️  Dashboard available on port ${port}`);
    });
  }

  buildSummary() {
    const families = FamilyModel.getAll();
    const guardians = GuardianModel.getAll();
    const children = families.flatMap((fam) => ChildModel.getByFamily(fam.id).map((child) => ({ ...child, family_id: fam.id })));
    const now = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const pending = ScheduledMessageModel.getPending(now) || [];
    const allowedGroups = getAllowedGroups();
    const registryInfo = describeRegistrySource();

    return {
      ok: true,
      dashboard: {
        features: this.features,
        default_family_id: this.config.dashboard?.default_family_id || null,
        default_guardian_id: this.config.dashboard?.default_guardian_id || null,
        ai_hint: this.config.dashboard?.ai_hint || ''
      },
      counts: {
        families: families.length,
        guardians: guardians.length,
        children: children.length,
        pending_messages: pending.length,
        allowed_groups: allowedGroups.length
      },
      samples: {
        families: families.slice(0, 5),
        guardians: guardians.slice(0, 5),
        children: children.slice(0, 5),
        allowed_groups: allowedGroups.slice(0, 5)
      },
      registry: registryInfo,
      pending_preview: pending.slice(0, 5),
      latest_history: families.length
        ? NotificationHistoryModel.getSnapshot(families[0].id, 6).map((row) => ({
            messageType: row.message_type,
            sequence: row.sequence,
            createdAt: row.created_at,
            content: row.content
          }))
        : []
    };
  }

  async buildTestContent({ feature, familyId, guardianId }) {
    const family = familyId ? FamilyModel.getById(familyId) : null;
    const guardian = guardianId ? GuardianModel.getById(guardianId) : null;
    const children = family ? ChildModel.getByFamily(family.id) : [];
    const child = children[0];
    const dayOfLife = child?.birth_date ? this.calculateDayOfLife(child.birth_date) : null;

    const context = [
      feature.description || '',
      family ? `الأسرة: ${family.family_name}` : '',
      guardian ? `المستلم: ${guardian.name}` : '',
      dayOfLife ? `عمر الطفل: ${dayOfLife} يوم` : '',
      'رجاءً احتفظ بالنبرة المهنية الداعمة.'
    ]
      .filter(Boolean)
      .join('\n');

    try {
      return await this.llm.generateMessage({
        messageType: feature.messageType,
        timeOfDay: 'أي وقت',
        tone: 'مهني وداعم',
        guardianName: guardian?.name || 'الأسرة',
        childName: child?.name || 'الطفل',
        childAge: dayOfLife ? `${dayOfLife} يوم` : '',
        additionalContext: context
      });
    } catch (error) {
      console.error('LLM test content failed, using fallback:', error.message);
      return `🚀 اختبار ${feature.title}: سيتم إرسال رسالة تجريبية للأسرة ${family?.family_name || 'المختارة'}.`;
    }
  }

  resolveGuardianId(familyId, preferredGuardianId = null) {
    if (!familyId) return null;
    if (preferredGuardianId) {
      const found = GuardianModel.getById(preferredGuardianId);
      if (found) return found.id;
    }
    const guardians = GuardianModel.getByFamily(familyId) || [];
    return guardians[0]?.id || null;
  }

  calculateDayOfLife(birthDate) {
    if (!birthDate) return null;
    const start = new Date(birthDate);
    const today = new Date();
    const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : null;
  }
}

export default DashboardServer;
