/**
 * LLM Service (OpenAI ChatGPT Integration)
 * خدمة الذكاء الاصطناعي - تم التحديث لاستخدام ChatGPT
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';

import { KnowledgeBase } from './knowledgeBase.js';

dotenv.config();

export class LLMService {
  constructor(config) {
    this.config = config;

    // API Key يُقرأ من ملف index.js (global.OPENAI_API_KEY)
    // يمكنك تعديله مباشرة من أول ملف src/index.js
    const OPENAI_API_KEY = global.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('PLACEHOLDER')) {
      throw new Error('❌ يرجى تعديل OPENAI_API_KEY في ملف src/index.js واستبداله بـ API Key الصحيح من OpenAI');
    }

    this.openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });

    this.systemPrompt = config.ai?.llm?.system_prompt || `
أنت مساعد عائلي ذكي وحنون. دورك مساعدة الوالدين في تربية أطفالهم بطريقة صحية ومتوازنة.
- استخدم لغة بسيطة وواضحة ومختصرة
- كن عملياً وواقعياً في النصائح
- اظهر التعاطف والدعم
- لا تعطي نصائح طبية تشخيصية، بل وجّه للطبيب عند الحاجة
- احترم القيم العائلية والدينية بلطف
    `.trim();

    this.model = config.ai?.llm?.model || 'gpt-5';
    this.temperature = config.ai?.llm?.temperature || 0.7;
    this.maxTokens = config.ai?.llm?.max_tokens || 1024;
    this.memoryLimit = config.ai?.memory?.max_messages || 50;
    this.ragConfig = config.ai?.rag || { enabled: false };

    this.knowledgeBase = new KnowledgeBase(config);
  }

  /**
   * Generate a personalized message
   */
  async generateMessage(context) {
    const {
      messageType,
      guardianName,
      childName,
      childAge,
      timeOfDay,
      previousInteractions,
      additionalContext
    } = context;

    const { snippets: knowledgeSnippets, hints: knowledgeHints } = await this.retrieveKnowledge(context);
    const userPrompt = this.buildPrompt({
      ...context,
      knowledgeSnippets,
      knowledgeHints
    });

    try {
      let message;

      // GPT-5 uses Responses API
      if (this.model.startsWith('gpt-5')) {
        const requestParams = {
          model: this.model,
          max_output_tokens: this.maxTokens,
          input: `${this.systemPrompt}\n\n${userPrompt}`
        };

        const response = await this.openai.responses.create(requestParams);

        // Primary method: use output_text
        if (response.output_text && response.output_text.trim()) {
          message = response.output_text;
        } else if (response.output && Array.isArray(response.output)) {
          // Fallback: search for message in output array
          const messageOutput = response.output.find(item => item.type === 'message');
          if (messageOutput?.content?.[0]?.text) {
            message = messageOutput.content[0].text;
          }
        }

        // If status is incomplete, throw specific error
        if (!message && response.status === 'incomplete') {
          const reason = response.incomplete_details?.reason || 'unknown';
          throw new Error(`GPT-5 response incomplete: ${reason}. Try increasing max_output_tokens in config.`);
        }

        if (!message) {
          throw new Error('No text output from GPT-5: ' + JSON.stringify(response));
        }
      } else {
        // Other models use Chat Completions API
        const requestParams = {
          model: this.model,
          max_completion_tokens: this.maxTokens,
          temperature: this.temperature,
          messages: [
            {
              role: 'system',
              content: this.systemPrompt
            },
            {
              role: 'user',
              content: userPrompt
            }
          ]
        };

        const response = await this.openai.chat.completions.create(requestParams);
        message = response.choices[0].message.content;
      }

      // Safety check
      if (this.containsUnsafeContent(message)) {
        console.warn('Unsafe content detected, regenerating...');
        return this.generateSafetyFallback(messageType);
      }

      return message;

    } catch (error) {
      console.error('Error generating message:', error);
      return this.generateFallbackMessage(messageType);
    }
  }

  async generateDialogueExchange(context) {
    const prompt = this.buildDialoguePrompt(context);
    const raw = await this.runModel(prompt, 900);
    const parsed = this.extractJSON(raw);
    if (!parsed) {
      throw new Error('Dialogue response missing JSON payload');
    }
    return parsed;
  }

  async evaluateInteractiveNotification(context) {
    const prompt = this.buildInteractiveDecisionPrompt(context);
    const raw = await this.runModel(prompt, 800);
    const parsed = this.extractJSON(raw);
    if (!parsed) {
      throw new Error('Interactive notification decision missing JSON payload');
    }
    return parsed;
  }

  /**
   * Build prompt based on message type
   */
  buildPrompt(context) {
    const {
      messageType,
      guardianName,
      childName,
      childAge,
      timeOfDay,
      additionalContext,
      previousInteractions = [],
      knowledgeSnippets = [],
      activeIssues = [],
      trackMetadata = {},
      preferredFormat,
      configFormats = [],
      knowledgeHints = [],
      relationshipInsights = [],
      notificationStats = {},
      childDay = null
    } = context;

    const prompts = {
      child_sleep: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} حول روتين النوم لطفلهم ${childName} (عمر ${childAge}).
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}

