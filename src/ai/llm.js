/**
 * LLM Service (Anthropic Claude Integration)
 * خدمة الذكاء الاصطناعي - تم التحديث لاستخدام Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

export class LLMService {
  constructor(config) {
    this.config = config;

    // API Key يُقرأ من ملف index.js (global.ANTHROPIC_API_KEY)
    // يمكنك تعديله مباشرة من أول ملف src/index.js
    const ANTHROPIC_API_KEY = global.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes('PLACEHOLDER')) {
      throw new Error('❌ يرجى تعديل ANTHROPIC_API_KEY في ملف src/index.js واستبداله بـ API Key الصحيح من Anthropic');
    }

    this.claude = new Anthropic({
      apiKey: ANTHROPIC_API_KEY
    });

    this.systemPrompt = config.ai?.llm?.system_prompt || `
أنت مساعد عائلي ذكي وحنون. دورك مساعدة الوالدين في تربية أطفالهم بطريقة صحية ومتوازنة.
- استخدم لغة بسيطة وواضحة ومختصرة
- كن عملياً وواقعياً في النصائح
- اظهر التعاطف والدعم
- لا تعطي نصائح طبية تشخيصية، بل وجّه للطبيب عند الحاجة
- احترم القيم العائلية والدينية بلطف
    `.trim();

    this.model = config.ai?.llm?.model || 'claude-3-5-sonnet-20240620';
    this.temperature = config.ai?.llm?.temperature || 0.7;
    this.maxTokens = config.ai?.llm?.max_tokens || 1024;
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

    const userPrompt = this.buildPrompt(context);

    try {
      const response = await this.claude.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      const message = response.content[0].text;

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
      additionalContext
    } = context;

    const prompts = {
      child_sleep: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} حول روتين النوم لطفلهم ${childName} (عمر ${childAge}).
الوقت: ${timeOfDay}
${additionalContext ? `معلومات إضافية: ${additionalContext}` : ''}

تأكد من:
- النصيحة عملية وواقعية
- اللغة دافئة وداعمة
- النصيحة قصيرة ومباشرة
      `.trim(),

      child_nutrition: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} حول تغذية طفلهم ${childName} (عمر ${childAge}).
الوقت: ${timeOfDay}
${additionalContext ? `معلومات إضافية: ${additionalContext}` : ''}

اقترح:
- وجبة صحية بسيطة أو سناك
- فكرة لإدخال طعام جديد (إذا مناسب)
- نصيحة عملية
      `.trim(),

      child_play: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} تقترح نشاط لعب هادف (5-10 دقائق) لطفلهم ${childName} (عمر ${childAge}).
الوقت: ${timeOfDay}
${additionalContext ? `معلومات إضافية: ${additionalContext}` : ''}

النشاط يجب أن:
- يكون بسيط ولا يحتاج تجهيزات معقدة
- يناسب عمر الطفل
- يطور مهارة معينة
      `.trim(),

      child_language: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} تقترح نشاط لغوي قصير لطفلهم ${childName} (عمر ${childAge}).
الوقت: ${timeOfDay}
${additionalContext ? `معلومات إضافية: ${additionalContext}` : ''}

يمكن أن يكون:
- سؤال للطفل
- لعبة كلمات بسيطة
- قصة قصيرة (دقيقتين)
      `.trim(),

      parents_mental: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} تدعم صحتهم النفسية.
الوقت: ${timeOfDay}
${additionalContext ? `معلومات إضافية: ${additionalContext}` : ''}

يمكن أن تتضمن:
- تمرين تنفس بسيط (2-3 دقائق)
- إعادة صياغة إيجابية لموقف يومي
- تذكير بإنجاز صغير
      `.trim(),

      weekend_movies: `
اقترح فيلمين عائليين مناسبين لمشاهدة نهاية الأسبوع.
العائلة: ${guardianName}
الطفل: ${childName} (عمر ${childAge})
${additionalContext ? `تفضيلات: ${additionalContext}` : ''}

لكل فيلم:
- الاسم بالعربية والإنجليزية
- سبب الترشيح (سطر واحد)
- المدة التقريبية
      `.trim(),

      weekend_outings: `
اقترح فكرة خروجة عائلية بسيطة لنهاية الأسبوع.
العائلة: ${guardianName}
الطفل: ${childName} (عمر ${childAge})
${additionalContext ? `معلومات إضافية: ${additionalContext}` : ''}

يجب أن تكون:
- بسيطة وغير مكلفة
- مدتها حوالي 2-3 ساعات
- مناسبة للأطفال
      `.trim(),

      weekly_report: `
اكتب ملخص أسبوعي قصير (5-6 أسطر) للعائلة ${guardianName}.
الطفل: ${childName} (عمر ${childAge})
${additionalContext ? `البيانات: ${additionalContext}` : ''}

يجب أن يتضمن:
- إنجازات الأسبوع (2-3 نقاط)
- نقطة للتحسين
- هدف صغير للأسبوع القادم
- رسالة تشجيعية
      `.trim(),

      default: `
اكتب رسالة قصيرة (3-4 أسطر) للوالد/ة ${guardianName} حول ${messageType}.
الطفل: ${childName} (عمر ${childAge})
الوقت: ${timeOfDay}
${additionalContext ? `معلومات إضافية: ${additionalContext}` : ''}
      `.trim()
    };

    return prompts[messageType] || prompts.default;
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
      const response = await this.claude.messages.create({
        model: this.model,
        max_tokens: 800,
        temperature: this.temperature,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      return response.content[0].text;

    } catch (error) {
      console.error('Error generating learning content:', error);
      return null;
    }
  }
}

export default LLMService;
