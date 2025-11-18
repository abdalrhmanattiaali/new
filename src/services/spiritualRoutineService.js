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

const SAT_TO_WED_DAYS = [6, 0, 1, 2, 3];
const THURSDAY_DAY = [4];
const FRIDAY_DAY = [5];

const WEEKLY_SLOT_FOCUS = {
  '06:30': {
    6: 'أعلن بداية أسبوع التعلم حول فهم بكاء الطفل وحدد نية جديدة للأسرة.',
    0: 'شجع على الاستمرار في اليوم الثاني واستحضار نوع جديد من البكاء للملاحظة.',
    1: 'اذكر أن اليوم مخصص للتطبيق السريع لما تعلموه بالأمس.',
    2: 'نبههم إلى مراقبة العلامات الطبية أو إشارات القلق في بكاء الطفل.',
    3: 'احتفل بالتقدم وذكرهم بأنهم أصبحوا يفهمون إشارات طفلهم بثقة.'
  },
  '08:00': {
    6: 'قدّم موضوع الأسبوع "فهم بكاء الطفل" واشرح سبب أهميته للأسرة.',
    0: 'عرّف بأنواع البكاء الثلاثة وكيفية التمييز بينها بلغة بسيطة.',
    1: 'ارشد إلى خطوات عملية للاستجابة لكل نوع من أنواع البكاء.',
    2: 'شارك مؤشرات تستدعي مراجعة الطبيب أو طلب مساعدة إضافية.',
    3: 'راجع النقاط الرئيسية واشكر الأسرة على التزامها طوال الأسبوع.'
  },
  '09:00': {
    6: 'اقترح نشاط مراقبة يومي يساعد على تسجيل أنماط البكاء ومحيطه.',
    0: 'حوّل النشاط إلى لعبة عائلية لتخمين نوع البكاء من الإشارات.',
    1: 'اطلب منهم تدوين ثلاث مواقف بكاء مع ردودهم خلال اليوم.',
    2: 'وجّه لوضع خطة طوارئ سريعة إذا ظهرت علامات مقلقة.',
    3: 'صمم تحدياً قصيراً للاستجابة للبكاء في أقل من دقيقة مع تقييم ذاتي.'
  },
  '11:00': {
    0: 'شارك معلومة متقدمة تدعم فهم اليوم الثاني لموضوع البكاء.'
  },
  '11:30': {
    1: 'راجع تقدم تحدي الأسبوع وشجع على مشاركة ملاحظة واحدة.'
  },
  '15:30': {
    6: 'قدّم درساً عملياً للأم يربط موضوع اليوم بواقعها اليومي.',
    0: 'اطلب من الأم تجربة تطبيق عملي للنقاط التي تعلمتها في اليوم الثاني.',
    1: 'اشرح تقنيات تهدئة متنوعة واقترح تجربة جديدة اليوم.',
    2: 'ركز على بناء ثقة الأم بحدسها مع تذكير بعلامات الخطر.',
    3: 'احتفل بإتقان الأم للمهارة وادعها لتوثيق ما نجح معها.'
  },
  '18:30': {
    6: 'انقل درساً عائلياً يلخص تعلم اليوم ويشرك الجميع في الحوار.',
    0: 'شجع الأسرة على تمرين تصنيف أنواع البكاء معاً هذا المساء.',
    1: 'ادعهم لمناقشة ما نجح معهم حتى الآن وتوثيقه في دفتر صغير.',
    2: 'بادر بتقسيم الأدوار داخل خطة طوارئ عائلية واضحة.',
    3: 'اقترح احتفالاً عائلياً بسيطاً لإغلاق أسبوع التعلم.'
  },
  '20:00': {
    6: 'أطلق تحدي الأسبوع الخاص بمتابعة الأدعية اليومية المرتبطة بالطفل.',
    0: 'قدّم نشاطاً روحانياً مرحاً يكسر الجدية مع الحفاظ على الهدف.',
    1: 'ذكّر بتقييم اليوم وتوثيق ما تم تطبيقه عملياً.',
    2: 'أشر إلى مشاهدة مادة تعليمية قصيرة أو مشاركة فيديو توعوي.',
    3: 'قدّم مكافأة معنوية أو فكرة احتفال خفيف بنهاية الأسبوع.'
  },
  '20:30': {
    0: 'اقترح مشاهدة فيديو توضيحي قصير حول موضوع اليوم.',
    2: 'شارك رابط فيديو تعليمي مدته 3 دقائق عن العلامات الطبية للبكاء.'
  },
  '22:00': {
    6: 'اختم يوم السبت بدعاء وتشجيع على الاستمرار في خطة الأسبوع.',
    0: 'شجع على مراجعة ما تعلموه في اليوم الثاني قبل النوم.',
    1: 'اطلب تقييم ما تم تطبيقه وشكر الذات على الجهد المبذول.',
    2: 'قدّم رسالة طمأنة بأن معظم البكاء طبيعي مع دعاء بالحفظ.',
    3: 'اختم الأسبوع بدعاء خاص وتذكير بالتحضير لمراجعة الخميس.'
  }
};

function describeAudience(audience, context) {
  switch (audience) {
    case 'father':
      return context.fatherName ? `الأب ${context.fatherName}` : 'الأب';
    case 'mother':
      return context.motherName ? `الأم ${context.motherName}` : 'الأم';
    case 'parents':
      return context.parentsPhrase ? `الوالدان ${context.parentsPhrase}` : 'الوالدان';
    case 'family':
    default:
      return context.familyName ? `عائلة ${context.familyName}` : 'العائلة';
  }
}

function resolveWeeklyFocus(slotTime, dayOfWeek, slot) {
  if (slot?.weeklyFocus && slot.weeklyFocus[dayOfWeek]) {
    return slot.weeklyFocus[dayOfWeek];
  }
  return WEEKLY_SLOT_FOCUS[slotTime]?.[dayOfWeek] || null;
}