ركز على:
- تهدئة الطفل قبل النوم
- ربط النوم بعادة محببة
- نصيحة قابلة للتطبيق الليلة
      `.trim(),

      child_nutrition: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} حول تغذية ${childName} (عمر ${childAge}).
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}

تأكد من اقتراح:
- وجبة أو سناك عملي وسريع التحضير
- عنصر غذائي يدعم النمو
- طريقة تشجيع إيجابية للتجربة
      `.trim(),

      child_play: `
اقترح نشاط لعب هادف (5-10 دقائق) لـ ${childName} (عمر ${childAge}).
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}

النشاط يجب أن:
- يكون بسيط وقابل للتنفيذ داخل المنزل
- يطوّر مهارة محددة (حركية، حسية أو اجتماعية)
- يتضمن خطوة للتقييم أو متابعة التقدّم
      `.trim(),

      child_language: `
قدّم نشاط لغة قصير لـ ${childName} (عمر ${childAge}).
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}

النشاط يمكن أن يكون:
- سؤال يفتح حوارًا غنيًا
- لعبة كلمات أو قافية بسيطة
- سرد قصة مع مشاركة الطفل
      `.trim(),

      parents_mental: `
اكتب رسالة دعم نفسي قصيرة للوالد/ة ${guardianName}.
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}

المطلوب:
- تمرين تنفس أو تهدئة يمكن تنفيذه الآن
- إعادة تأطير إيجابي لموقف حديث
- تذكير بإنجاز عائلي أو شخصي
      `.trim(),

      audio_story: `
أنت كاتب قصص أطفال قبل النوم. اكتب قصة صوتية مخصصة للطفل ${childName} (${childAge}) لتُقرأ أو تُسجّل مساءً.

المطلوب:
- اجعل طول النص بين 350 و650 كلمة (مدة 2 إلى 5 دقائق من القراءة الهادئة).
- استخدم لغة عربية فصحى بسيطة مع جمل قصيرة وتعبيرات حنونة.
- تضمين مقدمة هادئة، حدث لطيف، ذروة خفيفة، خاتمة مطمئنة.
- غرس قيمة تربوية أو مهارة سلوكية تناسب العمر.
- لا تكرر الحبكات أو العناوين المذكورة في الذاكرة أعلاه.

أعد النتيجة بصيغة JSON تحتوي على المفاتيح التالية فقط:
- "title": عنوان جذاب ومناسب للعمر.
- "summary": ملخص قصير يشجع على الاستماع.
- "script": نص القصة الكامل مقسّم إلى فقرات قابلة للقراءة الصوتية.
- "moral": العبرة أو القيمة المستفادة.
- "estimated_duration_minutes": رقم بين 2 و5 يقدر مدة القصة عند القراءة الصوتية.
      `.trim(),

      weekend_movies: `
اقترح فيلمين عائليين ملائمين لهذا الأسبوع.
${additionalContext ? `تفضيلات: ${additionalContext}\n` : ''}

لكل فيلم اذكر:
- الاسم بالعربية والإنجليزية
- سبب الترشيح بأسلوب شخصي
- مدة الفيلم وملاءمته العمرية
      `.trim(),

      weekend_outings: `
اقترح خروجة عائلية بسيطة لنهاية الأسبوع.
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}

الخطة يجب أن:
- تراعي ميزانية منخفضة
- تستغرق 2-3 ساعات
- تتضمن نشاطًا مشتركًا للأبوين والطفل
      `.trim(),

      parent_book: `
رشح كتاباً عملياً لوالدين مشغولين يساعدهما على دعم طفلهما ${childName} (${childAge}).
${additionalContext ? `التوجهات المطلوبة: ${additionalContext}\n` : ''}

قدم النتيجة في 3 فقرات:
1. اسم الكتاب + المؤلف + مدة القراءة المتوقعة.
2. لماذا يناسب هذه العائلة الآن (سطران).
3. كيفية تطبيقه خلال الأسبوعين القادمين مع اقتراح زر/إجراء سريع.
      `.trim(),

      parent_course: `
اقترح كورساً قصيراً (أقل من 60 دقيقة) يساعد ${guardianName || 'الوالدين'} على تطوير دوره العائلي.
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}

اذكر:
- اسم الكورس والمنصة.
- 3 نقاط تعلم أساسية.
- كيفية تطبيقه هذا الأسبوع (خطوة واحدة قابلة للتنفيذ).
      `.trim(),

      weekly_report: `
اكتب ملخص أسبوعي (5-6 أسطر) للعائلة ${guardianName}.
${additionalContext ? `بيانات داعمة: ${additionalContext}\n` : ''}

الملخص يجب أن يحتوي:
- إنجازات الأسبوع (3 نقاط مختصرة)
- تحدٍ أو نقطة للتحسين
- هدف ملموس للأسبوع القادم
- رسالة تشجيع حارة في الختام
      `.trim(),

      custom_prayer: `
أنشئ دعاءً روحانياً موجهاً للوالدين ${guardianName} من أجل ${childName} (عمر ${childAge}).
${additionalContext ? `تفاصيل إضافية: ${additionalContext}\n` : ''}

المتطلبات:
- طول الدعاء من 3 إلى 4 أسطر.
- لغة عربية فصحى سهلة مع نبرة حنونة.
- تضمين طلب واضح بالحفظ أو البركة أو التيسير.
- اختتم بعبارة قصيرة يمكن للوالدين ترديدها مع الطفل.
      `.trim(),

      custom_spiritual_story: `
اكتب قصة روحانية قصيرة تحكيها عائلة ${guardianName} لـ ${childName} (عمر ${childAge}).
${additionalContext ? `تفاصيل إضافية: ${additionalContext}\n` : ''}

المطلوب:
- فقرتان إلى أربع فقرات فقط.
- استشهد بموقف من سيرة الصحابة أو قصة معاصرة ملهمة.
- أبرز قيمة تربوية أو روحانية واضحة في الخاتمة.
- استخدم لغة دافئة يسهل قراءتها بصوت مسموع.
      `.trim(),

      couple_feedback_checkin: `
اكتب رسالة قصيرة (4-5 أسطر) للوالد/ة ${guardianName} تشجعه على مشاركة إيجابية واحدة وتحدٍ واحد مع شريكه.

- ذكّر بأن المساحة آمنة وسرية.
- اطلب وصف إحساسه عند تذكر الإيجابية.
- ساعده على صياغة طلب دعم واضح للتحدي بدون لوم.
- اختم بجملة توضح أنك ستوصل الرسالة برفق أو تقدم خطوات لاحقة.
      `.trim(),

      couple_feedback_gratitude: `
اكتب رسالة امتنان حارة تدعو ${guardianName} لذكر شيئين يحبهما في شريكه اليوم.

- شجعه على ربط الامتنان بلحظة عاشها هذا الأسبوع.
- اطلب منه إرسال جملة امتنان قصيرة لإسعاد الشريك.
- اقترح لفتة عملية (رسالة صوتية، كوب قهوة، حضن).
- اختم بوعد أنك ستدعم الطرف الآخر برسالة مشجعة أيضاً.
      `.trim(),

      default: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} حول ${messageType} لطفلهم ${childName} (عمر ${childAge}).
