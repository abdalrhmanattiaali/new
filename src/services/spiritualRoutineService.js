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
    title: 'الإشعار الصباحي الأول',
    time: '06:30',
    audience: 'family',
    buttons: ['دعوتم ✅', 'ذكرني كل صباح 🔔'],
    keywords: ['دعاء الصباح', 'آية الاستيقاظ'],
    promptLines: [
      'تحية صباحية دافئة مع ذكر أو آية قصيرة لبداية اليوم.',
      'اشرح كيف يشارك الوالدان الطفل أثناء ترديد الدعاء بوضع اليد برفق على رأسه.',
      'شجع على نية إيجابية ليوم جديد مليء بالبركة.'
    ],
    tone: 'روحانية متفائلة',
    callToAction: 'ادعُ الوالدين لترديد الذكر بصوت مسموع وهم يحتضنون الطفل.',
    timeDescription: 'بداية اليوم قبل أن ينطلق الروتين الصباحي',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_0645_father_boost',
    title: 'تحفيز الأب',
    time: '06:45',
    audience: 'father',
    buttons: ['جاهز ✅', 'أحتاج دفعة 💪'],
    keywords: ['تحفيز الأب', 'ابدأ يومك'],
    promptLines: [
      'رسالة تحفيزية مركزة للأب تربط اليوم بصناعة ذكرى جديدة مع الطفل.',
      'اقترح خطوة صغيرة يمكنه القيام بها هذا الصباح لدعم أسرته.',
      'اطرح سؤالاً قصيراً يدعوه للتفكير في شعور يرغب بمشاركته مع الطفل.'
    ],
    tone: 'تحفيزية وداعمة',
    callToAction: 'ادعُ الأب لإرسال تحديث بسيط عن اللحظة التي سيصنعها اليوم.',
    timeDescription: 'بعد الاستيقاظ مباشرة وقبل مغادرة المنزل',
    preferredFormat: 'text'
  },
  {
    id: 'daily_0700_morning_adhkar',
    title: 'الذكر الصباحي',
    time: '07:00',
    audience: 'parents',
    buttons: ['ذكرنا ✅', 'أذكار إضافية 📿'],
    keywords: ['أذكار الصباح', 'ذكر جماعي'],
    promptLines: [
      'قائمة مختصرة من 2-3 أذكار صباحية متنوعة غير متكررة.',
      'اشرح كيف يمكن ترديد الأذكار أثناء تجهيز الفطور أو تجهيز الطفل.',
      'نبه إلى إشراك الطفل بالاستماع أو الترديد حسب عمره.'
    ],
    tone: 'روحانية عملية',
    callToAction: 'اقترح على الوالدين وضع عدّاد بسيط لمتابعة الأذكار طوال الأسبوع.',
    timeDescription: 'في بداية الروتين المنزلي',
    preferredFormat: 'checklist'
  },
  {
    id: 'daily_0730_child_morning_routine',
    title: 'روتين الطفل الصباحي',
    time: '07:30',
    audience: 'mother',
    buttons: ['تم التطبيق ✅', 'ذكريني بعد قليل 🔔'],
    keywords: ['روتين الصباح', 'وقت البطن'],
    promptLines: [
      'ذكر خطوات واضحة تشمل الرضاعة، تغيير الحفاض، ووقت بطن قصير.',
      'وضح مدة كل خطوة وكيف تساعد الطفل على الاستقرار.',
      'أضف نصيحة صغيرة للتواصل البصري أو اللمسي أثناء الروتين.'
    ],
    tone: 'حنونة وموجهة',
    callToAction: 'شجع الأم على تسجيل ملاحظة عن استجابة الطفل للروتين في دفتر صغير.',
    timeDescription: 'روتين ثابت بعد الاستيقاظ',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_0800_father_lesson',
    title: 'درس الأب اليومي',
    time: '08:00',
    audience: 'father',
    buttons: ['استفدت ✅', 'أرسل مثالاً عملياً'],
    keywords: ['درس الأب', 'تعلم الأب'],
    promptLines: [
      'فقرة تعليمية قصيرة مرتبطة بالموضوع الأسبوعي لفهم الطفل.',
      'خطوة تطبيقية يمكن للأب تنفيذها خلال اليوم أو مساءً.',
      'تشجيع على مشاركة ملاحظة لاحقاً مع الأم أو الطفل.'
    ],
    tone: 'تثقيفية ملهمة',
    callToAction: 'اطلب من الأب كتابة ما لاحظه اليوم في مذكرة العائلة.',
    timeDescription: 'وقت يقرأ فيه الأب رسالة سريعة قبل مغادرة المنزل',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_0830_mother_encouragement',
    title: 'رسالة للأم',
    time: '08:30',
    audience: 'mother',
    buttons: ['شعرت بالدعم ✅', 'أحتاج طاقة 💚'],
    keywords: ['رسالة للأم', 'تشجيع الصباح'],
    promptLines: [
      'كلمات تقدير صادقة لجهد الأم في بداية اليوم.',
      'اقترح تمرين تنفس أو استراحة قصيرة تمنحها الهدوء.',
      'شجعها على تدوين شعور إيجابي واحد قبل منتصف النهار.'
    ],
    tone: 'حنونة ومطمئنة',
    callToAction: 'ادعُ الأم لأخذ ثلاث أنفاس عميقة ومشاركة شعورها مع الشريك.',
    timeDescription: 'قبل بدء مسؤوليات منتصف الصباح',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_0900_child_activity_one',
    title: 'نشاط الطفل الأول',
    time: '09:00',
    audience: 'parents',
    buttons: ['لعبنا ✅', 'أرسل نشاط آخر 🎲'],
    keywords: ['نشاط الصباح', 'تطوير الطفل'],
    promptLines: [
      'نشاط صباحي قصير (5-10 دقائق) يدعم مهارة حسية أو حركية.',
      'اذكر الأدوات البسيطة أو التجهيز المطلوب لإتمام النشاط.',
      'أضف طريقة لتسجيل ملاحظة عن رد فعل الطفل بعد اللعب.'
    ],
    tone: 'مرحة وتعليمية',
    callToAction: 'شجع الوالدين على حفظ صورة أو تعليق عن النشاط في سجل العائلة.',
    timeDescription: 'وقت اللعب المخطط بعد الإفطار',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_0930_weather_report',
    title: 'تقرير الطقس',
    time: '09:30',
    audience: 'parents',
    buttons: ['أعددنا الملابس ✅', 'نحتاج نصيحة إضافية 👕'],
    keywords: ['الطقس', 'ملابس الطفل'],
    promptLines: [
      'ملخص حالة الطقس اليوم مع درجة الحرارة المتوقعة.',
      'اقترح ملابس مناسبة للطفل مع تذكير بملحقات بسيطة.',
      'أضف تنبيه قصير عن الظروف الخاصة مثل الشمس أو الرياح.'
    ],
    tone: 'عملية وواضحة',
    callToAction: 'شجع العائلة على مشاركة صورة لإطلالة الطفل إن أحبوا.',
    timeDescription: 'قبل تجهيز الخروج أو اختيار الملابس',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1000_mother_break',
    title: 'وقت استراحة الأم',
    time: '10:00',
    audience: 'mother',
    buttons: ['أخذت استراحة ✅', 'ذكريني لاحقاً 🔔'],
    keywords: ['استراحة', 'تنفس'],
    promptLines: [
      'ذكر الأم بأهمية شرب الماء أو تناول وجبة خفيفة.',
      'اقترح تمرين تنفس أو تأمل قصير يعيد الطاقة.',
      'شجع على لحظة امتنان ذاتية قبل مواصلة اليوم.'
    ],
    tone: 'داعم ولطيف',
    callToAction: 'اقترح ضبط منبه صغير لتكرار الاستراحة يومياً.',
    timeDescription: 'منتصف الصباح',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1030_story_snack',
    title: 'قصة قصيرة',
    time: '10:30',
    audience: 'family',
    buttons: ['قرأنا القصة ✅', 'قصة جديدة 📖'],
    keywords: ['قصة تربوية', 'قصة دينية'],
    promptLines: [
      'قصة تربوية أو دينية مختصرة تلائم عمر الطفل.',
      'اذكر العبرة أو القيمة في سطر واحد مع مثال تطبيقي.',
      'اقترح طريقة لسرد القصة بصوت معبر أو باستخدام الدمى.'
    ],
    tone: 'قصصية دافئة',
    callToAction: 'ادعُ العائلة لتسجيل العبرة في دفتر اللحظات الجميلة.',
    timeDescription: 'استراحة لطيفة بين الأنشطة',
    preferredFormat: 'story'
  },
  {
    id: 'daily_1100_micro_learning',
    title: 'نصيحة سريعة',
    time: '11:00',
    audience: 'parents',
    buttons: ['استفدنا ✅', 'معلومة إضافية 💡'],
    keywords: ['نصيحة تربوية', 'معلومة علمية'],
    promptLines: [
      'معلومة علمية أو تربوية مختصرة حول تطور الطفل.',
      'اشرح كيفية تطبيق المعلومة في المنزل خلال اليوم.',
      'انبه بلطف إلى شائعة أو خطأ شائع ينبغي تجنبه.'
    ],
    tone: 'علمية مبسطة',
    timeDescription: 'منتصف الصباح',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1130_music_time',
    title: 'وقت الموسيقى',
    time: '11:30',
    audience: 'mother',
    buttons: ['شغلنا النشيد ✅', 'أرسل اختياراً آخر 🎵'],
    keywords: ['أنشودة', 'سورة هادئة'],
    promptLines: [
      'اقترح سورة أو أنشودة هادئة تناسب الطفل.',
      'اذكر فائدة الموسيقى أو التلاوة لتهدئة الحواس.',
      'قدم فكرة لتفاعل الأم مع الطفل أثناء الاستماع.'
    ],
    tone: 'هادئة ومطمئنة',
    timeDescription: 'ختام فترة الصباح',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1200_lunch_dua',
    title: 'وقت الغداء',
    time: '12:00',
    audience: 'family',
    buttons: ['قلنا الدعاء ✅', 'ذكرني لاحقاً 🔔'],
    keywords: ['دعاء الطعام', 'غداء'],
    promptLines: [
      'دعاء قبل الطعام بصيغة عائلية سهلة.',
      'اشرح كيف يمكن إشراك الطفل حتى لو كان رضيعاً.',
      'أضف فائدة روحية أو صحية قصيرة.'
    ],
    tone: 'روحانية عملية',
    timeDescription: 'بداية فترة الظهيرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1230_nap_prep',
    title: 'تحضير القيلولة',
    time: '12:30',
    audience: 'mother',
    buttons: ['جهزناه للنوم ✅', 'نحتاج أفكاراً أخرى 😴'],
    keywords: ['قيلولة', 'تهدئة'],
    promptLines: [
      'خطوات تهدئة واضحة قبل القيلولة (إضاءة، موسيقى، حضن).',
      'حدد علامات التعب التي يجب مراقبتها.',
      'شجع على روتين ثابت يساعد الطفل على النوم بسهولة.'
    ],
    tone: 'هادئة ومنظمة',
    timeDescription: 'قبل نوم منتصف اليوم',
    preferredFormat: 'checklist'
  },
  {
    id: 'daily_1300_father_midday',
    title: 'رسالة الأب الظهيرة',
    time: '13:00',
    audience: 'father',
    buttons: ['دعوت له ✅', 'أرسل تحية 🎙️'],
    keywords: ['رسالة الأب', 'دعاء سريع'],
    promptLines: [
      'تذكير الأب بالدعاء للطفل أثناء العمل.',
      'اقترح جملة قصيرة أو ذكر يمكنه ترديده الآن.',
      'ادعُه لإرسال رسالة صوتية قصيرة للعائلة عند الاستراحة.'
    ],
    tone: 'مؤثرة وخفيفة',
    timeDescription: 'استراحة منتصف اليوم للأب',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1330_feeding_tip',
    title: 'نصيحة التغذية',
    time: '13:30',
    audience: 'mother',
    buttons: ['نفذت النصيحة ✅', 'أعطني خياراً آخر 🍼'],
    keywords: ['تغذية', 'رضاعة'],
    promptLines: [
      'نصيحة تغذية أو رضاعة عملية تعتمد على إشارات الجوع والشبع.',
      'اذكر علامة يجب مراقبتها لضمان راحة الطفل.',
      'اقترح تنويعاً بسيطاً في الوضعية أو البيئة.'
    ],
    tone: 'عملية وهادئة',
    timeDescription: 'وقت التغذية بعد القيلولة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1400_mother_selfcare',
    title: 'رعاية الأم الذاتية',
    time: '14:00',
    audience: 'mother',
    buttons: ['اعتنيت بنفسي ✅', 'أحتاج خطة ✨'],
    keywords: ['رعاية الذات', 'طاقة الأم'],
    promptLines: [
      'اقترح نشاطاً بسيطاً تستعيد به الأم طاقتها (شرب ماء، قراءة آية، كتابة سطر امتنان).',
      'ذكّر بأهمية طلب المساعدة أو مشاركة المسؤولية عند الحاجة.',
      'أضف فكرة لمكافأة ذاتية صغيرة عند نهاية اليوم.'
    ],
    tone: 'مشجع وعميق',
    callToAction: 'ادعُ الأم لتحديد موعد ثابت يومي لهذه الدقائق الذهبية.',
    timeDescription: 'منتصف الظهيرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1430_emotional_support',
    title: 'دعم عاطفي',
    time: '14:30',
    audience: 'mother',
    buttons: ['أشعر بتحسن ✅', 'احتاج للمزيد 💌'],
    keywords: ['دعم عاطفي', 'قوة الأم'],
    promptLines: [
      'رسالة تعاطف تعترف بتعب منتصف اليوم.',
      'شجع الأم على مشاركة شعورها مع الشريك أو صديقة قريبة.',
      'اقترح تمرين امتنان سريع يرفع المعنويات.'
    ],
    tone: 'تعاطفي حار',
    timeDescription: 'وقت قد تشعر فيه الأم بالإرهاق',
    preferredFormat: 'text'
  },
  {
    id: 'daily_1500_family_pause',
    title: 'استراحة العصر',
    time: '15:00',
    audience: 'family',
    buttons: ['استرحنا ✅', 'ذكر إضافي ☕'],
    keywords: ['استراحة العصر', 'ذكر'],
    promptLines: [
      'دعوة لشرب شيء دافئ أو ماء مع ترديد ذكر قصير.',
      'اقترح لعبة تنفس أو استرخاء لمدة دقيقتين.',
      'شجع على مشاركة شعور ممتن بين الوالدين.'
    ],
    tone: 'هادئ وملهم',
    timeDescription: 'استراحة قصيرة قبل أنشطة بعد الظهر',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1530_mother_lesson',
    title: 'درس الأم اليومي',
    time: '15:30',
    audience: 'mother',
    buttons: ['تعلمت ✅', 'مثال إضافي 📘'],
    keywords: ['درس الأم', 'تعلم الأم'],
    promptLines: [
      'درس تربوي عملي يتماشى مع محور الأسبوع.',
      'قدم سيناريو قصير يوضح كيفية التطبيق مع الطفل.',
      'اقترح سؤالاً للتفكير أو للحوار مع الشريك.'
    ],
    tone: 'تعليمية داعمة',
    timeDescription: 'بداية فترة بعد الظهر',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1600_child_activity_two',
    title: 'نشاط الطفل الثاني',
    time: '16:00',
    audience: 'mother',
    buttons: ['نفذناه ✅', 'أرسل نشاطاً آخر 🧸'],
    keywords: ['نشاط بعد القيلولة', 'لعب'],
    promptLines: [
      'نشاط مسائي قصير يركز على التواصل أو اللغة بعد القيلولة.',
      'اشرح كيف يتم التفاعل مع الطفل خطوة بخطوة.',
      'أضف فكرة لمتابعة التقدم أو تدوين ملاحظة صغيرة.'
    ],
    tone: 'مرحة وموجهة',
    timeDescription: 'عودة للنشاط بعد الراحة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1630_asr_dua',
    title: 'دعاء العصر',
    time: '16:30',
    audience: 'family',
    buttons: ['دعونا ✅', 'أرسل أدعية إضافية 📿'],
    keywords: ['دعاء العصر', 'ساعة الإجابة'],
    promptLines: [
      'ذكر بدعاء قصير قبل صلاة العصر مع إشراك الطفل.',
      'اقترح تقسيم الدعاء بين الوالدين مع استخدام اسم الطفل.',
      'أضف تذكيراً بأن هذه اللحظة جزء من ساعة إجابة مباركة.'
    ],
    tone: 'روحانية ملهمة',
    timeDescription: 'قبل وقت العصر بقليل',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1700_playtime',
    title: 'وقت اللعب المسائي',
    time: '17:00',
    audience: 'family',
    buttons: ['لعبنا ✅', 'فكرة لعب إضافية 🎈'],
    keywords: ['لعب عائلي', 'مرح'],
    promptLines: [
      'نشاط مرح مشترك (مثل الفقاعات أو لعبة تقليد) يضم الوالدين.',
      'حدد مدة قصيرة لا تتجاوز عشر دقائق.',
      'شجع على تصوير ضحكة الطفل للاحتفاظ بها.'
    ],
    tone: 'مرحة وعائلية',
    timeDescription: 'قبل عودة الأب إلى المنزل أو في لحظة اجتماع الأسرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1730_father_commute',
    title: 'تنبيه وصول الأب',
    time: '17:30',
    audience: 'father',
    buttons: ['في الطريق ✅', 'سأتأخر قليلاً ⏱️'],
    keywords: ['العودة للمنزل', 'تنبيه الأب'],
    promptLines: [
      'رسالة تذكر الأب بأن العائلة في انتظاره بنشاط أو حضن.',
      'اقترح دعاء أو ذكر يقوله في الطريق.',
      'شجعه على مشاركة حدث جميل فور الوصول.'
    ],
    tone: 'متحمسة وداعمة',
    timeDescription: 'أثناء العودة إلى المنزل',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1800_maghrib_call',
    title: 'أذان المغرب',
    time: '18:00',
    audience: 'family',
    buttons: ['دعونا عند المغرب ✅', 'ذكّرني بالأذكار 🔔'],
    keywords: ['أذان المغرب', 'دعاء'],
    promptLines: [
      'تذكير بفضل الدعاء عند أذان المغرب مع صيغة يسيرة.',
      'اقترح حمل الطفل أو احتضانه أثناء الدعاء.',
      'أشر إلى إمكانية تسجيل لحظة روحية قصيرة بالصوت.'
    ],
    tone: 'روحانية قوية',
    timeDescription: 'لحظة المغرب المباركة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1830_family_lesson',
    title: 'درس العائلة المسائي',
    time: '18:30',
    audience: 'family',
    buttons: ['تعلّمنا ✅', 'شاركنا مثالاً 📘'],
    keywords: ['درس العائلة', 'تعلم جماعي'],
    promptLines: [
      'خلاصة قصيرة لما تعلمته العائلة اليوم ضمن موضوع الأسبوع.',
      'اقترح نشاط حواري سريع بين الوالدين حول الدرس.',
      'ذكر خطوة واحدة لتطبيق الدرس في المساء.'
    ],
    tone: 'تعليمية عائلية',
    timeDescription: 'بعد صلاة المغرب',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1900_dinner_routine',
    title: 'روتين العشاء',
    time: '19:00',
    audience: 'family',
    buttons: ['اجتمعنا ✅', 'فكرة لعشاء صحي 🍲'],
    keywords: ['عشاء العائلة', 'جلسة عائلية'],
    promptLines: [
      'تذكير بجلسة عشاء عائلية بلا شاشات.',
      'اقترح سؤالاً بسيطاً للحوار أثناء العشاء.',
      'أضف فكرة لإشراك الطفل ولو من خلال وجوده في الحضن.'
    ],
    tone: 'عائلية دافئة',
    timeDescription: 'وقت اجتماع العائلة حول المائدة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_1930_memory_capture',
    title: 'توثيق اللحظة',
    time: '19:30',
    audience: 'family',
    buttons: ['التقطنا الصورة ✅', 'سنشارك لاحقاً 📸'],
    keywords: ['ذكريات', 'توثيق'],
    promptLines: [
      'دعوة لتوثيق لحظة مسائية بصورة أو ملاحظة مكتوبة.',
      'اقترح فكرة مبتكرة للصورة أو التسجيل (تحدي الوجوه المضحكة مثلاً).',
      'ذكر أهمية حفظ هذه اللحظات في أرشيف العائلة.'
    ],
    tone: 'مرحة وعاطفية',
    timeDescription: 'بعد العشاء مباشرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_2000_family_activity',
    title: 'نشاط العائلة المسائي',
    time: '20:00',
    audience: 'family',
    buttons: ['قمنا بالنشاط ✅', 'نحتاج فكرة إضافية 🎯'],
    keywords: ['نشاط عائلي', 'تحدي أسبوعي'],
    promptLines: [
      'نشاط مشترك (رقصة عائلية، لعبة صغيرة أو تحدٍ أسبوعي).',
      'وضح كيفية تكييف النشاط حسب مساحة البيت.',
      'أضف خطوة للتقييم أو لمشاركة الشعور بعد النشاط.'
    ],
    tone: 'تفاعلية وممتعة',
    timeDescription: 'بداية السهرة العائلية',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_2030_interactive_play',
    title: 'لحظة تفاعلية',
    time: '20:30',
    audience: 'family',
    buttons: ['شاركنا الضحك ✅', 'أرسل لعبة أخرى 🎭'],
    keywords: ['لعبة تفاعلية', 'مرح'],
    promptLines: [
      'لعبة بسيطة مثل طخ-بخ أو التخفي مع استخدام صوت مرح.',
      'شجع الوالدين على متابعة ردود فعل الطفل ولغته الجسدية.',
      'اقترح تسجيل صوتي قصير للضحكات لإرساله للأقارب.'
    ],
    tone: 'مرحة للغاية',
    timeDescription: 'منتصف السهرة العائلية',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'daily_2100_bedtime_prep',
    title: 'تحضير النوم',
    time: '21:00',
    audience: 'family',
    buttons: ['بدأنا الروتين ✅', 'أحتاج نصيحة النوم 😴'],
    keywords: ['روتين النوم', 'حمام الطفل'],
    promptLines: [
      'خطوات روتين النوم: حمام دافئ، مساج خفيف، ملابس مريحة.',
      'اقترح تهدئة الإضاءة وتخفيف الأصوات.',
      'اذكر تذكيراً بتوثيق أي ملاحظة حول نوم الطفل في السجل.'
    ],
    tone: 'هادئة ومنظمة',
    timeDescription: 'بداية روتين النوم اليومي',
    preferredFormat: 'checklist'
  },
  {
    id: 'daily_2130_bedtime_story',
    title: 'قصة ما قبل النوم',
    time: '21:30',
    audience: 'family',
    buttons: ['قرأنا القصة ✅', 'قصة جديدة غداً 📖'],
    keywords: ['قصة قبل النوم', 'هدوء'],
    promptLines: [
      'اقترح قصة قصيرة أو سورة خفيفة بصوت منخفض.',
      'شجع على استخدام تعبيرات وجه هادئة ولمسات لطيفة.',
      'أضف تذكيراً بتكرار كلمة أمان يحبها الطفل.'
    ],
    tone: 'حانية وهادئة',
    timeDescription: 'اللحظات الأخيرة قبل النوم',
    preferredFormat: 'story'
  },
  {
    id: 'daily_2145_sleep_dua',
    title: 'دعاء النوم',
    time: '21:45',
    audience: 'family',
    buttons: ['طبّقنا الدعاء ✅', 'صوت الشيخ 🎧'],
    keywords: ['دعاء النوم', 'رقية'],
    promptLines: [
      'ذكر أدعية النوم الأساسية مع إدماج اسم الطفل.',
      'اقترح قراءة المعوذات والنفث على الجسد برفق.',
      'ذكّر بأن الرسالة يمكن تحويلها لصوت عند الطلب.'
    ],
    tone: 'روحانية مطمئنة',
    timeDescription: 'قبل النوم مباشرة',
    preferredFormat: 'quick_tip',
    supportsAudio: true
  },
  {
    id: 'daily_2200_night_wrap',
    title: 'رسالة الليل',
    time: '22:00',
    audience: 'family',
    buttons: ['أغلقنا اليوم ✅', 'ذكرني بالغد 🔔'],
    keywords: ['ختام اليوم', 'طمأنة'],
    promptLines: [
      'تهنئة العائلة على إنجازات اليوم والدعاء بليلة هانئة.',
      'شجع على ذكر نعمة واحدة يشعرون بالامتنان لها.',
      'هيئ لنظرة سريعة على خطة الغد دون تفاصيل مرهقة.'
    ],
    tone: 'مطمئنة وداعمة',
    timeDescription: 'ختام اليوم واستعداد للنوم',
    preferredFormat: 'quick_tip'
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
    title: 'بعد صلاة الفجر',
    time: '06:00',
    audience: 'family',
    buttons: ['صلينا ✅', 'أرسل ورداً 📿'],
    keywords: ['ورد الجمعة', 'صلاة على النبي'],
    promptLines: [
      'تذكير بالعشرة الأولى من الصلاة على النبي بعد الفجر.',
      'اقترح احتضان الطفل أثناء الذكر ليشعر بالطمأنينة.',
      'أضف توصية بتدوين الدعاء المستجاب عند الفجر.'
    ],
    tone: 'روحانية مبهجة',
    timeDescription: 'بعد الفجر مباشرة',
    preferredFormat: 'quick_tip'
  },
  {
    id: 'friday_0630_greeting',
    title: 'جمعة مباركة',
    time: '06:30',
    audience: 'family',
    buttons: ['جمعة مباركة ✅', 'أرسل ملصقاً 🎉'],
    keywords: ['جمعة مباركة', 'تحية الجمعة'],
    promptLines: [
      'تحية جمعة مباركة مخصصة للعائلة باسم الطفل.',
      'أضف اقتراحاً صغيراً لجعل البيت في أبهى حلة اليوم.',
      'ذكّر بتهيئة نية يوم الجمعة كعيد أسبوعي للأسرة.'
    ],
    tone: 'دافئة واحتفالية',
    timeDescription: 'بداية صباح الجمعة',
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
    time: '12:30',
    audience: 'mother',
    buttons: ['دعوت ✅', 'أحتاج أدعية 📿'],
    keywords: ['ساعة الإجابة', 'دعاء الجمعة'],
    promptLines: [
      'ذكّر الأم بأن هذا الوقت من أفضل أوقات الدعاء.',
      'قدم ثلاثة أدعية قصيرة تخص الطفل والأم والأسرة.',
      'اقترح تسجيل الدعاء بصوت خافت للاحتفاظ به.'
    ],
    tone: 'روحانية مؤثرة',
    timeDescription: 'أثناء وجود الأب في المسجد',
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

      const context = this.buildContext(family, guardians, child, targetDate);

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

        const messageContent = await this.generateRoutineMessage(routine, context);
        if (!messageContent) {
          continue;
        }

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
        if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length) {
          if (schedule.daysOfWeek.includes(date.getDay())) {
            routines.push(routine);
          }
        } else {
          routines.push(routine);
        }
      } else if (schedule.type === 'weekly') {
        if (Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length) {
          if (schedule.daysOfWeek.includes(date.getDay())) {
            routines.push(routine);
          }
        } else if (typeof schedule.dayOfWeek === 'number' && schedule.dayOfWeek === date.getDay()) {
          routines.push(routine);
        }
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