function normalizeLines(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function compactGuidance(text, maxLength = 900) {
  if (!text) return '';
  const normalized = normalizeLines(text);
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 3).trim()}...`;
}

function buildGuidanceText(slot, context) {
  const dayOfWeek =
    typeof context.currentDayOfWeek === 'number' ? context.currentDayOfWeek : new Date().getDay();
  const focus = resolveWeeklyFocus(slot.time, dayOfWeek, slot);
  const promptLines = slot.promptLines || [];
  const bulletList = promptLines.map((line) => `- ${line}`);
  const audienceDescription = describeAudience(slot.audience, context);

  const sections = [
    `اكتب رسالة ${slot.lengthHint || 'قصيرة من 3 إلى 4 جمل'} بالعربية الدافئة.`,
    `الجمهور المستهدف: ${audienceDescription}.`,
    slot.timeDescription ? `السياق الزمني: ${slot.timeDescription}.` : `السياق الزمني: إشعار عند ${slot.time}.`,
    bulletList.length ? ['يجب أن تتضمن الرسالة:', ...bulletList].join('\n') : '',
    focus ? `توجيه خاص لهذا اليوم: ${focus}.` : '',
    slot.callToAction ? `اختم بدعوة للتطبيق: ${slot.callToAction}.` : '',
    slot.tone ? `حافظ على نبرة ${slot.tone}.` : '',
    slot.extraNotes || '',
    'اذكر اسم الطفل أو الوالدين عندما يكون طبيعياً، وتجنب تكرار النصوص حرفياً من الأيام السابقة.'
  ].filter(Boolean);
  return compactGuidance(sections.join('\n'));
}

function createRoutineDefinition(slot, defaultDays = null) {
  const scheduleType = slot.scheduleType || 'daily';
  const schedule = { type: scheduleType };

  if (slot.time) {
    schedule.time = slot.time;
  }

  if (scheduleType === 'monthly') {
    if (typeof slot.dayOfMonth === 'number') {
      schedule.dayOfMonth = slot.dayOfMonth;
    }
  } else if (scheduleType === 'weekly') {
    if (typeof slot.dayOfWeek === 'number') {
      schedule.dayOfWeek = slot.dayOfWeek;
    } else if (Array.isArray(slot.daysOfWeek) && slot.daysOfWeek.length) {
      schedule.daysOfWeek = slot.daysOfWeek;
    } else if (defaultDays?.length) {
      schedule.daysOfWeek = defaultDays;
    }
  } else {
    if (Array.isArray(slot.daysOfWeek) && slot.daysOfWeek.length) {
      schedule.daysOfWeek = slot.daysOfWeek;
    } else if (defaultDays?.length) {
      schedule.daysOfWeek = defaultDays;
    }
  }

  return {
    id: slot.id,
    title: slot.title,
    schedule,
    audience: slot.audience || 'family',
    buttons: slot.buttons,
    keywords: slot.keywords,
    supportsAudio: Boolean(slot.supportsAudio),
    preferredFormat: slot.preferredFormat,
    messageType: slot.messageType,
    trackMetadata: slot.trackMetadata,
    weeklyFocus: slot.weeklyFocus,
    extraGuidance: slot.extraGuidance,
    guidance: (context) =>
      typeof slot.customGuidance === 'function'
        ? slot.customGuidance(context)
        : buildGuidanceText(slot, context)
  };
}

const DAILY_SLOTS = [
  {
    id: 'daily_0630_morning_blessing',
    title: 'إشراقة الدعاء الصباحي',
    time: '06:30',
    audience: 'family',
    buttons: ['دعاء الصباح ✅', 'دَفعة للأب 💪'],
    keywords: ['دعاء الصباح', 'آية الاستيقاظ', 'تحفيز الأب', 'ابدأ يومك'],
    promptLines: [
      'ابدأ اليوم بآية قصيرة ودعاء الاستيقاظ مع وضع اليد برفق على رأس الطفل.',
      'أضف سطر تحفيزي للأب يدعوه لصناعة لحظة صباحية خاصة قبل مغادرة المنزل.',
      'شجع العائلة على تكرار الذكر بصوت مسموع وتوثيق شعورهم في مذكرة صغيرة.'
    ],
    tone: 'روحانية متفائلة',
    callToAction: 'اطلب من الوالدين إرسال دعاء أو رسالة صوتية قصيرة بعد تطبيق الطقس.',
    timeDescription: 'مع إشراقة الصباح قبل انطلاق الروتين',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_0700_morning_adhkar',
    title: 'أذكار وروتين الصباح',
    time: '07:00',
    audience: 'parents',
    buttons: ['ذكرنا ✅', 'روتين الصباح جاهز 🔄'],
    keywords: ['أذكار الصباح', 'ذكر جماعي', 'روتين الصباح', 'وقت البطن'],
    promptLines: [
      'قدّم فقرة أذكار مختصرة (2-3 جمل) يمكن قولها أثناء تجهيز الطفل.',
      'ادمج تعليمات روتين الصباح: رضاعة، تغيير حفاض، ووقت بطن قصير مع تواصل بصري.',
      'اذكر فائدة واحدة لكل خطوة وشجع على تدوين رد فعل الطفل.'
    ],
    tone: 'روحانية عملية',
    callToAction: 'ادعُ الوالدين لضبط منبه يومي لهذا الروتين ومشاركة ملاحظة في نهاية الأسبوع.',
    timeDescription: 'بعد الاستيقاظ وخلال إعداد المنزل',
    preferredFormat: 'checklist'
  },
  {
    id: 'daily_0800_father_lesson',
    title: 'درس الصباح ودعم الأم',
    time: '08:00',
    audience: 'family',
    buttons: ['استلهمنا ✅', 'طاقة إضافية 💚'],
    keywords: ['درس الأب', 'تعلم الأب', 'رسالة للأم', 'تشجيع الصباح'],
    promptLines: [
      'قدّم درساً تربوياً قصيراً للأب مرتبطاً بموضوع الأسبوع مع خطوة تطبيق واحدة.',
      'أضف كلمات تقدير للأم وتمرين تنفس أو استراحة سريعة لاستعادة طاقتها.',
      'اختم بسؤال قصير يدعو الشريكين لتبادل شعور إيجابي قبل انشغال اليوم.'
    ],
    tone: 'تحفيزية وداعمة',
    callToAction: 'شجع الأب على كتابة ملاحظة تعلم واحدة ومشاركتها مع الأم مساءً.',
    timeDescription: 'بداية ساعات العمل للأبوين',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_0900_child_activity_one',
    title: 'نشاط الصباح وتخطيط الطقس',
    time: '09:00',
    audience: 'parents',
    buttons: ['لعبنا ✅', 'جهزنا الملابس 👕'],
    keywords: ['نشاط الصباح', 'تطوير الطفل', 'الطقس', 'ملابس الطفل'],
    promptLines: [
      'اقترح نشاطاً حسياً أو حركياً قصيراً مع الأدوات المطلوبة وكيفية رصد استجابة الطفل.',
      'أضف ملخصاً لحالة الطقس ولباساً مقترحاً للطفل إذا خرجوا اليوم.',
      'ذكّر بمشاركة صورة للنشاط أو للإطلالة في دفتر العائلة.'
    ],
    tone: 'مرحة وعملية',
    callToAction: 'ادعُ الوالدين لتسجيل الملاحظة الأبرز عن تفاعل الطفل بعد النشاط.',
    timeDescription: 'بعد الإفطار وقبل الخروج من المنزل',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1000_mother_break',
    title: 'استراحة وقصة منتصف الصباح',
    time: '10:00',
    audience: 'family',
    buttons: ['استراحة وقصة ✅', 'قصة جديدة 📖'],
    keywords: ['استراحة', 'تنفس', 'قصة تربوية', 'قصة دينية'],
    promptLines: [
      'ذكر الأم بأخذ لحظة ماء أو وجبة خفيفة مع تمرين تنفس سريع.',
      'اقترح قصة قصيرة (تربوية أو دينية) مع العبرة وكيفية سردها للطفل.',
      'شجع على تدوين فكرة القصة أو تسجيل صوتي قصير أثناء السرد.'
    ],
    tone: 'دافئة وملهمة',
    callToAction: 'اطلب مشاركة جملة واحدة مما ألهمهم في القصة داخل دفتر اللحظات.',
    timeDescription: 'منتصف الصباح قبل عودة الانشغال',
    preferredFormat: 'story'
  },
  {
    id: 'daily_1100_micro_learning',
    title: 'معلومة اليوم ولحظة موسيقية',
    time: '11:00',
    audience: 'parents',
    buttons: ['تعلمنا ولعبنا 🎵', 'معلومة إضافية 💡'],
    keywords: ['نصيحة تربوية', 'معلومة علمية', 'أنشودة', 'سورة هادئة'],
    promptLines: [
      'شارك حقيقة علمية أو تربوية عن تطور الطفل مع مثال تطبيقي واضح.',
      'اقترح سورة أو أنشودة هادئة تُشغّل أثناء اللعب أو الاسترخاء.',
      'بيّن كيف يساعد الصوت الهادئ على تهدئة الحواس وتقوية الروابط.'
    ],
    tone: 'علمية مطمئنة',
    timeDescription: 'ختام فترة الصباح',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1200_lunch_dua',
    title: 'دعاء الغداء واستعداد القيلولة',
    time: '12:00',
    audience: 'family',
    buttons: ['غدينا ونمنا ✅', 'ذكرني للقيلولة 😴'],
    keywords: ['دعاء الطعام', 'غداء', 'قيلولة', 'تهدئة'],
    promptLines: [
      'قدّم دعاء الطعام بصيغة عائلية بسيطة مع إشراك الطفل ولو بالاستماع.',
      'اذكر خطوات تهدئة ما قبل القيلولة والعلامات التي تدل على تعب الطفل.',
      'أضف فائدة روحية أو صحية لاستمرار هذا الطقس يومياً.'
    ],
    tone: 'روحانية منظمة',
    timeDescription: 'بداية فترة الظهيرة',
    preferredFormat: 'checklist'
  },
  {
    id: 'daily_1300_father_midday',
    title: 'رسالة الأب ونصيحة التغذية',
    time: '13:00',
    audience: 'family',
    buttons: ['دعاء الأب ✅', 'نصيحة رضاعة 🍼'],
    keywords: ['رسالة الأب', 'دعاء سريع', 'تغذية', 'رضاعة'],
    promptLines: [
      'ذكر الأب بالدعاء للطفل أثناء العمل وإرسال تحية صوتية عند الاستراحة.',
      'أضف تذكيراً بنصيحة تغذية أو رضاعة تراقب علامات الجوع والشبع.',
      'شجع على تجربة وضعية جديدة أو مشاركة ملاحظة مع الشريك مساءً.'
    ],
    tone: 'مؤثرة وعملية',
    timeDescription: 'منتصف النهار أثناء الاستراحة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1400_mother_selfcare',
    title: 'رعاية الأم والدعم العاطفي',
    time: '14:00',
    audience: 'mother',
    buttons: ['اعتنيت بنفسي ✅', 'دعم إضافي 💌'],
    keywords: ['رعاية الذات', 'طاقة الأم', 'دعم عاطفي', 'قوة الأم'],
    promptLines: [
      'اقترح نشاط رعاية ذاتية بسيط (ماء، قراءة آية، كتابة امتنان).',
      'أضف رسالة تعاطف تعترف بتعب منتصف اليوم وتشجع على مشاركة الشعور.',
      'اختمي بفكرة مكافأة صغيرة في المساء تقديراً لصمودها.'
    ],
    tone: 'حنون وتعاطفي',
    timeDescription: 'منتصف الظهيرة حيث قد ينخفض المزاج',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1500_family_pause',
    title: 'استراحة العصر ودرس اليوم',
    time: '15:00',
    audience: 'family',
    buttons: ['استراحة الدرس ✅', 'أرسل مثالاً 📘'],
    keywords: ['استراحة العصر', 'ذكر', 'درس الأم', 'تعلم الأم'],
    promptLines: [
      'ادعُ العائلة لشرب شيء دافئ أو ماء مع ذكر قصير أو تنفس هادئ.',
      'قدّم درساً عملياً للأم ضمن موضوع الأسبوع مع تطبيق واحد.',
      'شجع على تدوين ما تعلّمته الأم لمناقشته مع الشريك لاحقاً.'
    ],
    tone: 'هادئة وتعليمية',
    timeDescription: 'بداية فترة بعد الظهر',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1600_child_activity_two',
    title: 'نشاط ما بعد القيلولة ودعاء العصر',
    time: '16:00',
    audience: 'family',
    buttons: ['نشاط ودعاء ✅', 'أرسل نشاطاً 🧸'],
    keywords: ['نشاط بعد القيلولة', 'لعب', 'دعاء العصر', 'ساعة الإجابة'],
    promptLines: [
      'اقترح نشاطاً قصيراً يركز على التواصل أو اللغة بعد القيلولة.',
      'أضف تذكيراً بدعاء العصر وقسّم العبارات بين الوالدين مع ذكر اسم الطفل.',
      'شجع على تدوين استجابة الطفل للنشاط أو لحظة الخشوع.'
    ],
    tone: 'مرحة وروحانية',
    timeDescription: 'قبل العصر بقليل',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1700_playtime',
    title: 'مرح المساء واستعداد عودة الأب',
    time: '17:00',
    audience: 'family',
    buttons: ['لعبنا ونستعد ✅', 'أنا في الطريق 🚗'],
    keywords: ['لعب عائلي', 'مرح', 'العودة للمنزل', 'تنبيه الأب'],
    promptLines: [
      'اقترح لعبة عائلية سريعة قبل وصول الأب واذكر مدة واضحة.',
      'ذكّر الأب برسالة دافئة أو ذكر يقوله أثناء العودة إلى المنزل.',
      'ادعُ الجميع لتوثيق ضحكة أو تعليق قصير عند اجتماعهم.'
    ],
    tone: 'مرحة وداعمة',
    timeDescription: 'قبل اجتماع العائلة مساءً',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1800_maghrib_call',
    title: 'دعاء المغرب ودرس العائلة',
    time: '18:00',
    audience: 'family',
    buttons: ['دعاء المغرب ✅', 'شاركنا درساً 📘'],
    keywords: ['أذان المغرب', 'دعاء', 'درس لعائلة', 'تعلم جماعي'],
    promptLines: [
      'ذكّر بفضل الدعاء عند أذان المغرب مع صيغة يسيرة وإشراك الطفل.',
      'قدّم خلاصة قصيرة لما تعلّمته العائلة اليوم وكيفية تطبيقه مساءً.',
      'شجع على تدوين فكرة أو دعاء مستجاب في دفتر العائلة.'
    ],
    tone: 'روحانية تعليمية',
    timeDescription: 'بعد أذان المغرب مباشرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1900_dinner_routine',
    title: 'عشاء العائلة وتوثيق اللحظة',
    time: '19:00',
    audience: 'family',
    buttons: ['عشاء وذكريات ✅', 'أرسل فكرة 📸'],
    keywords: ['عشاء العائلة', 'جلسة عائلية', 'ذكريات', 'توثيق'],
    promptLines: [
      'شجع على جلسة عشاء بلا شاشات مع سؤال حوار بسيط.',
      'اقترح طريقة لتوثيق لحظة مسائية بصورة أو جملة امتنان.',
      'اذكر كيف يمكن إشراك الطفل حتى لو كان في الحضن أو المقعد.'
    ],
    tone: 'عائلية دافئة',
    timeDescription: 'بعد العشاء مباشرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_2000_family_activity',
    title: 'نشاط السهرة واللحظة التفاعلية',
    time: '20:00',
    audience: 'family',
    buttons: ['نشاط وضحك ✅', 'لعبة إضافية 🎭'],
    keywords: ['نشاط عائلي', 'تحدي أسبوعي', 'لعبة تفاعلية', 'مرح'],
    promptLines: [
      'قدّم نشاطاً أو تحدياً عائلياً (رقصة، لعبة، عدّ الضحكات).',
      'أضف لعبة تفاعلية بسيطة تحفّز الضحك مثل طخ-بخ أو الاختباء.',
      'شجع على تسجيل لحظات الصوت أو الفيديو ومشاركتها مع الأقارب.'
    ],
    tone: 'مرحة وتفاعلية',
    timeDescription: 'منتصف السهرة العائلية',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_2100_bedtime_prep',
    title: 'تحضير النوم والقصة الهادئة',
    time: '21:00',
    audience: 'family',
    buttons: ['روتين النوم ✅', 'قصة جديدة 📖'],
    keywords: ['روتين النوم', 'حمام الطفل', 'قصة قبل النوم', 'هدوء'],
    promptLines: [
      'اذكر خطوات روتين النوم (حمام دافئ، مساج، ملابس مريحة، تخفيف الإضاءة).',
      'اقترح قصة أو سورة قصيرة بصوت منخفض مع لمسات حانية.',
      'ذكّر بتوثيق ملاحظة عن نوم الطفل أو الكلمة التي أحب سماعها.'
    ],
    tone: 'حانية وهادئة',
    timeDescription: 'اللحظات الأخيرة قبل النوم',
    preferredFormat: 'checklist'
  },
  {
    id: 'daily_2145_sleep_dua',
    title: 'دعاء النوم وختام اليوم',
    time: '22:00',
    audience: 'family',
    buttons: ['دعاء الختام ✅', 'صوت الشيخ 🎧'],
    keywords: ['دعاء النوم', 'رقية', 'ختام اليوم', 'طمأنة'],
    promptLines: [
      'قدّم أدعية النوم الأساسية مع قراءة المعوذات والنفث برفق وذكر اسم الطفل.',
      'أضف دعوة امتنان لليوم وتذكيراً بإمكانية تحويل الرسالة إلى مقطع صوتي.',
      'شجع الوالدين على كتابة نعمة واحدة قبل إغلاق اليوم.'
    ],
    tone: 'روحانية مطمئنة',
    timeDescription: 'ختام اليوم واستعداد لليلة هادئة',
    preferredFormat: 'quick_tip',
    supportsAudio: true
  }
];

const FRIDAY_SLOTS = [
  {
    id: 'friday_0530_pre_fajr',
    title: 'قبل الفجر',
    time: '05:30',
    audience: 'family',
    buttons: ['دعونا ✅', 'ذكرني لاحقاً 🔔'],
    keywords: ['جمعة مباركة', 'قيام الليل'],
    promptLines: [
      'ذكر العائلة بفضل الدعاء قبل الفجر في يوم الجمعة.',
      'اقترح نية مخصوصة للطفل والحماية له.',
      'شجع على كتابة دعوة واحدة في مذكرة جمعة مباركة.'
    ],
    tone: 'روحانية هادئة',
    timeDescription: 'قبل أذان الفجر بقليل',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_0600_post_fajr',
    title: 'بعد الفجر وتحيات الجمعة',
    time: '06:00',
    audience: 'family',
    buttons: ['صلينا ✅', 'جمعة مباركة 🎉'],
    keywords: ['ورد الجمعة', 'صلاة على النبي', 'جمعة مباركة', 'تحية الجمعة'],
    promptLines: [
      'ذكّر بالصلاة على النبي بعد الفجر مع نية استقبال يوم الجمعة كعيد أسبوعي للأسرة.',
      'اقترح احتضان الطفل أثناء الذكر وقول "جمعة مباركة" باسمه مع ترتيب البيت بلمسة بسيطة.',
      'شجع على تسجيل الدعاء المستجاب أو إرسال ملصق تهنئة في مجموعة العائلة.'
    ],
    tone: 'روحانية مبهجة',
    timeDescription: 'بعد الفجر مباشرة مع تحية صباحية',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_0730_ritual_prep',
    title: 'طقوس الجمعة',
    time: '07:30',
    audience: 'mother',
    buttons: ['جهزناه ✅', 'أحتاج أفكاراً 🌸'],
    keywords: ['غسل الجمعة', 'تحضير الطفل'],
    promptLines: [
      'تذكير بغسل الطفل وارتداء أجمل الملابس مع رائحة لطيفة.',
      'اذكر ذكرى قصيرة يقولونها أثناء ارتداء الملابس.',
      'شجع على التقاط صورة “جمعة مباركة” في هذا التوقيت.'
    ],
    tone: 'احتفالية ومرتبة',
    timeDescription: 'صباح الجمعة قبل الاستعدادات الكبرى',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_0800_father_ready',
    title: 'استعداد الأب',
    time: '08:00',
    audience: 'father',
    buttons: ['استعديت ✅', 'أحتاج تذكيراً 📿'],
    keywords: ['سواك', 'الذهاب للمسجد'],
    promptLines: [
      'قائمة سريعة لاستعداد الأب: غسل، سواك، طيب، نية دعاء للطفل.',
      'ذكّر بكتابة دعوة خاصة للطفل قبل التوجه للمسجد.',
      'اقترح إرسال رسالة قصيرة للأسرة عند خروجه.'
    ],
    tone: 'منظمة ومحفزة',
    timeDescription: 'قبل خروج الأب لصلاة الجمعة',
    preferredFormat: 'checklist'
  },
  {
    id: 'friday_0900_family_reading',
    title: 'قراءة سورة الكهف',
    time: '09:00',
    audience: 'family',
    buttons: ['قرأنا ✅', 'أرسل رابط تلاوة 🎧'],
    keywords: ['سورة الكهف', 'قراءة جماعية'],
    promptLines: [
      'دعوة لقراءة سورة الكهف بصوت مسموع مع الطفل.',
      'اقترح تقسيم السورة بين الوالدين حسب القدرة.',
      'اذكر كيف يمكن تهيئة جو هادئ أثناء القراءة.'
    ],
    tone: 'روحانية عائلية',
    timeDescription: 'الصباح المتأخر يوم الجمعة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_1000_story_time',
    title: 'قصة الجمعة',
    time: '10:00',
    audience: 'family',
    buttons: ['قرأنا القصة ✅', 'أرسل قصة أخرى 📚'],
    keywords: ['قصة الجمعة', 'سيرة'],
    promptLines: [
      'قصة قصيرة عن صحابي أو قيمة ترتبط بيوم الجمعة.',
      'استخلص عبرة عملية يمكن تطبيقها في العائلة اليوم.',
      'شجع على سرد القصة أمام الطفل بصوت مفعم بالحماس.'
    ],
    tone: 'قصصية ملهمة',
    timeDescription: 'منتصف الصباح',
    preferredFormat: 'story'
  },
  {
    id: 'friday_1130_home_prep',
    title: 'تجهيز المنزل',
    time: '11:30',
    audience: 'family',
    buttons: ['البيت جاهز ✅', 'نحتاج خطة تنظيف 🧹'],
    keywords: ['تنظيم البيت', 'جمعة'],
    promptLines: [
      'قائمة سريعة لتنظيف وترتيب البيت قبل صلاة الجمعة.',
      'اقترح تقسيم المهام بين الوالدين بما يناسب طاقتهم.',
      'اذكر كيف يمكن إشراك الطفل عبر وصف ما يجري حوله.'
    ],
    tone: 'عملي ومنظم',
    timeDescription: 'قبل خروج الأب بقليل',
    preferredFormat: 'checklist'
  },
  {
    id: 'friday_1200_departure',
    title: 'الذهاب للمسجد',
    time: '12:00',
    audience: 'father',
    buttons: ['في الطريق ✅', 'أرسل دعاءاً 📿'],
    keywords: ['صلاة الجمعة', 'خروج الأب'],
    promptLines: [
      'ذكر بدعاء الخروج من المنزل والتوكل على الله.',
      'شجع الأب على تخصيص دعاء للطفل والأم في السجدة الأولى.',
      'اقترح مشاركة خلاصة الخطبة بعد الصلاة مع الأسرة.'
    ],
    tone: 'دينية محفزة',
    timeDescription: 'قبل مغادرة المنزل للمسجد',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_1230_dua_window',
    title: 'ساعة إجابة الجمعة',
    time: '13:00',
    audience: 'mother',
    buttons: ['دعوت ✅', 'أحتاج أدعية 📿'],
    keywords: ['ساعة الإجابة', 'دعاء الجمعة'],
    promptLines: [
      'ذكّر الأم بأن هذا الوقت من أفضل أوقات الدعاء.',
      'قدم ثلاثة أدعية قصيرة تخص الطفل والأم والأسرة.',
      'اقترح تسجيل الدعاء بصوت خافت للاحتفاظ به.'
    ],
    tone: 'روحانية مؤثرة',
    timeDescription: 'بعد صلاة الجمعة وأثناء هدوء الظهر',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_1600_family_activity',
    title: 'نشاط الجمعة الكبير',
    time: '16:00',
    audience: 'family',
    buttons: ['استمتعنا ✅', 'اقترح نشاطاً 🎪'],
    keywords: ['نشاط الجمعة', 'خروجة'],
    promptLines: [
      'اقترح نشاطاً خاصاً بالجمعة (نزهة، لعبة جماعية، زيارة أقارب).',
      'اذكر كيفية تهيئة الطفل للنشاط مع الحذر من الإرهاق.',
      'شجع على التقاط صور أو تسجيل انطباعات بعد العودة.'
    ],
    tone: 'احتفالية وعائلية',
    timeDescription: 'بعد العصر',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_1900_special_dinner',
    title: 'عشاء الجمعة',
    time: '19:00',
    audience: 'family',
    buttons: ['تناولنا العشاء ✅', 'أرسل وصفة 🍽️'],
    keywords: ['عشاء خاص', 'جمعة'],
    promptLines: [
      'اقتراح إعداد وجبة مميزة يشارك فيها الجميع.',
      'اذكر دعاء أو ذكر يقال قبل تناول العشاء.',
      'شجع على مشاركة لحظة امتنان جماعي قبل الطعام.'
    ],
    tone: 'عائلية دافئة',
    timeDescription: 'مساء الجمعة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_2000_family_circle',
    title: 'مجلس الجمعة',
    time: '20:00',
    audience: 'family',
    buttons: ['اجتمعنا ✅', 'شاركنا إنجازاً 🗣️'],
    keywords: ['مجلس الجمعة', 'مشاركة'],
    promptLines: [
      'شجع العائلة على الجلوس في دائرة ومشاركة حدث جميل من الأسبوع.',
      'اقترح تدوين أبرز الإنجازات في دفتر الجمعة.',
      'أضف دعاء ختامي مشترك للأسرة والطفل.'
    ],
    tone: 'تواصلي ووجداني',
    timeDescription: 'المساء قبل النوم',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_2130_special_bath',
    title: 'حمام الجمعة',
    time: '21:30',
    audience: 'mother',
    buttons: ['استمتعنا ✅', 'أرسل وصفة استرخاء 🛁'],
    keywords: ['حمام الطفل', 'استرخاء'],
    promptLines: [
      'خطوات حمام دافئ مميز للطفل مع أغنية الجمعة.',
      'اقترح استخدام زيوت لطيفة أو تدليك بسيط بعد الحمام.',
      'شجع على ترديد دعاء الحفظ أثناء تجفيف الطفل.'
    ],
    tone: 'مريحة ومطمئنة',
    timeDescription: 'قبل النوم مباشرة',
    preferredFormat: 'checklist'
  },
  {
    id: 'friday_2230_week_reflection',
    title: 'تأمل الجمعة',
    time: '22:30',
    audience: 'family',
    buttons: ['تأملنا ✅', 'أرسل دعاءً شهرياً 🌙'],
    keywords: ['تأمل أسبوعي', 'ختام الجمعة'],
    promptLines: [
      'اطلب من العائلة ذكر ثلاث نعم ممتنين لها هذا الأسبوع.',
      'اقترح كتابة نية للأسبوع القادم في دفتر الملاحظات.',
      'اختم بدعاء جامع يثبت هذه العادات الطيبة.'
    ],
    tone: 'روحانية متوازنة',
    timeDescription: 'ختام يوم الجمعة',
    preferredFormat: 'quick_tip'
  }
];
const THURSDAY_SLOTS = [
  {
    id: 'thursday_0800_review_start',
    title: 'بداية المراجعة',
    time: '08:00',
    audience: 'family',
    buttons: ['انطلقنا ✅', 'أرسل جدولاً 🗓️'],
    keywords: ['مراجعة الأسبوع', 'الخميس'],
    promptLines: [
      'دعوة لافتتاح يوم المراجعة بنية شكر على ما تعلمته العائلة.',
      'اذكر ثلاثة محاور رئيسية سيتم تقييمها اليوم.',
      'شجع على تجهيز دفتر أو لوحة لتسجيل الإنجازات.'
    ],
    tone: 'تحفيزية ومنظمة',
    timeDescription: 'بداية صباح الخميس',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_0900_quiz',
    title: 'اختبار قصير',
    time: '09:00',
    audience: 'parents',
    buttons: ['حللنا ✅', 'أرسل أسئلة إضافية ❓'],
    keywords: ['اختبار تفاعلي', 'تقييم'],
    promptLines: [
      'قدم خمسة أسئلة سريعة حول موضوع الأسبوع.',
      'اقترح طريقة لجعل التقييم ممتعاً (استخدام بطاقات أو أصوات).',
      'شجع على تدوين النقاط المضيئة والإجابات المتميزة.'
    ],
    tone: 'تفاعلية ومرحة',
    timeDescription: 'صباح الخميس بعد الإفطار',
    preferredFormat: 'checklist'
  },
  {
    id: 'thursday_1000_progress',
    title: 'تقرير التقدم',
    time: '10:00',
    audience: 'parents',
    buttons: ['اطلعنا ✅', 'أرسل رسماً بيانياً 📊'],
    keywords: ['تقدم الطفل', 'تقييم الأسبوع'],
    promptLines: [
      'ملخص بالأرقام أو النقاط حول ما تم تطبيقه خلال الأسبوع.',
      'حدد الإنجازات الكبرى للطفل ولكل والد.',
      'اذكر مجالاً واحداً يحتاج مزيداً من التركيز في الأسبوع القادم.'
    ],
    tone: 'تحليلية ومشجعة',
    timeDescription: 'منتصف صباح الخميس',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_1100_application_review',
    title: 'تقييم التطبيق',
    time: '11:00',
    audience: 'mother',
    buttons: ['قيّمنا ✅', 'أحتاج أمثلة 📝'],
    keywords: ['تقييم التطبيق', 'خبرة الأم'],
    promptLines: [
      'شجع الأم على ذكر موقفين نجحت فيهما بتطبيق الدروس.',
      'اطرح سؤال تفكير: ما أكثر ما ساعدها هذا الأسبوع؟',
      'اقترح تدوين تحدٍ واجهته وكيف يمكن تجاوزه الأسبوع المقبل.'
    ],
    tone: 'تفكرية وداعمة',
    timeDescription: 'اقتراب الظهيرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_1200_story_share',
    title: 'مشاركة التجارب',
    time: '12:00',
    audience: 'family',
    buttons: ['شاركنا ✅', 'أرسل قالب مشاركة 💬'],
    keywords: ['قصص النجاح', 'مشاركة'],
    promptLines: [
      'ادعُ كل والد لذكر موقف نجح فيه خلال الأسبوع.',
      'شجع على مشاركة صوتية أو نصية يمكن الاحتفاظ بها.',
      'اقترح إرسال واحدة من القصص لأحد الأقارب لإشراكه.'
    ],
    tone: 'اجتماعية ومحفزة',
    timeDescription: 'وقت الظهيرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_1300_certificate',
    title: 'شهادة الأسبوع',
    time: '13:00',
    audience: 'family',
    buttons: ['استلمنا الشهادة ✅', 'نحتاج قالباً 📄'],
    keywords: ['شهادة الأسبوع', 'احتفال'],
    promptLines: [
      'شجع على تصميم شهادة بسيطة “عائلة الأسبوع”.',
      'اقترح كتابة إنجاز الطفل في الشهادة بخط يدوي جميل.',
      'اذكر فكرة لتعليق الشهادة أو تصوير لحظة الاستلام.'
    ],
    tone: 'احتفالية ومحفزة',
    timeDescription: 'بعد الظهر مباشرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_1500_look_ahead',
    title: 'نظرة للأمام',
    time: '15:00',
    audience: 'parents',
    buttons: ['حددنا الهدف ✅', 'نحتاج اقتراحاً 🎯'],
    keywords: ['هدف الأسبوع القادم', 'تخطيط'],
    promptLines: [
      'اقترح اختيار هدف واحد واضح للأسبوع القادم.',
      'قدم مثالاً لخطوة أولى سهلة لتحقيق الهدف.',
      'شجع على كتابة الجملة في مكان ظاهر (سبورة أو مذكرة).' 
    ],
    tone: 'تخطيطية ومحفزة',
    timeDescription: 'بداية فترة العصر',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_1700_resources',
    title: 'موارد إضافية',
    time: '17:00',
    audience: 'parents',
    buttons: ['اطلعنا ✅', 'أرسل رابطاً 📚'],
    keywords: ['موارد إضافية', 'تعلم'],
    promptLines: [
      'شارك ثلاثة مصادر (مقال، بودكاست، فيديو) تعزز موضوع الأسبوع.',
      'وضح في سطر كيف يستخدم كل مصدر بسرعة.',
      'أشر إلى مصدر واحد مناسب للمشاركة مع الأصدقاء.'
    ],
    tone: 'تثقيفية عملية',
    timeDescription: 'بعد العصر',
    preferredFormat: 'checklist'
  },
  {
    id: 'thursday_1900_review_video',
    title: 'فيديو المراجعة',
    time: '19:00',
    audience: 'family',
    buttons: ['شاهدنا ✅', 'أرسل رابطاً 🎬'],
    keywords: ['فيديو المراجعة', 'ملخص'],
    promptLines: [
      'اقترح فيديو 5 دقائق يلخص الأسبوع بطريقة ممتعة.',
      'شجع على مشاهدة الفيديو مع الطفل وذكر أبرز لقطة.',
      'اطلب تدوين ملاحظة من كل والد حول ما تعلمه من الفيديو.'
    ],
    tone: 'مرئية تفاعلية',
    timeDescription: 'المساء بعد العشاء',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_2000_completion_reward',
    title: 'مكافأة الإكمال',
    time: '20:00',
    audience: 'family',
    buttons: ['احتفلنا ✅', 'اقترح مكافأة 🎁'],
    keywords: ['مكافأة', 'تحفيز'],
    promptLines: [
      'قدم فكرة لمكافأة رمزية (حلوى صغيرة، وقت لعب إضافي).',
      'أضف عبارة تهنئة دافئة لجهد الأسرة.',
      'شجع على التقاط صورة للاحتفال ومشاركتها مع الأقارب.'
    ],
    tone: 'مبهجة ومحفزة',
    timeDescription: 'مساء الخميس',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_2100_reflection',
    title: 'تأمل شخصي',
    time: '21:00',
    audience: 'parents',
    buttons: ['تأملنا ✅', 'أرسل أسئلة تفكير 🤔'],
    keywords: ['تأمل', 'تفكير'],
    promptLines: [
      'اطرح سؤالين للتأمل الشخصي لكل والد حول دورهما هذا الأسبوع.',
      'شجع على كتابة إجابة قصيرة أو تسجيل صوتي خاص.',
      'اقترح مشاركة الشعور المختار مع الشريك قبل النوم.'
    ],
    tone: 'عميقة ومطمئنة',
    timeDescription: 'قبل النوم بقليل',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'thursday_2200_closing',
    title: 'ختام الخميس',
    time: '22:00',
    audience: 'family',
    buttons: ['أغلقنا اليوم ✅', 'ذكرني ببداية الجمعة 🔔'],
    keywords: ['ختام المراجعة', 'استعداد الجمعة'],
    promptLines: [
      'اجمع العائلة على دعاء قصير لشكر الله على أسبوع التعلم.',
      'ذكّر بالاستعداد ليوم الجمعة وطقوسه الخاصة.',
      'أشر إلى أهمية النوم المبكر لاستقبال اليوم المبارك.'
    ],
    tone: 'روحانية مطمئنة',
    timeDescription: 'نهاية يوم المراجعة',
    preferredFormat: 'quick_tip'
  }
];
const SPECIAL_SLOTS = [
  {
    id: 'weekly_big_challenge',
    title: 'التحدي الكبير: 1000 دعوة',
    time: '21:15',
    scheduleType: 'weekly',
    dayOfWeek: 0,
    audience: 'family',
    buttons: ['مستمرين ✅', 'عرض الإحصائيات 📊'],
    keywords: ['التحدي الكبير', 'دعاء يومي'],
    promptLines: [
      'ذكر العائلة بهدف جمع 1000 دعوة للطفل خلال العام.',
      'أضف إحصائية تقديرية (عدد الدعوات لهذا الأسبوع أو الشهر).',
      'اقترح طريقة مبتكرة لحفظ العدّاد (لوحة، تطبيق، دفتر).' 
    ],
    tone: 'تحفيزية وملهمة',
    timeDescription: 'مساء كل أحد بعد الروتين اليومي',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'weekly_resource_library',
    title: 'مكتبة أدعية الأطفال',
    time: '11:45',
    scheduleType: 'weekly',
    dayOfWeek: 2,
    audience: 'parents',
    buttons: ['تصفحنا ✅', 'أرسل روابط إضافية 📚'],
    keywords: ['مكتبة الأدعية', 'موارد دينية'],
    promptLines: [
      'شارك رابطاً لملف أو قائمة أدعية جاهزة للأطفال.',
      'اقترح كيفية استخدام الموارد (طباعة، تسجيل صوتي، جلسة عائلية).',
      'اذكر دعاءً قصيراً من المكتبة كنموذج.'
    ],
    tone: 'تثقيفية منظمة',
    timeDescription: 'منتصف نهار الثلاثاء',
    preferredFormat: 'checklist'
  },
  {
    id: 'monthly_spiritual_surprise',
    title: 'مفاجأة روحانية',
    time: '19:30',
    scheduleType: 'monthly',
    dayOfMonth: 15,
    audience: 'family',
    buttons: ['استلمنا المفاجأة ✅', 'أرسل فكرة مختلفة 🎁'],
    keywords: ['مفاجأة روحية', 'تجديد'],
    promptLines: [
      'شارك محتوى مفاجئ (قصة صوتية، لعبة ذكر، بطاقة افتراضية).',
      'اشرح كيف يستخدم خلال الأسبوع القادم.',
      'شجع على مشاركة انطباع العائلة عن المفاجأة.'
    ],
    tone: 'مبتكرة ومبهجة',
    timeDescription: 'منتصف الشهر مساءً',
    preferredFormat: 'quick_tip',
    supportsAudio: true
  },
  {
    id: 'monthly_golden_advice',
    title: 'النصيحة الذهبية',
    time: '22:00',
    scheduleType: 'monthly',
    dayOfMonth: 30,
    audience: 'family',
    buttons: ['طبقنا النصيحة ✅', 'أرسل نسخة للطفل 🌟'],
    keywords: ['النصيحة الذهبية', 'ملخص شهر'],
    promptLines: [
      'قدم نصيحة واحدة مركزة للقلب مع توجيه عملي واضح.',
      'اذكر كيف تنعكس النصيحة على تربية الطفل في الشهر القادم.',
      'اختم بدعاء قصير يرسخ حضور القلب أثناء التطبيق.'
    ],
    tone: 'عميقة ومطمئنة',
    timeDescription: 'ختام الشهر',
    preferredFormat: 'quick_tip'
  }
];

const ROUTINES = [
  ...DAILY_SLOTS.map((slot) => createRoutineDefinition(slot, SAT_TO_WED_DAYS)),
  ...FRIDAY_SLOTS.map((slot) => createRoutineDefinition(slot, FRIDAY_DAY)),
  ...THURSDAY_SLOTS.map((slot) => createRoutineDefinition(slot, THURSDAY_DAY)),
  ...SPECIAL_SLOTS.map((slot) => createRoutineDefinition(slot))
];

const ALL_SLOT_BLUEPRINTS = [...DAILY_SLOTS, ...FRIDAY_SLOTS, ...THURSDAY_SLOTS, ...SPECIAL_SLOTS];
const SLOT_BLUEPRINT_MAP = ALL_SLOT_BLUEPRINTS.reduce((acc, slot) => {
  acc[slot.id] = slot;
  return acc;
}, {});

function compareTimes(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  const [ah = 0, am = 0] = a.split(':').map((value) => parseInt(value, 10));
  const [bh = 0, bm = 0] = b.split(':').map((value) => parseInt(value, 10));
  if (ah !== bh) {
    return ah - bh;
  }
  return am - bm;
}

function getHourKey(time) {
  if (!time) return 'unknown';
  const [hour] = time.split(':');
  return hour.padStart(2, '0');
}

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
    const planEntries = this.buildTimelinePlan(targetDate);

    if (!planEntries.length) {
      console.log('ℹ️ No spiritual routines to schedule today.');
      return;
    }

    console.log(`🕌 Scheduling ${planEntries.length} spiritual routines for ${isoDate}...`);

    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      const guardians = GuardianModel.getByFamily(family.id);
      if (!guardians.length) continue;

      const children = ChildModel.getByFamily(family.id);
      const child = this.selectPrimaryChild(children);
      const referenceGuardian = this.selectReferenceGuardian(guardians);
      if (!referenceGuardian) continue;

      const context = this.buildContext(family, guardians, child, targetDate);

      for (const slot of planEntries) {
        const routine = slot.routine;
        const schedule = this.getRoutineSchedule(routine);
        const slotTime = slot.time || schedule?.time;
        if (!slotTime) continue;

        const already = SpiritualRoutineLogModel.wasScheduled(
          family.id,
          routine.id,
          isoDate
        );
        if (already) continue;

        const scheduledDate = this.buildScheduleDate(targetDate, slotTime);
        if (!scheduledDate) continue;

        if (this.isQuietHour(scheduledDate)) {
          console.log(
            `⚠️ Skipping ${routine.id} for ${family.family_name} due to quiet hours (${slotTime}).`
          );
          continue;
        }

        // If scheduling job ran after desired time, push to next day
        if (isBefore(scheduledDate, new Date())) {
          scheduledDate.setDate(scheduledDate.getDate() + 1);
        }

        const messageContent = await this.generateRoutineMessage(routine, context);
        if (!messageContent) {
          continue;
        }

        const buttons = this.getRoutineButtons(routine, slot.buttons);

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

  buildTimelinePlan(date) {
    const configured = this.getConfiguredPlanEntries(date);
    const basePlan = configured.length ? configured : this.getFallbackPlan(date);
    const specials = this.getSpecialPlanEntries(date);
    const combined = [...basePlan, ...specials];
    const perHourLimit = this.config.notifications?.per_hour_limit ?? 1;
    return this.enforcePerHourLimit(combined, perHourLimit);
  }

  getConfiguredPlanEntries(date) {
    const timelineConfig = this.getTimelineConfigForDate(date);
    if (!Array.isArray(timelineConfig) || !timelineConfig.length) {
      return [];
    }
    return timelineConfig
      .map((entry) => (typeof entry === 'string' ? { id: entry } : entry))
      .map((entry) => this.enrichPlanEntry(entry, date))
      .filter(Boolean);
  }

  getTimelineConfigForDate(date) {
    const timeline = this.config.notifications?.timeline;
    if (!timeline) return [];
    const day = date.getDay();
    if (day === 5 && Array.isArray(timeline.friday)) return timeline.friday;
    if (day === 4 && Array.isArray(timeline.thursday)) return timeline.thursday;
    if (day !== 4 && day !== 5 && Array.isArray(timeline.weekday)) return timeline.weekday;
    if (Array.isArray(timeline.default)) return timeline.default;
    return [];
  }

  getFallbackPlan(date) {
    const day = date.getDay();
    let sourceSlots = DAILY_SLOTS;
    if (day === 5) {
      sourceSlots = FRIDAY_SLOTS;
    } else if (day === 4) {
      sourceSlots = THURSDAY_SLOTS;
    }
    return sourceSlots
      .map((slot) => this.enrichPlanEntry({ id: slot.id }, date))
      .filter(Boolean);
  }

  getSpecialPlanEntries(date) {
    return SPECIAL_SLOTS.filter((slot) => this.isSlotActive(slot, date))
      .map((slot) => this.enrichPlanEntry({ id: slot.id }, date))
      .map((entry) => ({ ...entry, priority: Math.max(entry?.priority || 0, 80) }))
      .filter(Boolean);
  }

  enrichPlanEntry(entry, date) {
    if (!entry?.id) return null;
    const routine = this.getRoutineById(entry.id);
    if (!routine) return null;
    const blueprint = SLOT_BLUEPRINT_MAP[entry.id];
    const schedule = this.getRoutineSchedule(routine, date) || routine.schedule;
    const time = entry.time || blueprint?.time || schedule?.time;
    if (!time) return null;
    return {
      id: entry.id,
      routine,
      time,
      buttons: entry.buttons,
      priority: entry.priority ?? this.derivePriority(blueprint)
    };
  }

  derivePriority(blueprint = {}) {
    if (!blueprint) return 40;
    if (blueprint.scheduleType === 'monthly') return 95;
    if (blueprint.scheduleType === 'weekly') return 80;
    return 40;
  }

  isSlotActive(slot, date) {
    if (!slot) return false;
    if (slot.scheduleType === 'monthly') {
      return typeof slot.dayOfMonth === 'number' && slot.dayOfMonth === date.getDate();
    }
    if (slot.scheduleType === 'weekly') {
      if (typeof slot.dayOfWeek === 'number') {
        return slot.dayOfWeek === date.getDay();
      }
      if (Array.isArray(slot.daysOfWeek)) {
        return slot.daysOfWeek.includes(date.getDay());
      }
    }
    return false;
  }

  enforcePerHourLimit(entries, limit = 1) {
    if (!Array.isArray(entries) || !entries.length) return [];
    const sorted = [...entries].sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      return compareTimes(a.time, b.time);
    });

    const bucket = new Map();

    for (const entry of sorted) {
      const hourKey = getHourKey(entry.time);
      const hourEntries = bucket.get(hourKey) || [];
      if (hourEntries.length >= limit) {
        continue;
      }
      hourEntries.push(entry);
      bucket.set(hourKey, hourEntries);
    }

    return Array.from(bucket.values())
      .flat()
      .sort((a, b) => compareTimes(a.time, b.time));
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
    const context = this.buildContext(family, guardians, child, new Date());
    const text = routine
      ? await this.generateRoutineMessage(routine, context)
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
   * Generate routine message using LLM guidance
   */
  async generateRoutineMessage(routine, context) {
    if (!routine) {
      return '';
    }

    const schedule = this.getRoutineSchedule(routine) || routine.schedule;
    const guidance = typeof routine.guidance === 'function' ? routine.guidance(context) : routine.guidance;
    const extra = typeof routine.extraGuidance === 'function' ? routine.extraGuidance(context) : routine.extraGuidance;
    const combinedContext = compactGuidance([guidance, extra].filter(Boolean).join('\n'));

    const guardianName = this.resolveAudienceName(routine.audience, context);
    const childAge = context.childAgeLabel || this.getChildAgeLabel(context.child || null);
    const timeLabel = this.getTimeOfDayLabel(schedule?.time);

    const aiContext = {
      messageType: routine.messageType || 'spiritual_routine',
      guardianName,
      childName: context.childName,
      childAge,
      timeOfDay: timeLabel,
      additionalContext: combinedContext,
      previousInteractions: context.previousInteractions || [],
      activeIssues: context.activeIssues || [],
      trackMetadata: routine.trackMetadata || {},
      preferredFormat: routine.preferredFormat || 'text',
      configFormats: this.config.tracks?.formats || []
    };

    try {
      return await this.llm.generateMessage(aiContext);
    } catch (error) {
      console.error(`Failed to generate message for ${routine.id}:`, error.message);
      return guidance || 'لم أستطع إنشاء رسالة مخصصة الآن.';
    }
  }

  /**
   * Get buttons for routine
   */
  getRoutineButtons(routine, inlineOverride = null) {
    if (Array.isArray(inlineOverride) && inlineOverride.length) {
      return normalizeButtons(inlineOverride);
    }
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
    if (Array.isArray(override?.days_of_week) && override.days_of_week.length) {
      schedule.daysOfWeek = override.days_of_week;
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
  buildContext(family, guardians = [], child = null, date = null) {
    const father = guardians.find((g) => g.role === 'father');
    const mother = guardians.find((g) => g.role === 'mother');

    const fatherName = father?.name || 'الأب';
    const motherName = mother?.name || 'الأم';
    const parentsPhrase = createParentsPhrase(father?.name, mother?.name);
    const childAgeLabel = this.getChildAgeLabel(child);

    const currentDay = date ? date.getDay() : new Date().getDay();

    return {
      child,
      childName: child?.name || 'طفلكم',
      childAgeLabel,
      fatherName,
      motherName,
      fatherCall: father?.name ? `${father.name}` : 'الأب',
      parentsPhrase,
      familyName: family?.family_name || parentsPhrase,
      guardiansNames: guardians.map((g) => g.name).join('، '),
      currentDayOfWeek: currentDay,
      previousInteractions: [],
      activeIssues: []
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

  resolveAudienceName(audience, context) {
    switch (audience) {
      case 'father':
        return context.fatherName || 'الأب';
      case 'mother':
        return context.motherName || 'الأم';
      case 'parents':
        return context.parentsPhrase || 'الوالدان';
      case 'family':
      default:
        return context.familyName || context.parentsPhrase || 'العائلة';
    }
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
  getTimeOfDayLabel(timeString = null) {
    let hour;
    if (typeof timeString === 'string') {
      const parts = timeString.split(':').map((part) => parseInt(part, 10));
      if (!Number.isNaN(parts[0])) {
        hour = parts[0];
      }
    }

    if (typeof hour !== 'number' || Number.isNaN(hour)) {
      const now = new Date();
      hour = now.getHours();
    }

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