${additionalContext ? `سياق إضافي: ${additionalContext}\n` : ''}
      `.trim()
    };

    const trackInfoLines = [];
    if (trackMetadata?.title || trackMetadata?.category) {
      trackInfoLines.push(`المسار: ${trackMetadata.title || trackMetadata.category}`);
    }
    if (trackMetadata?.focus) {
      trackInfoLines.push(`تركيز المسار: ${trackMetadata.focus}`);
    }
    if (trackMetadata?.tone) {
      trackInfoLines.push(`نبرة الرسالة المفضلة: ${trackMetadata.tone}`);
    }

    const formatInstruction = this.getFormatInstruction(preferredFormat, configFormats);
    const memoryBlock = this.formatPreviousInteractions(previousInteractions);
    const issuesBlock = this.formatActiveIssues(activeIssues);
    const knowledgeBlock = this.formatKnowledge(knowledgeSnippets);
    const relationshipBlock = this.formatRelationshipInsights(relationshipInsights);
    const notificationBlock = this.formatNotificationStats(notificationStats, messageType);

    const knowledgeHintLine = knowledgeHints?.length
      ? `كلمات مفتاحية إضافية: ${knowledgeHints.join(', ')}`
      : '';

    const childDayLine = Number.isInteger(childDay)
      ? `- اليوم ${childDay} من عمر ${childName} (استخدم العدّ اليومي لبناء الإحساس بالتقدم)`
      : '';

    return `
