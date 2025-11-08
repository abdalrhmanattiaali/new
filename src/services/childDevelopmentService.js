/**
 * Child Development Service
 * خدمة تطوير الطفل اليومية
 *
 * Daily activities, exercises, and nutrition guidance based on child's age
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ClaudeClient } from '../utils/claudeClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ChildDevelopmentService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');
    this.claude = new ClaudeClient();
  }

  /**
   * Send daily development messages to all families
   */
  async sendDailyDevelopmentMessages() {
    console.log('📚 Generating daily child development messages...');

    const db = new Database(this.dbPath);

    try {
      // Get all families with children
      const families = db.prepare(`
        SELECT DISTINCT f.id, f.family_name, f.family_group_id, f.send_to_group
        FROM families f
        JOIN children c ON c.family_id = f.id
        WHERE f.onboarding_completed = 1
      `).all();

      for (const family of families) {
        // Get all children for this family
        const children = db.prepare(`
          SELECT * FROM children
          WHERE family_id = ?
          ORDER BY birth_date ASC
        `).all(family.id);

        for (const child of children) {
          // Calculate age in months
          const ageInMonths = this.calculateAgeInMonths(child.birth_date);

          // Generate development message
          const message = await this.generateDevelopmentMessage(
            child.name,
            ageInMonths,
            family.family_name
          );

          // Send message
          await this.sendToFamily(
            family.family_group_id,
            family.send_to_group,
            message
          );

          console.log(`✅ Sent development message for ${child.name} (${ageInMonths} months)`);
        }
      }

      db.close();
      console.log('✅ Daily development messages sent');

    } catch (error) {
      db.close();
      console.error('❌ Error sending development messages:', error);
    }
  }

  /**
   * Generate daily development message based on child's age
   */
  async generateDevelopmentMessage(childName, ageInMonths, familyName) {
    // Get development stage info
    const stageInfo = this.getDevelopmentStageInfo(ageInMonths);

    // Determine message type for today (rotate between activity and nutrition)
    const dayOfMonth = new Date().getDate();
    const messageType = dayOfMonth % 2 === 0 ? 'activity' : 'nutrition';

    if (messageType === 'activity') {
      return await this.generateActivityMessage(childName, ageInMonths, stageInfo);
    } else {
      return await this.generateNutritionMessage(childName, ageInMonths, stageInfo);
    }
  }

  /**
   * Generate activity and exercise message
   */
  async generateActivityMessage(childName, ageInMonths, stageInfo) {
    const systemPrompt = `أنت خبير تطوير الأطفال متخصص في الأنشطة والتمارين المناسبة لكل مرحلة عمرية.
لديك معرفة واسعة بالتطور الحركي والمعرفي للأطفال من الولادة حتى سنتين.
تقدم نصائح عملية ومخصصة بالعربية الفصحى الدافئة.`;

    const userPrompt = `اكتب رسالة يومية للوالدين عن نشاط وتمارين مناسبة لطفلهم ${childName}.

**معلومات الطفل:**
- الاسم: ${childName}
- العمر: ${ageInMonths} شهر
- المرحلة: ${stageInfo.stageName}

**السياق التطوري:**
${stageInfo.context}

**المطلوب:**
1. نشاط أو تمرين واحد مفصل ليوم اليوم
2. شرح كيفية القيام به (خطوات واضحة)
3. المدة المناسبة (5-15 دقيقة حسب العمر)
4. الفوائد التطورية
5. نصائح للأمان
6. كلمات تشجيعية للوالدين

**المواصفات:**
- الطول: 150-200 كلمة
- ابدأ بـ: 📚 *نشاط اليوم لـ ${childName}*
- لغة دافئة ومشجعة
- نصائح عملية قابلة للتطبيق فوراً
- استخدم إيموجي مناسب
- اختر نشاطاً جديداً ومختلفاً في كل مرة

اجعل الرسالة ممتعة ومحفزة للوالدين!`;

    try {
      const message = await this.claude.generateText(systemPrompt, userPrompt, {
        temperature: 0.9,
        maxTokens: 800
      });

      return message;

    } catch (error) {
      console.error('Error generating activity message:', error);
      // Fallback message
      return `📚 *نشاط اليوم لـ ${childName}*\n\nوقت اللعب والتفاعل! خصصوا 15 دقيقة اليوم للعب مع ${childName}. التفاعل المباشر هو أفضل نشاط لتطوره في هذا العمر! 💝`;
    }
  }

  /**
   * Generate nutrition message
   */
  async generateNutritionMessage(childName, ageInMonths, stageInfo) {
    const systemPrompt = `أنت خبير تغذية أطفال متخصص في التغذية السليمة من الولادة حتى السنتين.
لديك معرفة شاملة بإدخال الأطعمة الصلبة، الرضاعة، والتغذية المتوازنة.
تقدم نصائح عملية وآمنة بالعربية الفصحى الدافئة.`;

    const userPrompt = `اكتب رسالة يومية للوالدين عن التغذية المناسبة لطفلهم ${childName}.

**معلومات الطفل:**
- الاسم: ${childName}
- العمر: ${ageInMonths} شهر
- المرحلة: ${stageInfo.stageName}

**السياق التغذوي:**
${stageInfo.nutritionContext}

**المطلوب:**
1. نصيحة تغذية واحدة مفصلة ليوم اليوم
2. وصفة بسيطة أو فكرة وجبة (إن كان مناسباً للعمر)
3. الفوائد الصحية
4. نصائح تحضير آمنة
5. ما يجب تجنبه
6. تشجيع للوالدين

**المواصفات:**
- الطول: 150-200 كلمة
- ابدأ بـ: 🍎 *تغذية ${childName} اليوم*
- لغة دافئة وداعمة
- نصائح آمنة ومبنية على العمر
- استخدم إيموجي مناسب
- اقترح شيئاً جديداً ومتنوعاً

اجعل الرسالة مفيدة وعملية!`;

    try {
      const message = await this.claude.generateText(systemPrompt, userPrompt, {
        temperature: 0.9,
        maxTokens: 800
      });

      return message;

    } catch (error) {
      console.error('Error generating nutrition message:', error);
      // Fallback message
      return `🍎 *تغذية ${childName} اليوم*\n\nتذكروا: التغذية المتوازنة والمتنوعة هي المفتاح لنمو ${childName} الصحي! استشيروا طبيب الأطفال دائماً. 💚`;
    }
  }

  /**
   * Get development stage information based on age
   */
  getDevelopmentStageInfo(ageInMonths) {
    const stages = {
      // 0-1 month
      0: {
        stageName: 'حديث الولادة (0-1 شهر)',
        context: `التطور الحركي:
- رفع الرأس لثوانٍ قليلة عند وقت البطن
- حركات عشوائية
- قبضة اليد قوية (منعكس)

التمارين المناسبة:
- وقت البطن: 1-2 دقيقة، مرتين يومياً
- تمارين الذراعين والساقين البسيطة
- تدليك لطيف
- تتبع الوجه والأشياء المتباينة

التحفيز الحسي:
- تباين عالي (أبيض وأسود)
- أصوات هادئة
- موسيقى كلاسيكية
- قراءة بصوت هادئ`,
        nutritionContext: `التغذية:
- **رضاعة فقط**: طبيعية أو صناعية
- كل 2-3 ساعات (8-12 مرة يومياً)
- 60-90 مل حليب صناعي
- التجشؤ بعد كل رضعة مهم`
      },

      // 2 months
      2: {
        stageName: 'الشهر الثاني',
        context: `التطور الحركي:
- رفع الرأس 45 درجة عند وقت البطن
- يبدأ بالتحكم في الحركات
- يفتح يديه أكثر
- يركل بقوة

التمارين:
- وقت البطن: 5-10 دقائق، 3-4 مرات يومياً
- تمارين دفع الساقين
- تمارين الإمساك
- تدريبات التدحرج التحضيرية

التطور الحسي:
- يتتبع الأشياء 180 درجة
- يفضل الألوان الزاهية
- يميز صوت الأم والأب
- المناغاة: آه، أوه`,
        nutritionContext: `التغذية:
- رضاعة طبيعية/صناعية: 6-8 مرات يومياً
- كل 3-4 ساعات
- 120-150 مل حليب صناعي
- طفرة النمو في الأسبوع 6 (يرضع أكثر)`
      },

      // 3 months
      3: {
        stageName: 'الشهر الثالث',
        context: `التطور الحركي:
- يرفع رأسه وصدره 45-90 درجة
- يدعم جسمه بساعديه
- يمد يده للأشياء
- يمسك الأشياء عمداً

التمارين:
- وقت البطن الممتد: 10-15 دقيقة، 4-5 مرات
- تمرين الجلوس المدعوم
- تمرين الوقوف على الساقين
- تمرين التدحرج

التطور المعرفي:
- يضحك بصوت عالٍ
- يبتسم للغرباء أحياناً
- يحب التفاعل
- يستجيب لاسمه`,
        nutritionContext: `التغذية:
- 5-6 رضعات يومياً
- 150-180 مل حليب صناعي
- المجموع: 750-1000 مل
- **ملاحظة**: لا طعام صلب بعد! انتظري حتى 6 أشهر`
      },

      // 4-5 months
      4: {
        stageName: 'الشهر الرابع-الخامس',
        context: `التطور الحركي:
- يتدحرج من البطن للظهر
- يجلس بدعم ووسائد
- يحمل وزنه على ساقيه
- يدفع نفسه للأعلى
- قد يتأرجح (تحضير للحبو)

التمارين:
- وقت البطن: 15-20 دقيقة
- تمرين الجلوس مع الوسائد
- تمرين التدحرج
- "تمارين الطائرة"
- تمرين الدراجة

التطور الحركي الدقيق:
- ينقل الأشياء من يد ليد
- يُسقط الأشياء عمداً
- يمسك زجاجة الحليب`,
        nutritionContext: `التغذية (4-5 أشهر):
- 4-6 رضعات يومياً
- 180-210 مل حليب صناعي
- **قرب موعد الطعام الصلب!**
- راقبي علامات الاستعداد (انتظري 6 أشهر كاملة):
  • يجلس بدعم
  • يتحكم في رأسه
  • يفتح فمه للطعام
  • لا يدفع الطعام بلسانه`
      },

      // 6 months - START OF SOLID FOODS
      6: {
        stageName: 'الشهر السادس - بداية الطعام الصلب!',
        context: `التطور الحركي:
- يجلس بدون دعم بثبات
- يتدحرج بسهولة
- بعضهم يبدأ بالحبو
- يشد نفسه للوقوف

التمارين:
- وقت البطن: 20-30 دقيقة
- تمرين الجلوس بدون دعم
- تشجيع الحبو
- السباحة للرضع (اختياري)

التطور المعرفي:
- يفهم السبب والنتيجة
- يبحث عن أشياء مخفية
- يستجيب لاسمه
- قلق الانفصال يبدأ`,
        nutritionContext: `🎉 **وقت الطعام الصلب!**

**الأسبوع الأول**: حبوب الأرز
- 1-2 ملعقة صغيرة
- قوام سائل جداً

**الأسبوع الثاني**: خضروات
- كوسة، جزر، بطاطا حلوة
- مهروس ناعم جداً
- طعام واحد كل 3 أيام

**الأسبوع الثالث**: فواكه
- تفاح مطبوخ، موز، كمثرى
- مهروس ناعم

**ممنوع**:
- ملح، سكر، عسل
- بياض البيض (انتظري 8-10 أشهر)

**الرضاعة**: 4-5 مرات (لا تزال الأساس)`
      },

      // 7-8 months
      7: {
        stageName: 'الشهر السابع-الثامن',
        context: `التطور الحركي:
- يجلس بثبات بدون دعم
- يحبو أو يبدأ بالحبو
- يشد نفسه للوقوف
- ينتقل من الجلوس للحبو

التمارين:
- تشجيع الحبو: 15-20 دقيقة، 3 مرات
- تمرين الوقوف
- لعبة المطاردة
- اللعب الحر على الأرض: 60 دقيقة

التطور الحركي الدقيق:
- قبضة الكماشة
- يطعم نفسه بأصابعه
- يمسك الكوب بيدين`,
        nutritionContext: `التغذية (7-8 أشهر):

**بروتينات جديدة**:
- دجاج مسلوق ومفروم
- لحم بقري مفروم
- صفار البيض (بيضاء بعد 10 أشهر)
- سمك أبيض (بدون شوك)

**البقوليات**:
- عدس أحمر
- فول مقشر

**زبادي وجبن**:
- زبادي كامل الدسم
- جبن قريش

**3 وجبات + 1-2 سناك**
**الرضاعة**: 3-4 مرات`
      },

      // 9-10 months
      9: {
        stageName: 'الشهر التاسع-العاشر',
        context: `التطور الحركي:
- يحبو بسرعة وثقة
- يمشي ممسكاً بالأثاث (Cruising)
- يقف بدون مساعدة لثوانٍ
- قد يخطو خطوات

التمارين:
- تشجيع المشي: مشاية دفع
- المشي ممسكاً بيديك
- تمرين الوقوف المستقل
- الصعود والنزول (بإشراف)

التطور المعرفي:
- دوام الشيء متطور
- يقلدك: يلوح، يصفق
- يستكشف بكل حواسه
- يشير لما يريده`,
        nutritionContext: `التغذية (9-10 أشهر):

**أطعمة جديدة**:
- بياض البيض (بيضة كاملة)
- سلمون، تونة
- معكرونة صغيرة
- أرز
- أجبان متنوعة

**Finger Foods**:
- قطع خبز محمص
- قطع موز
- قطع دجاج طرية
- شرائح جبن
- قطع بطاطس مطبوخة

**3 وجبات + 2 سناك**
**الرضاعة**: 3-4 مرات`
      },

      // 11-12 months
      11: {
        stageName: 'الشهر 11-12 - عيد الميلاد الأول!',
        context: `التطور الحركي:
- يمشي ممسكاً بيد واحدة
- بعضهم يخطو خطوات مستقلة
- يقف بدون مساعدة لدقائق
- يصعد وينزل الدرج بالحبو

التمارين:
- التشجيع على المشي المستقل
- المشي بين الأثاث
- ألعاب خارجية متنوعة

التطور اللغوي:
- أول كلمة حقيقية! "ماما"، "بابا"
- يفهم 50-100 كلمة
- ينفذ أوامر بسيطة
- يشير لما يريد`,
        nutritionContext: `التغذية (11-12 شهر):

**بعد السنة**:
- حليب بقر كامل الدسم (2-3 أكواب)
- أو استمري بالرضاعة الطبيعية

**أطعمة العائلة**:
- معظم طعام العائلة (بتعديلات بسيطة)
- بدون ملح زائد/بهارات حارة
- قطع أكبر

**ممنوع**: عسل (حتى السنة)

**3 وجبات كاملة + 2 سناك**`
      },

      // 13-18 months
      13: {
        stageName: 'السنة الثانية (13-18 شهر)',
        context: `التطور الحركي:
- يمشي بثقة
- يجري (15-18 شهر)
- يصعد الدرج بمساعدة
- يركل كرة
- يشد ويدفع ألعاب

التطور المعرفي:
- يقلد أفعالاً معقدة
- لعب تظاهري
- يحل مشاكل بسيطة
- يرص 4-6 مكعبات

التطور اللغوي:
- 5-50 كلمة
- يفهم 100+ كلمة
- يتبع أوامر بسيطة`,
        nutritionContext: `التغذية (13-18 شهر):
- حليب بقر كامل الدسم: 2-3 أكواب
- 3 وجبات كاملة + 2 سناك
- تنوع كبير
- يأكل مع العائلة
- شجعي الاستقلالية (ملعقة، شوكة)`
      },

      // 19-24 months
      19: {
        stageName: 'السنة الثانية (19-24 شهر)',
        context: `التطور الحركي:
- يجري بسرعة
- يقفز بقدمين معاً
- يصعد وينزل الدرج بتمسك
- يرمي كرة
- يتسلق

التطور اللغوي:
- 50-100+ كلمة
- جمل بسيطة (كلمتين)
- "انفجار لغوي"
- يسمي أشياء
- يغني أجزاء من أغاني

التطور الاجتماعي:
- نوبات غضب تبدأ
- "أنا!"، "لا!"
- استقلالية`,
        nutritionContext: `التغذية (19-24 شهر):
- حليب كامل الدسم: 2-3 أكواب
- نفس طعام العائلة
- تنوع كامل
- تجنبي: أطعمة خطر الاختناق
- شجعي الأكل المستقل`
      }
    };

    // Find the appropriate stage
    let stageKey = 0;
    if (ageInMonths <= 1) stageKey = 0;
    else if (ageInMonths === 2) stageKey = 2;
    else if (ageInMonths === 3) stageKey = 3;
    else if (ageInMonths >= 4 && ageInMonths <= 5) stageKey = 4;
    else if (ageInMonths === 6) stageKey = 6;
    else if (ageInMonths >= 7 && ageInMonths <= 8) stageKey = 7;
    else if (ageInMonths >= 9 && ageInMonths <= 10) stageKey = 9;
    else if (ageInMonths >= 11 && ageInMonths <= 12) stageKey = 11;
    else if (ageInMonths >= 13 && ageInMonths <= 18) stageKey = 13;
    else if (ageInMonths >= 19 && ageInMonths <= 24) stageKey = 19;
    else stageKey = 19; // 24+ months use same as 19-24

    return stages[stageKey] || stages[0];
  }

  /**
   * Calculate age in months from birth date
   */
  calculateAgeInMonths(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();

    let months = (today.getFullYear() - birth.getFullYear()) * 12;
    months -= birth.getMonth();
    months += today.getMonth();

    // If we haven't reached the birth day this month, subtract 1
    if (today.getDate() < birth.getDate()) {
      months--;
    }

    return Math.max(0, months);
  }

  /**
   * Send message to family
   */
  async sendToFamily(groupId, sendToGroup, message) {
    try {
      if (sendToGroup && groupId) {
        await this.bot.sendMessage(groupId, message);
      }
    } catch (error) {
      console.error('Error sending development message:', error);
    }
  }
}

export default ChildDevelopmentService;
