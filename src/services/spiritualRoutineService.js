/**
 * Spiritual Routine Service
 * خدمة الروتين الروحاني والأذكار اليومية
 */

import axios from 'axios';
import { format, set, isBefore, differenceInMonths } from 'date-fns';

import {
  FamilyModel,
  GuardianModel,
  ChildModel,
  ScheduledMessageModel,
  SpiritualRoutineLogModel,
  SpiritualCustomRequestModel
} from '../database/models.js';
import { LLMService } from '../ai/llm.js';

const ROUTINES = [
  {
    id: 'morning_dua',
    title: 'أدعية الصباح للعائلة',
    schedule: { type: 'daily', time: '06:45' },
    buttons: ['دعوتم ✅', 'ذكرني كل صباح 🔔'],
    keywords: ['دعاء الصباح', 'الصباح', 'أصبحنا'],
    template: ({ childName, parentsPhrase }) => `
🌅 *دعاء الصباح مع ${childName}*

صباحكم مبارك يا ${parentsPhrase}! ردّدوا معاً:

"اللهم إني أصبحتُ أشهدك وأشهد حملة عرشك
أنك أنت الله لا إله إلا أنت
اللهم عافِ ${childName} في بدنه وسمعه وبصره"

💡 حطّوا أيديكم برفق على رأسه وقولوا الدعاء.
مع الوقت سيشعر بالبركة والأمان 💚
    `.trim()
  },
  {
    id: 'feeding_dua',
    title: 'دعاء الرضاعة',
    schedule: { type: 'daily', time: '11:15' },
    buttons: ['تم ✅', 'علّمني دعاء تاني 📿'],
    keywords: ['رضاعة', 'إرضاع', 'طعام الطفل'],
    template: ({ childName, motherName }) => `
🍼 *دعاء الرضاعة لـ ${childName}*

قبل ما ترضّعي يا ${motherName} قولي:
"بسم الله، اللهم بارك لنا فيما رزقتنا
وزدنا منه ولا تحرمنا بركته"

وبعد ما يخلص:
"الحمد لله الذي أطعمنا وسقانا
وجعلنا مسلمين"

💛 فايدة روحية: البركة في الحليب والشبع.
💪 فايدة عملية: طقس يهدّيكِ ويهدّيه.
    `.trim()
  },
  {
    id: 'sleep_dua',
    title: 'أذكار النوم للطفل',
    schedule: { type: 'daily', time: '20:45' },
    buttons: ['طبّقنا ✅', 'صوت الشيخ 🎧'],
    keywords: ['نوم', 'أذكار النوم'],
    supportsAudio: true,
    template: ({ childName }) => `
🌙 *أذكار النوم لـ ${childName}*

قبل النوم، احضنوه وقولوا:
"باسمك اللهم أحيا وأموت
اللهم قِنا عذاب القبر
اللهم احفظ ${childName} من كل سوء"

ثم انفخوا في كفوفكم واقرأوا:
{قُلْ هُوَ اللَّهُ أَحَدٌ} + {قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ} + {قُلْ أَعُوذُ بِرَبِّ النَّاسِ}
وامسحوا على وجهه وصدره برفق 💙

كل ليلة تبني درعاً من الحفظ حوله.
    `.trim()
  },
  {
    id: 'daily_ruqyah',
    title: 'رقية الطفل اليومية',
    schedule: { type: 'daily', time: '09:30' },
    buttons: ['رقيناه ✅', 'علّمني الرقية صح 📖', 'صوت الشيخ 🎧'],
    keywords: ['رقية', 'حماية'],
    supportsAudio: true,
    template: ({ childName }) => `
🛡️ *رقية ${childName} اليومية*

مرة في اليوم (الصباح أو قبل النوم):
1. ضعوا يدكم على رأس ${childName} بحنان.
2. اقرأوا آية الكرسي كاملة.
3. ثم قولوا: "أعوذ بكلمات الله التامات من شر ما خلق" ثلاث مرات.

🌟 النبي ﷺ كان يُعوّذ الحسن والحسين بهذه الكلمات.
💚 ${childName} في حفظ الله بإذنه.
    `.trim()
  },
  {
    id: 'fajr_routine',
    title: 'عادة الفجر المباركة',
    schedule: { type: 'daily', time: '06:50' },
    buttons: ['بدأنا العادة ✅', 'فوّتني الأذان ⏰'],
    keywords: ['فجر', 'أذان الفجر'],
    template: ({ childName, fatherCall }) => `
🌅 *عادة الفجر المباركة*

عند سماع الأذان، ${fatherCall} يرفع ${childName} ناحية النافذة ويقول:
"اسمع يا ${childName}، ده صوت الأذان"
ثم يردد معه: "الله أكبر، الله أكبر"
ويختم بالدعاء:
"اللهم اجعله من المصلين"

📿 ثلاث دقائق تزرع في قلبه حب المساجد.
💡 لما يكبر، سيربط صوت الأذان بحضن أبيه.
    `.trim()
  },
  {
    id: 'adhan_moment',
    title: 'لحظة الأذان العائلية',
    schedule: { type: 'daily', time: '12:55' },
    buttons: ['شاركنا ✅', 'سجّل صوتك 🎤'],
    keywords: ['أذان', 'اذان'],
    template: ({ childName, parentsPhrase }) => `
📢 *لحظة الأذان*

سمعتم الأذان الآن؟ تحدي ${parentsPhrase}:
1. أوقفوا أي شيء تعملوه.
2. احملوا ${childName}.
3. رددوا الأذان بصوت واطي.
4. ادعوا له بدعوة صغيرة:
"اللهم رب هذه الدعوة التامة...
اجعل ${childName} من عبادك الصالحين"

💛 ${childName} يتعلم أن الأذان لحظة ذهبية.
    `.trim()
  },
  {
    id: 'duha_blessing',
    title: 'بركة الضحى',
    schedule: { type: 'daily', time: '09:15' },
    buttons: ['صلينا الضحى ✅', 'ذكرني كل يوم 🔔'],
    keywords: ['ضحى'],
    template: ({ childName }) => `
☀️ *بركة الضحى*

من 9:00 إلى 11:00 صباحاً:
- افتحوا الشباك على ${childName}.
- قولوا: "يا ${childName}، دي شمس الضحى، وقت البركة".
- صلّوا ركعتين (الأب أو الأم).
- ادعوا: "اللهم بارك لنا في يومنا".

💰 من صلى الضحى لم يُكتب من الغافلين.
🌟 الشمس + الدعاء = يوم مبارك لـ ${childName}.
    `.trim()
  },
  {
    id: 'maghrib_hour',
    title: 'ساعة الإجابة الذهبية',
    schedule: { type: 'daily', time: '17:30' },
    buttons: ['دعونا ✅', 'أرسل أدعية إضافية 📿'],
    keywords: ['مغرب', 'ساعة الإجابة'],
    template: ({ childName, parentsPhrase }) => `
🌆 *ساعة الإجابة الذهبية*

قبل المغرب بـ 30 دقيقة:
1. اجتمعوا في دائرة هادئة.
2. ${childName} في الوسط (حضن أو كرسيه).
3. كل واحد يدعو بصوت عالٍ:
   - الأب: "اللهم اجعله باراً بوالديه".
   - الأم: "اللهم اجعله من حفظة القرآن".
   - معاً: "اللهم احفظه واحرسه في الدنيا والآخرة".

💚 دقائق قليلة = استثمار أبدي لعائلتكم.
    `.trim()
  },
  {
    id: 'sahabi_story',
    title: 'حكاية الصحابي الصغير',
    schedule: { type: 'daily', time: '13:30' },
    buttons: ['قرأنا القصة ✅', 'قصة تانية بكرة 📖'],
    keywords: ['قصة', 'صحابي'],
    template: ({ childName }) => `
📖 *حكاية اليوم: الصحابي الصغير*

تعرف ${childName} قصة عبد الله بن الزبير؟
وهو رضيع، أمه أسماء كانت تقرأ له القرآن وتحكي عن النبي ﷺ حتى لو ما فهم.

كبر وأصبح من أشجع الصحابة! 🦁

💡 الدرس: ${childName} يسمع ويخزن كل كلمة الآن.
كلمة طيبة اليوم = أثر بعد 20 سنة.
    `.trim()
  },
  {
    id: 'family_challenge',
    title: 'تحدي الأدعية الأسبوعي',
    schedule: { type: 'weekly', dayOfWeek: 6, time: '09:00' },
    buttons: ['بدأنا ✅', 'شاركوا إنجازكم 📸'],
    keywords: ['تحدي الأسبوع', 'سبع أدعية'],
    template: () => `
🏆 *تحدي الأسبوع: 7 أدعية متتالية*

□ السبت: دعاء الصباح
□ الأحد: دعاء قبل الرضاعة
□ الاثنين: الرقية اليومية
□ الثلاثاء: دعاء بعد الأذان
□ الأربعاء: دعاء وقت الضحى
□ الخميس: دعاء ساعة الإجابة
□ الجمعة: دعاء ليلة الجمعة

🎁 المكافأة:
- شهادة "عائلة الذاكرين" تطبعونها.
- عادة جديدة الأسبوع القادم.

هيا نبدأ! 💪
    `.trim()
  },
  {
    id: 'spiritual_pause',
    title: 'لحظة روحانية',
    schedule: { type: 'daily', time: '15:00' },
    buttons: ['حمدنا الله ✅'],
    keywords: ['لحظة روحانية', 'توقفوا'],
    template: ({ childName }) => `
✨ *لحظة روحانية - توقفوا الآن*

1. ضعوا الهواتف بعيداً.
2. احملوا ${childName} قريباً.
3. أغمضوا أعينكم 5 ثوانٍ.
4. احمدوا الله على نعمة هذا الطفل:
"الحمد لله الذي رزقنا ${childName}
وجعله سميعاً بصيراً معافى"

🤲 اللهم احفظه وبارك فيه.
    `.trim()
  },
  {
    id: 'reflective_question',
    title: 'سؤال اليوم التأملي',
    schedule: { type: 'daily', time: '21:15' },
    buttons: ['اكتب دعوتك الآن 📝', 'احفظها لعطية 💾'],
    keywords: ['سؤال اليوم', 'تأمل'],
    template: ({ fatherName, motherName, childName }) => `
🤔 *سؤال اليوم*

يا ${fatherName}، يا ${motherName}...
لو ${childName} كبر وسألكم:
"إيه أول دعوة دعيتوها ليا؟"

خذوا دقيقة الآن.
اكتبوا أجمل دعوة في قلوبكم لـ ${childName}.
احتفظوا بها... ستخبرونه بها حين يكبر.
    `.trim()
  },
  {
    id: 'friday_blessing',
    title: 'طقس الجمعة العائلي',
    schedule: { type: 'weekly', dayOfWeek: 5, time: '09:30' },
    buttons: ['طبقنا ✅', 'ذكرني كل جمعة 🔔'],
    keywords: ['جمعة مباركة', 'الجمعة'],
    template: ({ childName, parentsPhrase }) => `
🕌 *جمعة مباركة يا ${parentsPhrase}*

الصباح:
- اغسلوا ${childName} وألبسوه أجمل ما عنده.
- رشّوا عليه عطراً خفيفاً.
- قولوا: "يا ${childName}، النهاردة يوم مبارك".

الظهر:
- الأب إلى صلاة الجمعة.
- الأم تقرأ سورة الكهف بصوت مسموع.
- ${childName} يسمع حتى لو كان نائماً.

المساء:
- صلّوا على النبي ﷺ 100 مرة وأنتم تحملونه.

🌟 الجمعة = يوم ${childName} المميز.
    `.trim()
  },
  {
    id: 'ramadan_preview',
    title: 'الاستعداد لرمضان',
    schedule: { type: 'monthly', dayOfMonth: 20, time: '12:00' },
    buttons: ['مستعدين ✅', 'خطة رمضان كاملة 📋'],
    keywords: ['رمضان', 'ليلة القدر'],
    template: ({ childName }) => `
🌙 *${childName} في رمضان الأول*

عند الإفطار:
- احملوه وقت الأذان.
- قولوا: "ذهب الظمأ وابتلت العروق".
- ادعوا: "اللهم بلّغ ${childName} رمضان وهو صائم".

وقت السحور:
- لو استيقظ، شاركوه الأجواء.
- دعوه يشعر بالنشاط والبركة.
- همسوا له: "يا ${childName}، ده وقت البركة".

كل رمضان يكبر خطوة في علاقته بالشهر المبارك.
    `.trim()
  },
  {
    id: 'dhikr_song',
    title: 'أغنية الأذكار المرحة',
    schedule: { type: 'weekly', dayOfWeek: 1, time: '17:00' },
    buttons: ['غنّينا ✅', 'أرسل أغنية تانية 🎶'],
    keywords: ['أغنية الأذكار', 'غنينا'],
    template: ({ childName }) => `
🎵 *أغنية الأذكار لـ ${childName}*

غنّوها معه بلحن خفيف:
"سبحان الله (3 مرات) 👏👏
والحمد لله (3 مرات) 👏👏
الله أكبر (3 مرات) 👏👏
لا إله إلا الله! 🎉"

💡 لحظة مرحة + ذكر = ذاكرة جميلة.
📹 صوّروا اللحظة واحتفظوا بها.
    `.trim()
  },
  {
    id: 'dua_speed_challenge',
    title: 'تحدي السرعة للأدعية',
    schedule: { type: 'weekly', dayOfWeek: 3, time: '18:15' },
    buttons: ['لعبنا ✅', 'تحدي تاني بكرة 🎮'],
    keywords: ['تحدي السرعة'],
    template: ({ childName }) => `
⚡ *تحدي السرعة*

كل شخص لديه 30 ثانية:
قل أكبر عدد من الأدعية لـ ${childName} بسرعة!

أمثلة:
"اللهم احفظه - بارك فيه - سهّل عليه -
اجعله صالحاً - من حفظة القرآن - باراً..."

🏆 الفائز يختار دعاء اليوم التالي.
    `.trim()
  },
  {
    id: 'dua_tree_activity',
    title: 'شجرة الأدعية',
    schedule: { type: 'weekly', dayOfWeek: 0, time: '10:00' },
    buttons: ['بدأنا ✅', 'شاركوا صورة الشجرة 📸'],
    keywords: ['شجرة الأدعية'],
    template: ({ childName }) => `
🌳 *شجرة أدعية ${childName}*

1. ارسموا شجرة على ورقة كبيرة.
2. كل دعاء جديد = ورقة ملونة تُعلق على الأغصان.
3. الهدف: 30 ورقة في الشهر = 30 دعاء مختلف.

🌟 في نهاية الشهر علّقوا الشجرة في غرفته.
    `.trim()
  },
  {
    id: 'dad_voice_message',
    title: 'رسالة صوتية للأب',
    schedule: { type: 'weekly', dayOfWeek: 4, time: '21:30' },
    buttons: ['استمعت ✅', 'أرسلها مرة تانية 🔄', 'صوت الشيخ 🎧'],
    keywords: ['رسالة الأب', 'صوت الأب'],
    supportsAudio: true,
    template: ({ fatherName, childName }) => `
🎤 *رسالة خاصة لـ ${fatherName}*

يا ${fatherName}، أنت الآن تبني إنساناً كامل الروح والجسد.
كل دعوة تدعوها لـ ${childName} = استثمار في جنتك.
كل آية تقرأها بجانبه = نور في قلبه.
كل مرة تحضنه وتقول "الله يحفظك" = درع حوله.

ربنا اختارك تكون أب ${childName}.
مسؤولية؟ نعم. شرف؟ أكيد.
خذ دقيقتين ذكر معه اليوم... يمكن يكون سبباً أن يصبح عالماً أو حافظ قرآن.
    `.trim()
  },
  {
    id: 'weekly_dua_calendar',
    title: 'تقويم الأدعية الأسبوعي',
    schedule: { type: 'weekly', dayOfWeek: 0, time: '08:30' },
    buttons: ['تابعنا ✅', 'حمّل التقويم 📥'],
    keywords: ['تقويم الأدعية'],
    template: ({ childName }) => `
📆 *جدول أدعية الأسبوع لـ ${childName}*

السبت: دعاء الرزق
"اللهم ارزق ${childName} رزقاً حلالاً طيباً واسعاً"

الأحد: دعاء العلم
"اللهم علّمه ما ينفعه وانفعه بما علمته"

الاثنين: دعاء الصحة
"اللهم عافه في بدنه وسمعه وبصره"

الثلاثاء: دعاء الهداية
"اللهم اهده واجعله من الصالحين"

الأربعاء: دعاء البر
"اللهم اجعله باراً بوالديه محسناً إليهما"

الخميس: دعاء القرآن
"اللهم اجعل القرآن ربيع قلبه ونور صدره"

الجمعة: دعاء شامل
"اللهم احفظه بحفظك واكلأه برعايتك"
    `.trim()
  },
  {
    id: 'surprise_message',
    title: 'رسالة المفاجأة الشهرية',
    schedule: { type: 'monthly', dayOfMonth: 25, time: '19:15' },
    buttons: ['هذا الشيء 💚', 'ذكروني بهذا الدعاء كل شهر 🤲'],
    keywords: ['مفاجأة', 'رسالة خاصة'],
    template: ({ familyName, childName }) => `
🎁 *مفاجأة لعائلة ${familyName}*

اليوم لا توجد مهمة... فقط دعوة:
"اللهم اجمع ${familyName} في جنتك كما جمعتهم في الدنيا،
واجعل ${childName} قرة عين لهم في الدارين".

أنتم عائلة مباركة... استمتعوا بالسكينة 💚
    `.trim()
  },
  {
    id: 'grand_challenge',
    title: 'التحدي الكبير: 1000 دعوة',
    schedule: { type: 'monthly', dayOfMonth: 1, time: '20:00' },
    buttons: ['مستمرين 💪', 'عرض الإحصائيات 📊'],
    keywords: ['التحدي الكبير', '1000 دعوة'],
    template: ({ childName }) => `
🏆 *التحدي الكبير: 1000 دعوة لـ ${childName}*

كل يوم، 3 أدعية فقط.
في السنة = 1000 دعوة صادقة!

📊 التقدم الحالي (تقديري): 47 دعوة.
🎯 المتبقي: 953 دعوة.

جاهزين تكملوا السنة كلها؟
    `.trim()
  },
  {
    id: 'knowledge_library',
    title: 'مكتبة الأدعية',
    schedule: { type: 'monthly', dayOfMonth: 5, time: '11:00' },
    buttons: ['تصفح المكتبة 📚', 'حمّل الملفات 📥'],
    keywords: ['مكتبة الأدعية', 'موارد'],
    template: () => `
📚 *مكتبة أدعية الأطفال*

- أدعية مأثورة للأطفال.
- أدعية بصوت جميل (للاستماع).
- فيديوهات: كيف ترقي طفلك.
- PDF: 100 دعاء لطفلك.

📖 كتاب مقترح: "تحفة المودود بأحكام المولود" لابن القيم.
    `.trim()
  },
  {
    id: 'golden_advice',
    title: 'النصيحة الذهبية',
    schedule: { type: 'weekly', dayOfWeek: 2, time: '20:30' },
    buttons: ['دعوتنا بقلب حاضر ✅'],
    keywords: ['النصيحة الذهبية'],
    template: ({ childName }) => `
✨ *النصيحة الذهبية*

الأهم ليس عدد الأدعية ولا طولها...
الأهم: القلب الحاضر.

دعوة واحدة بقلب حاضر
أجمل من 100 دعوة بلا حضور.

اليوم اختاروا دعاء واحداً لـ ${childName} بقلب صادق... وسيصل 🤲
    `.trim()
  }
];