المعلومات الأساسية:
- نوع الرسالة: ${messageType}
- اسم الوالد/ة: ${guardianName}
- الطفل: ${childName} (العمر التقريبي: ${childAge})
- توقيت الرسالة: ${timeOfDay}
${trackInfoLines.length ? `- ${trackInfoLines.join('\n- ')}` : ''}
${knowledgeHintLine ? `- ${knowledgeHintLine}` : ''}
${childDayLine}

${formatInstruction ? `تعليمات شكل الإخراج:\n${formatInstruction}\n` : ''}

${issuesBlock ? `التحديات أو المتابعة الحالية:\n${issuesBlock}\n` : 'التحديات أو المتابعة الحالية:\n- لا توجد تحديات مسجلة حالياً'}

${knowledgeBlock ? `معرفة داعمة مختارة:\n${knowledgeBlock}\n` : ''}

${relationshipBlock ? `مقتطفات عن العلاقة الزوجية:\n${relationshipBlock}\n` : ''}

${notificationBlock ? `ملخص الإشعارات السابقة:\n${notificationBlock}\n` : ''}

ذاكرة المحادثة الأخيرة (${previousInteractions?.length || 0}):
${memoryBlock}

الرسالة المطلوبة:
${prompts[messageType] || prompts.default}
    `.trim();
  }

  buildDialoguePrompt(context) {
    const {
      sessionType,
      topic,
      guardianName,
      guardianRole,
      participants = [],
      latestMessage,
      childSnapshot = [],
      history = [],
      coupleInsights = [],
      activeIssues = [],
      channel,
      interactions = []
    } = context;

    const historyLines = history
      .map((entry) => `${entry.author_type || 'guardian'}: ${entry.message_content}`)
      .join('\n');

    const participantsText = participants
      .map((p) => `${p.name || 'غير معروف'} (${p.role || 'guardian'})`)
      .join(', ');

    const childDetails = childSnapshot
      .map((child) => `${child.name} - ${child.birth_date || 'بدون تاريخ'}${child.stage ? ` (${child.stage})` : ''}`)
      .join('; ');

    const issues = activeIssues
      .map((issue) => `${issue.issue_title || issue.issue_type} (${issue.status})`)
      .join(' | ');

    const sentiments = coupleInsights
      .map((entry) => `${entry.sentiment}: +${entry.positives_text || '—'} / -${entry.challenges_text || '—'}`)
      .join(' || ');

    const recentInteractions = interactions
      .map((interaction) => `${interaction.message_type || 'message'} => ${interaction.message_content?.slice(0, 80) || ''}`)
      .join('\n');

    return `أنت وسيط حوارات زوجية وأبوية ذكي. المطلوب هو الرد على الرسالة الأخيرة بطريقة حنونة وعملية، مع ربط الحديث بسياق العائلة.

نوع الجلسة: ${sessionType}
الموضوع: ${topic || 'غير محدد'}
القناة: ${channel}
المشاركون: ${participantsText || 'غير متوفر'}
الطفل/الأطفال: ${childDetails || 'غير مسجل'}
المشاكل النشطة: ${issues || 'لا يوجد'}
ملاحظات العلاقة: ${sentiments || 'لا يوجد'}
أحدث التفاعلات النصية: ${recentInteractions || 'لا يوجد'}

سجل المحادثة:
${historyLines || 'لا يوجد'}

رسالة ${guardianName} (${guardianRole}): ${latestMessage}

أجب دائماً بصيغة JSON بهذا الشكل:
{
  "reply": "النص الرئيسي الذي سيرسَل للزوجين",
  "follow_up": "سؤال متابعة قصير إن وجد، أو null",
  "close_session": false
}`;
  }

  buildInteractiveDecisionPrompt(context) {
    const { familyName, guardians = [], children = [], coupleNotes = [], issues = [], openSessions = [], config = {} } = context;

    const guardianText = guardians.map((g) => `${g.name} (${g.role})`).join(', ');
    const childText = children.map((child) => `${child.name} (${child.development_stage || 'غير محدد'})`).join(', ');
    const issuesText = issues.map((issue) => `${issue.issue_title} - ${issue.status}`).join(' | ');
    const coupleText = coupleNotes.map((note) => `${note.sentiment}: +${note.positives_text || ''} / -${note.challenges_text || ''}`).join(' || ');
    const sessionsText = openSessions.map((session) => `${session.type}:${session.topic || 'عام'}`).join(', ');

    return `أنت مساعد مسؤول عن اتخاذ قرار ذكي بخصوص إرسال إشعار إضافي لعائلة ${familyName}.
المتاح:
- الأوصياء: ${guardianText}
- الأطفال: ${childText || 'لا يوجد'}
- المشاكل الحالية: ${issuesText || 'لا يوجد'}
- ملاحظات العلاقة: ${coupleText || 'لا يوجد'}
- جلسات مفتوحة: ${sessionsText || 'لا يوجد'}
- تفضيلات المواضيع: ${(config.topics || []).join(', ')}