function createParentsPhrase(fatherName, motherName) {
  if (fatherName && motherName) {
    return `${fatherName} و${motherName}`;
  }
  return fatherName || motherName || 'أبطال العائلة';
}

function normalizeButtons(buttons = []) {
  return buttons.map((button) => button.trim()).filter(Boolean);
}

export class SpiritualRoutineService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;

    this.llm = new LLMService(config);

    this.apiKey = global.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
    this.voiceId =
      config.spiritual_routines?.voice_id ||
      config.audio_stories?.voice_id ||
      'anouj';
    this.modelId =
      config.spiritual_routines?.model_id ||
      config.audio_stories?.model_id ||
      'eleven_monolingual_v3';
    this.stability =
      typeof config.spiritual_routines?.stability === 'number'
        ? config.spiritual_routines.stability
        : 0.2;
    this.similarity =
      typeof config.spiritual_routines?.similarity === 'number'
        ? config.spiritual_routines.similarity
        : 0.82;
    this.style = config.spiritual_routines?.style || 'Calm';
  }

  /**
   * Schedule routine messages for all families for the given date
   */
  async scheduleDailyRoutines(date = new Date()) {
    if (this.config.spiritual_routines?.enabled === false) {
      console.log('ℹ️ Spiritual routines disabled in configuration.');
      return;
    }

    const targetDate = new Date(date);
    const isoDate = format(targetDate, 'yyyy-MM-dd');
    const routines = this.getApplicableRoutines(targetDate);

    if (!routines.length) {
      console.log('ℹ️ No spiritual routines to schedule today.');
      return;
    }

    console.log(`🕌 Scheduling ${routines.length} spiritual routines for ${isoDate}...`);

    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      const guardians = GuardianModel.getByFamily(family.id);
      if (!guardians.length) continue;

      const children = ChildModel.getByFamily(family.id);
      const child = this.selectPrimaryChild(children);
      const referenceGuardian = this.selectReferenceGuardian(guardians);
      if (!referenceGuardian) continue;

      const context = this.buildContext(family, guardians, child);

      for (const routine of routines) {
        const schedule = this.getRoutineSchedule(routine);
        if (!schedule?.time) continue;

        const already = SpiritualRoutineLogModel.wasScheduled(
          family.id,
          routine.id,
          isoDate
        );
        if (already) continue;

        const scheduledDate = this.buildScheduleDate(targetDate, schedule.time);
        if (!scheduledDate) continue;

        if (this.isQuietHour(scheduledDate)) {
          console.log(
            `⚠️ Skipping ${routine.id} for ${family.family_name} due to quiet hours (${schedule.time}).`
          );
          continue;
        }

        // If scheduling job ran after desired time, push to next day
        if (isBefore(scheduledDate, new Date())) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        const messageContent = this.buildRoutineMessage(routine, context);
        const buttons = this.getRoutineButtons(routine);

        const scheduledId = ScheduledMessageModel.create(
          family.id,
          referenceGuardian.id,
          `spiritual_routine:${routine.id}`,
          messageContent,
          format(scheduledDate, 'yyyy-MM-dd HH:mm:ss'),
          buttons
        );

        SpiritualRoutineLogModel.logSchedule({
          familyId: family.id,
          guardianId: referenceGuardian.id,
          routineId: routine.id,
          scheduledFor: isoDate,
          scheduledMessageId: scheduledId
        });
      }
    }

    console.log('✅ Spiritual routines scheduled successfully.');
  }

  /**
   * Generate a custom spiritual message using AI
   */
  async generateCustomContent({
    guardian,
    family,
    child,
    requestText,
    type = 'prayer'
  }) {
    if (!guardian || !family) {
      return null;
    }

    if (this.config.spiritual_routines?.ai?.enabled === false) {
      return {
        text: 'ميزة إنشاء الأدعية الذكية غير مفعّلة حالياً في الإعدادات.'
      };
    }

    const requestId = SpiritualCustomRequestModel.create({
      familyId: family.id,
      guardianId: guardian.id,
      childId: child?.id || null,
      requestText
    });

    const childAge = this.getChildAgeLabel(child);
    const messageType = type === 'story' ? 'custom_spiritual_story' : 'custom_prayer';
    const context = {
      messageType,
      guardianName: guardian.name,
      childName: child?.name || 'طفلكم',
      childAge,
      timeOfDay: this.getTimeOfDayLabel(),
      additionalContext: requestText,
      previousInteractions: [],
      activeIssues: [],
      preferredFormat: type === 'story' ? 'story' : 'text',
      configFormats: this.config.tracks?.formats || []
    };

    const aiResponse = await this.llm.generateMessage(context);
    SpiritualCustomRequestModel.updateResponse(requestId, aiResponse, null);

    return {
      text: aiResponse,
      requestId
    };
  }

  /**
   * Send custom content directly to the guardian or family group
   */
  async sendCustomContent({ guardian, family, text, buttons = ['تم ✅', 'صوت الشيخ 🎧'] }) {
    const target = this.getTargetRecipient(family, guardian);
    if (!target) {
      throw new Error('Target recipient not found for custom content');
    }

    await this.bot.sendMessageWithButtons(target, text, buttons);
  }

  /**
   * Send routine audio on demand
   */
  async sendRoutineAudio({ guardian, family, routineId, messageContent = null }) {
    if (!this.apiKey) {
      await this.bot.sendMessage(
        this.getTargetRecipient(family, guardian),
        'ميزة الصوت غير متاحة حالياً لعدم توفر مفتاح ElevenLabs.'
      );
      return;
    }

    const routineKey = routineId?.replace('spiritual_routine:', '') || routineId;
    const routine = this.getRoutineById(routineKey);

    const target = this.getTargetRecipient(family, guardian);
    if (!target) {
      return;
    }

    const guardians = GuardianModel.getByFamily(family.id);
    const child = this.selectPrimaryChild(ChildModel.getByFamily(family.id));
    const context = this.buildContext(family, guardians, child);
    const text = routine
      ? this.buildRoutineMessage(routine, context)
      : messageContent;

    if (!text) {
      await this.bot.sendMessage(
        target,
        'لم أجد النص المناسب لتحويله إلى صوت، حاول مرة أخرى أو اطلب محتوى جديداً.'
      );
      return;
    }

    try {
      const audioBuffer = await this.synthesizeAudio(text);
      if (!audioBuffer) {
        await this.bot.sendMessage(
          target,
          'تعذر إنشاء المقطع الصوتي الآن، سأحاول مرة أخرى لاحقاً.'
        );
        return;
      }

      await this.bot.sendAudioMessage(
        target,
        audioBuffer,
        'dhikr.mp3',
        `🎧 ${routine?.title || 'ذكر روحاني'} بصوت دافئ`
      );
    } catch (error) {
      console.error('❌ Failed to send routine audio:', error.message);
      await this.bot.sendMessage(
        target,
        'حدث خطأ أثناء إرسال المقطع الصوتي، جرب لاحقاً.'
      );
    }
  }

  /**
   * Try to match a routine by keyword (Arabic text)
   */
  matchRoutineByKeyword(text) {
    if (!text) return null;
    const normalized = text.toLowerCase();
    for (const routine of ROUTINES) {
      if (!routine.keywords) continue;
      if (routine.keywords.some((keyword) => normalized.includes(keyword))) {
        return routine.id;
      }
    }
    return null;
  }

  /**
   * Retrieve routine definition by id
   */
  getRoutineById(id) {
    return ROUTINES.find((routine) => routine.id === id);
  }

  /**
   * Build routine message using context
   */
  buildRoutineMessage(routine, context) {
    if (!routine?.template) return '';
    return routine.template(context);
  }

  /**
   * Get buttons for routine
   */
  getRoutineButtons(routine) {
    const override = this.getRoutineOverride(routine.id);
    if (override?.buttons && Array.isArray(override.buttons)) {
      return normalizeButtons(override.buttons);
    }
    return normalizeButtons(routine.buttons || ['تم ✅']);
  }

  /**
   * Build schedule date using HH:mm string
   */
  buildScheduleDate(baseDate, time) {
    if (!time) return null;
    const [hours, minutes] = time.split(':').map((value) => parseInt(value, 10));
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return set(new Date(baseDate), { hours, minutes, seconds: 0, milliseconds: 0 });
  }

  /**
   * Determine if given date falls inside quiet hours
   */
  isQuietHour(date) {
    const quiet = this.config.app?.quiet_hours;
    if (!quiet) return false;

    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const [startH, startM] = quiet.start.split(':').map((value) => parseInt(value, 10));
    const [endH, endM] = quiet.end.split(':').map((value) => parseInt(value, 10));
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Get routines applicable for current day
   */
  getApplicableRoutines(date) {
    const routines = [];
    for (const routine of ROUTINES) {
      const schedule = this.getRoutineSchedule(routine, date);
      if (!schedule) continue;

      if (schedule.type === 'daily') {
        routines.push(routine);
      } else if (
        schedule.type === 'weekly' &&
        typeof schedule.dayOfWeek === 'number' &&
        schedule.dayOfWeek === date.getDay()
      ) {
        routines.push(routine);
      } else if (
        schedule.type === 'monthly' &&
        typeof schedule.dayOfMonth === 'number' &&
        schedule.dayOfMonth === date.getDate()
      ) {
        routines.push(routine);
      }
    }
    return routines;
  }

  /**
   * Merge routine schedule with config overrides
   */
  getRoutineSchedule(routine) {
    const override = this.getRoutineOverride(routine.id);
    const schedule = { ...routine.schedule };

    if (override?.frequency) {
      schedule.type = override.frequency;
    }
    if (override?.type) {
      schedule.type = override.type;
    }
    if (override?.time) {
      schedule.time = override.time;
    }
    if (typeof override?.day_of_week === 'number') {
      schedule.dayOfWeek = override.day_of_week;
    }
    if (typeof override?.day_of_month === 'number') {
      schedule.dayOfMonth = override.day_of_month;
    }

    return schedule;
  }

  /**
   * Fetch override from config
   */
  getRoutineOverride(routineId) {
    return this.config.spiritual_routines?.routines?.[routineId] || null;
  }

  /**
   * Select the primary child (youngest) for personalization
   */
  selectPrimaryChild(children = []) {
    if (!children.length) return null;
    return [...children].sort((a, b) => new Date(a.birth_date) - new Date(b.birth_date))[0];
  }

  /**
   * Pick guardian used for scheduling (prefer mother then father)
   */
  selectReferenceGuardian(guardians = []) {
    return (
      guardians.find((g) => g.role === 'mother' && g.phone_number) ||
      guardians.find((g) => g.role === 'father' && g.phone_number) ||
      guardians[0]
    );
  }

  /**
   * Build context for templates
   */
  buildContext(family, guardians = [], child = null) {
    const father = guardians.find((g) => g.role === 'father');
    const mother = guardians.find((g) => g.role === 'mother');

    const fatherName = father?.name || 'الأب';
    const motherName = mother?.name || 'الأم';
    const parentsPhrase = createParentsPhrase(father?.name, mother?.name);

    return {
      childName: child?.name || 'طفلكم',
      fatherName,
      motherName,
      fatherCall: father?.name ? `${father.name}` : 'الأب',
      parentsPhrase,
      familyName: family?.family_name || parentsPhrase,
      guardiansNames: guardians.map((g) => g.name).join('، ')
    };
  }

  /**
   * Determine target recipient for a message
   */
  getTargetRecipient(family, guardian) {
    if (family?.send_to_group && family.family_group_id) {
      return family.family_group_id;
    }
    return guardian?.phone_number || null;
  }

  /**
   * Compute child age label in months/years
   */
  getChildAgeLabel(child) {
    if (!child?.birth_date) {
      return 'غير محدد';
    }
    const months = differenceInMonths(new Date(), new Date(child.birth_date));
    if (months < 12) {
      return `${months} شهر`;
    }
    const years = Math.floor(months / 12);
    return `${years} سنة`;
  }

  /**
   * Determine time of day label for now
   */
  getTimeOfDayLabel() {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 6 && hour < 12) return 'الصباح';
    if (hour >= 12 && hour < 17) return 'الظهر';
    if (hour >= 17 && hour < 22) return 'المساء';
    return 'الليل';
  }

  /**
   * Synthesize audio using ElevenLabs
   */
  async synthesizeAudio(text) {
    const apiKey = this.apiKey;
    if (!apiKey) {
      return null;
    }

    const payload = {
      text,
      model_id: this.modelId,
      voice_settings: {
        stability: this.stability,
        similarity_boost: this.similarity,
        style: this.style,
        use_speaker_boost: true
      }
    };

    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      responseType: 'arraybuffer'
    });

    return Buffer.from(response.data);
  }
}

export const SPIRITUAL_ROUTINES = ROUTINES;