أصدر قراراً واحداً بصيغة JSON:
{
  "send": true أو false,
  "reason": "لماذا هذا الوقت مناسب",
  "topic": "تعريف مختصر",
  "sessionType": "child_issue" أو "couple_feedback" أو "parent_support" أو "interactive_notification",
  "target": "father" أو "mother" أو "both",
  "urgency": "low"|"medium"|"high",
  "message": "النص العربي الذي سنرسله",
  "follow_up_hint": "ما الذي يجب مراقبته لاحقاً"
}`;
  }

  async runModel(prompt, maxTokens = 512) {
    if (this.model.startsWith('gpt-5')) {
      const response = await this.openai.responses.create({
        model: this.model,
        max_output_tokens: maxTokens,
        input: `${this.systemPrompt}\n\n${prompt}`
      });
      return response.output_text || (response.output?.[0]?.content?.[0]?.text ?? '');
    }

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      max_completion_tokens: maxTokens,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ]
    });
    return completion.choices?.[0]?.message?.content || '';
  }

  extractJSON(text) {
    if (!text) return null;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      console.warn('LLMService: failed to parse JSON payload', error.message);
      return null;
    }
  }

  getFormatInstruction(preferredFormat, configFormats = []) {
    const normalized = preferredFormat || (configFormats?.length ? configFormats[0] : 'text');

    switch (normalized) {
      case 'audio_story':
        return '- أعد الناتج بصيغة JSON بالمفاتيح (title, summary, script, moral, estimated_duration_minutes).\n- اجعل النص قابلاً للتسجيل الصوتي المطمئن لمدة 2-5 دقائق.';
      case 'checklist':
        return '- قدم الإجابة في شكل قائمة من عناصر قابلة للتنفيذ مع مربعات اختيار.\n- اختم بجملة تشجيعية قصيرة.';
      case 'audio30':
        return '- اكتب نصاً موجزاً يصلح لتسجيل صوتي لمدة 30 ثانية.\n- ضع مقترح افتتاحية وجملة ختامية ودليل سرعة الكلام.';
      case 'quick_tip':
        return '- وفر نصيحة سريعة في سطر واحد ثم اذكر سبباً داعماً مختصراً.';
      default:
        return '- استخدم فقرات قصيرة مع رموز تعبيرية ملائمة إن أمكن.';
    }
  }

  formatPreviousInteractions(interactions = []) {
    if (!Array.isArray(interactions) || interactions.length === 0) {
      return '- لا توجد تفاعلات سابقة كمرجع.';
    }

    const trimmed = interactions
      .slice(0, this.memoryLimit)
      .map((interaction) => {
        const date = interaction.created_at
          ? new Date(interaction.created_at).toLocaleDateString('ar-EG', { weekday: 'short' })
          : 'سابقاً';
        const content = this.safeTruncate(interaction.message_content || '', 180);
        const response = interaction.button_clicked
          ? ` | استجابة: ${interaction.button_clicked}`
          : '';
        return `- [${date}] ${interaction.message_type || 'تفاعل'}: ${content}${response}`;
      });

    return trimmed.join('\n');
  }

  formatActiveIssues(activeIssues = []) {
    if (!Array.isArray(activeIssues) || activeIssues.length === 0) {
      return '';
    }

    return activeIssues
      .slice(0, 5)
      .map((issue) => {
        const status = issue.status || 'active';
        const severity = issue.severity ? `، شدة: ${issue.severity}` : '';
        const childName = issue.child_name || 'الطفل';
        const focus = this.safeTruncate(issue.issue_title || issue.treatment_plan || '', 120);
        return `- ${childName}: ${focus} (حالة: ${status}${severity})`;
      })
      .join('\n');
  }

  formatKnowledge(snippets = []) {
    if (!Array.isArray(snippets) || snippets.length === 0) {
      return '';
    }

    return snippets
      .map((snippet) => {
        const summary = this.safeTruncate(snippet.content || '', 200);
        const source = snippet.source === 'database' ? '📚 قاعدة المعرفة' : '🗂️ ملف محلي';
        return `- ${source}: ${snippet.title}\n  ${summary}`;
      })
      .join('\n');
  }

  formatRelationshipInsights(insights = []) {
    if (!Array.isArray(insights) || insights.length === 0) {
      return '';
    }

    return insights
      .slice(0, 6)
      .map((entry) => {
        const sentimentIcon = entry.sentiment === 'positive' ? '💚' : entry.sentiment === 'challenge' ? '⚠️' : '📝';
        const positive = this.safeTruncate(entry.positives_text || '', 120);
        const challenge = this.safeTruncate(entry.challenges_text || '', 120);
        const gratitude = this.safeTruncate(entry.gratitude_text || '', 80);
        const parts = [];
        if (positive) parts.push(`إيجابية: ${positive}`);
        if (challenge) parts.push(`تحدي: ${challenge}`);
        if (gratitude) parts.push(`امتنان: ${gratitude}`);
        return `- ${sentimentIcon} ${parts.join(' | ')}`;
      })
      .join('\n');
  }

  formatNotificationStats(stats = {}, messageType) {
    if (!stats || typeof stats !== 'object') {
      return '';
    }

    const lines = [];

    if (typeof stats.totalSent === 'number') {
      lines.push(`- إجمالي الرسائل المرسلة للعائلة: ${stats.totalSent}`);
    }

    if (typeof stats.recentCount === 'number' && stats.recentWindowDays) {
      lines.push(`- آخر ${stats.recentWindowDays} يوماً: ${stats.recentCount} رسالة`);
    }

    if (messageType && stats.typeCounts?.[messageType]) {
      const typeInfo = stats.typeCounts[messageType];
      lines.push(`- لهذا المسار (${messageType}): ${typeInfo.count} رسالة سابقة`);
      if (typeInfo.lastSentAt) {
        const formatted = new Date(typeInfo.lastSentAt).toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' });
        lines.push(`- آخر إرسال لهذا المسار: ${formatted}`);
      }
    }

    if (stats.nextSequenceForType && messageType) {
      lines.push(`- هذه الرسالة يجب أن تُبنى كنقطة #${stats.nextSequenceForType} في السلسلة لتجنب التكرار.`);
    }

    return lines.join('\n');
  }

  safeTruncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
  }

  async retrieveKnowledge(context) {
    try {
      if (!this.ragConfig?.enabled) {
        return { snippets: [], hints: [] };
      }

      const keywords = this.extractKeywords(context);
      const query = (context.additionalContext && context.additionalContext.trim()) || context.messageType || '';
      const topK = this.ragConfig.top_k || 3;

      const snippets = this.knowledgeBase.search(query, {
        keywords,
        limit: topK
      });

      return {
        snippets,
        hints: keywords.slice(0, 8)
      };
    } catch (error) {
      console.warn('LLMService.retrieveKnowledge error:', error.message);
      return { snippets: [], hints: [] };
    }
  }

  extractKeywords(context) {
    const keywords = new Set();

    if (context.messageType) {
      keywords.add(context.messageType.replace(/_/g, ' '));
    }

    if (context.trackMetadata?.keywords) {
      context.trackMetadata.keywords.forEach((keyword) => keywords.add(keyword));
    }

    if (context.childName) {
      keywords.add(context.childName);
    }

    const ageStage = this.getAgeStage(context.childAge);
    if (ageStage) {
      keywords.add(ageStage);
    }

    if (context.additionalContext) {
      const extra = context.additionalContext
        .toString()
        .toLowerCase()
        .split(/[^\w\u0621-\u064A]+/)
        .filter(Boolean)
        .slice(0, 6);
      extra.forEach((word) => keywords.add(word));
    }

    if (Array.isArray(context.activeIssues)) {
      context.activeIssues.forEach((issue) => {
        if (issue.issue_type) keywords.add(issue.issue_type);
        if (issue.issue_title) keywords.add(issue.issue_title);
      });
    }

    if (Array.isArray(context.relationshipInsights)) {
      context.relationshipInsights.forEach((entry) => {
        if (entry.sentiment) keywords.add(entry.sentiment);
        if (entry.positives_text) keywords.add('ايجابيات الزواج');
        if (entry.challenges_text) keywords.add('تحديات الزواج');
      });
    }

    if (Array.isArray(context.previousInteractions)) {
      context.previousInteractions.slice(0, 5).forEach((interaction) => {
        if (interaction.message_type) keywords.add(interaction.message_type);
      });
    }

    return Array.from(keywords).filter(Boolean);
  }

  getAgeStage(childAge) {
    if (!childAge) return null;
    if (typeof childAge === 'string' && childAge.includes('شهر')) {
      return 'رضيع';
    }

    const match = childAge.toString().match(/(\d+)/);
    if (!match) return null;

    const years = parseInt(match[1], 10);

    if (Number.isNaN(years)) return null;
    if (years < 3) return 'طفل صغير';
    if (years < 6) return 'ما قبل المدرسة';
    if (years < 12) return 'مرحلة المدرسة الابتدائية';
    return 'مراهق مبكر';
  }

  /**
   * Check if content contains unsafe advice
   */
  containsUnsafeContent(message) {
    const unsafeKeywords = [
      'تشخيص',
      'علاج دوائي',
      'وصفة طبية',
      'medication',
      'diagnosis',
      'prescription'
    ];

    const lowerMessage = message.toLowerCase();
    return unsafeKeywords.some(keyword => lowerMessage.includes(keyword.toLowerCase()));
  }

  /**
   * Generate safety fallback message
   */
  generateSafetyFallback(messageType) {
    return 'من فضلك استشر طبيب الأطفال للحصول على نصيحة طبية متخصصة. صحة طفلك أولوية! 💙';
  }

  /**
   * Generate fallback message if API fails
   */
  generateFallbackMessage(messageType) {
    const fallbacks = {
      child_sleep: 'روتين النوم الثابت مهم جداً! حاول أن يكون وقت النوم نفسه كل يوم. 😴',
      child_nutrition: 'وجبة بسيطة ومتوازنة أفضل من وجبة معقدة! تذكر: الفواكه والخضروات مهمة. 🍎',
      child_play: 'اللعب مع طفلك 10 دقائق فقط يومياً يصنع فرقاً كبيراً! 🎨',
      child_language: 'تحدث مع طفلك عن يومه، اسأله أسئلة بسيطة واستمع بانتباه. 📚',
      parents_mental: 'خذ نفساً عميقاً... أنت تقوم بعمل رائع! 💙',
      audio_story: 'اقترح الليلة حكاية جديدة بطابع هادئ تشجع طفلك على الاستماع والمشاركة قبل النوم. 🌙',
      custom_prayer: 'اللهم احفظ أطفالنا واجعل بيوتنا عامرة بالذكر والسكينة. يمكنكم ترديد هذا الدعاء معاً الآن. 🤲',
      custom_spiritual_story: 'احكوا لطفلكم قصة عن صحابي صغير حفظه الله بالشكر والدعاء، واختموا بعبرة بسيطة. 📖',
      parent_book: '📚 كتاب العائلة لهذا الأسبوع: اقرأوا 15 دقيقة يومياً وطبقوا فكرة واحدة مع طفلكم.',
      parent_course: '🎓 درس سريع: شاهدوا درساً مصغراً عن التواصل العائلي هذا الأسبوع وشاركوا أبرز نقطة مع الشريك.',
      default: 'أنت والد/ة رائع! استمر في المحاولة والتعلم. 💪'
    };

    return fallbacks[messageType] || fallbacks.default;
  }

  /**
   * Generate learning content suggestion
   */
  async generateLearningContent(guardianProfile, contentType = 'book') {
    const prompt = `
اقترح ${contentType === 'book' ? 'كتاب' : 'كورس أونلاين'} قصير ومفيد للآباء/الأمهات.

الموضوعات المفضلة: تربية، تنظيم وقت، صحة نفسية، تواصل زوجي

يجب أن يكون:
- عملي وسهل التطبيق
- باللغة العربية (أو مترجم)
- لا يحتاج وقت طويل (2-3 ساعات كحد أقصى)

قدم:
1. العنوان
2. المؤلف/المصدر
3. ملخص سطرين لماذا يستحق القراءة/المتابعة
4. المدة التقريبية
    `.trim();

    try {
      // GPT-5 uses Responses API
      if (this.model.startsWith('gpt-5')) {
        const requestParams = {
          model: this.model,
          max_output_tokens: 20000,
          input: `${this.systemPrompt}\n\n${prompt}`
        };

        const response = await this.openai.responses.create(requestParams);

        // Primary method: use output_text
        if (response.output_text && response.output_text.trim()) {
          return response.output_text;
        }

        // Fallback: search for message in output array
        if (response.output && Array.isArray(response.output)) {
          const messageOutput = response.output.find(item => item.type === 'message');
          if (messageOutput?.content?.[0]?.text) {
            return messageOutput.content[0].text;
          }
        }

        // If status is incomplete, throw specific error
        if (response.status === 'incomplete') {
          const reason = response.incomplete_details?.reason || 'unknown';
          throw new Error(`GPT-5 response incomplete: ${reason}. Try increasing max_output_tokens.`);
        }

        throw new Error('No text output from GPT-5: ' + JSON.stringify(response));
      }

      // Other models use Chat Completions API
      const requestParams = {
        model: this.model,
        max_completion_tokens: 800,
        temperature: this.temperature,
        messages: [
          {
            role: 'system',
            content: this.systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      };

      const response = await this.openai.chat.completions.create(requestParams);
      return response.choices[0].message.content;

    } catch (error) {
      console.error('Error generating learning content:', error);
      return null;
    }
  }
}

export default LLMService;
