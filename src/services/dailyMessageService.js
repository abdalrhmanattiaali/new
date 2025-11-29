/**
 * Daily Message Service - خدمة الرسائل اليومية المتنوعة
 * نظام متكامل لإرسال رسائل متنوعة للأم والأب والطفل والعائلة
 */

import { FamilyModel, GuardianModel, ChildModel } from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { WeatherService } from './weatherService.js';
import PresenceService from './presenceService.js';
import { format } from 'date-fns';
import NotificationOrchestrator from './notificationOrchestrator.js';

export class DailyMessageService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
    this.weatherService = new WeatherService(config);
    this.presenceService = new PresenceService();
    this.notifications = new NotificationOrchestrator(config);
  }

  /**
   * توليد جميع الرسائل اليومية للعائلات
   */
  async generateAllDailyMessages() {
    console.log('🌟 توليد الرسائل اليومية المتنوعة...');

    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        await this.generateFamilyDailyMessages(family);
      } catch (error) {
        console.error(`Error generating messages for family ${family.id}:`, error);
      }
    }

    console.log('✅ تم توليد جميع الرسائل اليومية');
  }

  /**
   * توليد رسائل يومية متنوعة لعائلة واحدة
   */
  async generateFamilyDailyMessages(family) {
    const guardians = GuardianModel.getByFamily(family.id);
    const children = ChildModel.getByFamily(family.id);

    if (children.length === 0 || guardians.length === 0) return;

    const child = children[0];
    const father = guardians.find(g => g.role === 'father');
    const mother = guardians.find(g => g.role === 'mother');

    if (father) {
      await this.ensureFatherPresencePrompt(family, father, child);
    }

    // الحصول على توزيع الرسائل من الإعدادات
    const distribution = this.config.tracks?.distribution || {
      child: 3,
      mother: 2,
      father: 2,
      family: 1
    };

    // اختيار رسائل عشوائية من كل فئة
    const selectedMessages = {
      child: this.selectRandomMessages('daily_child', distribution.child),
      mother: this.selectRandomMessages('daily_mother', distribution.mother),
      father: this.selectRandomMessages('daily_father', distribution.father),
      family: this.selectRandomMessages('daily_family', distribution.family)
    };

    // جدولة رسائل الطفل
    for (const messageType of selectedMessages.child) {
      const time = this.getRandomTimeSlot('morning', 'evening');
      await this.scheduleChildMessage(family, child, messageType, time);
    }

    // جدولة رسائل الأم
    if (mother) {
      for (const messageType of selectedMessages.mother) {
        const time = this.getRandomTimeSlot('morning', 'evening');
        await this.scheduleMotherMessage(family, mother, child, messageType, time);
      }
    }

    // جدولة رسائل الأب
    if (father) {
      for (const messageType of selectedMessages.father) {
        const time = this.getRandomTimeSlot('morning', 'evening');
        await this.scheduleFatherMessage(family, father, child, messageType, time);
      }
    }

    // جدولة رسائل العائلة
    for (const messageType of selectedMessages.family) {
      const time = this.getRandomTimeSlot('evening');
      await this.scheduleFamilyMessage(family, messageType, time);
    }

    console.log(`✅ تم جدولة ${Object.values(selectedMessages).flat().length} رسالة لعائلة ${family.family_name}`);
  }

  /**
   * اختيار رسائل عشوائية من فئة محددة
   */
  selectRandomMessages(category, count) {
    const messages = this.config.tracks?.[category] || [];
    if (messages.length === 0) return [];

    // خلط الرسائل وأخذ العدد المطلوب
    const shuffled = [...messages].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, messages.length));
  }

  /**
   * الحصول على وقت عشوائي في فترة معينة
   */
  getRandomTimeSlot(...periods) {
    const slots = {
      morning: ['07:00', '08:30', '10:00', '11:30'],
      noon: ['13:00', '14:30', '16:00'],
      evening: ['18:00', '19:00', '20:00', '21:00']
    };

    const availableSlots = [];
    periods.forEach(period => {
      if (slots[period]) {
        availableSlots.push(...slots[period]);
      }
    });

    return availableSlots[Math.floor(Math.random() * availableSlots.length)];
  }

  async ensureFatherPresencePrompt(family, father, child) {
    const prompt = this.presenceService.buildPromptIfNeeded(father.id, father.name, child?.name);
    if (!prompt) return;

    const time = this.getRandomTimeSlot('morning');
    await this.scheduleMessage(family, prompt, 'father_presence_check', time, 'father');
  }

  /**
   * جدولة رسالة خاصة بالطفل
   */
  async scheduleChildMessage(family, child, messageType, time) {
    const childAge = this.calculateAgeInMonths(child.birth_date);
    const timeOfDay = this.getTimeOfDay(time);

    // الحصول على الطقس للرسائل الخارجية
    let weatherContext = null;
    if (messageType === 'child_play') {
      const cityName = this.getCityFromTimezone(family.timezone);
      const weather = await this.weatherService.getWeather(cityName);
      const activity = this.weatherService.getActivitySuggestion(weather);
      weatherContext = `الطقس: ${weather.temp}°م - ${activity.suggestion}`;
    }

    // توليد الرسالة بالذكاء الاصطناعي
    const messageContent = await this.generateChildMessage(
      family.id,
      child.name,
      childAge,
      messageType,
      timeOfDay,
      weatherContext
    );

    // جدولة الرسالة
    await this.scheduleMessage(
      family,
      messageContent,
      messageType,
      time,
      'both' // إرسال للوالدين معاً
    );
  }

  /**
   * جدولة رسالة خاصة بالأم
   */
  async scheduleMotherMessage(family, mother, child, messageType, time) {
    const childAge = this.calculateAgeInMonths(child.birth_date);
    const timeOfDay = this.getTimeOfDay(time);

    const messageContent = await this.generateMotherMessage(
      family.id,
      mother.name,
      child.name,
      childAge,
      messageType,
      timeOfDay
    );

    await this.scheduleMessage(
      family,
      messageContent,
      messageType,
      time,
      'mother'
    );
  }

  /**
   * جدولة رسالة خاصة بالأب
   */
  async scheduleFatherMessage(family, father, child, messageType, time) {
    const childAge = this.calculateAgeInMonths(child.birth_date);
    const timeOfDay = this.getTimeOfDay(time);
    const presenceContext = this.presenceService.buildContext(father.id);

    const messageContent = await this.generateFatherMessage(
      family.id,
      father.name,
      child.name,
      childAge,
      messageType,
      timeOfDay,
      presenceContext
    );

    await this.scheduleMessage(
      family,
      messageContent,
      messageType,
      time,
      'father'
    );
  }

  /**
   * جدولة رسالة خاصة بالعائلة
   */
  async scheduleFamilyMessage(family, messageType, time) {
    const children = ChildModel.getByFamily(family.id);
    const child = children[0];
    const childAge = this.calculateAgeInMonths(child.birth_date);
    const timeOfDay = this.getTimeOfDay(time);

    const messageContent = await this.generateFamilyMessage(
      family.id,
      family.family_name,
      child.name,
      childAge,
      messageType,
      timeOfDay
    );

    await this.scheduleMessage(
      family,
      messageContent,
      messageType,
      time,
      'family'
    );
  }

  /**
   * توليد رسالة للطفل بالذكاء الاصطناعي
   */
  async generateChildMessage(familyId, childName, childAge, messageType, timeOfDay, weatherContext) {
    const prompts = {
      child_sleep: `اكتب رسالة قصيرة (3-4 جمل) للوالدين عن نوم ${childName} (${this.formatAge(childAge)}).
        - نصيحة عملية لتحسين نوم الطفل
        - روتين بسيط قبل النوم
        - شجع على الاستمرارية`,

      child_nutrition: `اكتب رسالة قصيرة (3-4 جمل) للوالدين عن تغذية ${childName} (${this.formatAge(childAge)}).
        - نصيحة عن وجبة صحية
        - تشجيع على التنوع
        - حل بسيط لمشكلة شائعة`,

      child_play: `اكتب رسالة قصيرة (3-4 جمل) للوالدين عن لعب ${childName} (${this.formatAge(childAge)}).
        ${weatherContext ? `الطقس اليوم: ${weatherContext}` : ''}
        - اقترح نشاط لعب مناسب للعمر
        - فوائد النشاط للطفل
        - وقت مقترح للنشاط`,

      child_language: `اكتب رسالة قصيرة (3-4 جمل) للوالدين عن تطوير لغة ${childName} (${this.formatAge(childAge)}).
        - نشاط بسيط لتطوير اللغة
        - كلمات جديدة للتعلم
        - تشجيع على المحادثة`,

      child_creativity: `اكتب رسالة قصيرة (3-4 جمل) للوالدين عن تطوير إبداع ${childName} (${this.formatAge(childAge)}).
        - نشاط إبداعي بسيط
        - مواد متوفرة في المنزل
        - تشجيع على التعبير الحر`,

      child_emotions: `اكتب رسالة قصيرة (3-4 جمل) للوالدين عن عواطف ${childName} (${this.formatAge(childAge)}).
        - كيف يفهم الطفل مشاعره
        - كيف يساعدون الطفل في التعبير
        - التعامل مع الانفعالات`,

      child_independence: `اكتب رسالة قصيرة (3-4 جمل) للوالدين عن استقلالية ${childName} (${this.formatAge(childAge)}).
        - مهارة بسيطة يمكن للطفل تعلمها
        - كيف يشجعون الاستقلالية
        - الصبر والتشجيع`
    };

    const prompt = prompts[messageType] || prompts.child_play;

    try {
      const message = await this.llm.generateMessage({
        messageType,
        guardianName: 'العائلة',
        childName,
        childAge: this.formatAge(childAge),
        timeOfDay,
        additionalContext: prompt,
        familyId
      });

      return message;
    } catch (error) {
      console.error('Error generating child message:', error);
      return this.getFallbackChildMessage(messageType, childName);
    }
  }

  /**
   * توليد رسالة للأم بالذكاء الاصطناعي
   */
  async generateMotherMessage(familyId, motherName, childName, childAge, messageType, timeOfDay) {
    const prompts = {
      mother_selfcare: `اكتب رسالة دافئة ومحفزة (3-4 جمل) للأم ${motherName} عن العناية بنفسها.
        - نصيحة بسيطة للعناية الذاتية (5-10 دقائق)
        - تذكير بأهمية صحتها
        - تشجيع دون شعور بالذنب`,

      mother_energy: `اكتب رسالة محفزة (3-4 جمل) للأم ${motherName} عن الطاقة والنشاط.
        - طريقة بسيطة لزيادة الطاقة
        - تقدير لجهودها
        - نصيحة عملية`,

      mother_emotions: `اكتب رسالة داعمة (3-4 جمل) للأم ${motherName} عن مشاعرها.
        - تطبيع المشاعر الصعبة
        - طريقة بسيطة للتعامل مع الضغط
        - تذكير بأنها تقوم بعمل رائع`,

      mother_relationships: `اكتب رسالة (3-4 جمل) للأم ${motherName} عن العلاقات الاجتماعية.
        - أهمية التواصل مع الآخرين
        - نصيحة بسيطة للحفاظ على الصداقات
        - توازن بين الأمومة والعلاقات`,

      mother_growth: `اكتب رسالة محفزة (3-4 جمل) للأم ${motherName} عن التطور الشخصي.
        - فكرة لتطوير مهارة جديدة
        - تشجيع على التعلم
        - توازن مع المسؤوليات`,

      mother_balance: `اكتب رسالة (3-4 جمل) للأم ${motherName} عن التوازن بين أدوارها.
        - نصيحة لإدارة الوقت
        - تقدير لتعدد أدوارها
        - تذكير بأهمية الأولويات`
    };

    const prompt = prompts[messageType] || prompts.mother_selfcare;

    try {
      const message = await this.llm.generateMessage({
        messageType,
        guardianName: motherName,
        childName,
        childAge: this.formatAge(childAge),
        timeOfDay,
        additionalContext: prompt,
        familyId
      });

      return `💙 *رسالة خاصة للأم*\n\n${message}`;
    } catch (error) {
      console.error('Error generating mother message:', error);
      return this.getFallbackMotherMessage(messageType, motherName);
    }
  }

  /**
   * توليد رسالة للأب بالذكاء الاصطناعي
   */
  async generateFatherMessage(
    familyId,
    fatherName,
    childName,
    childAge,
    messageType,
    timeOfDay,
    presenceContext
  ) {
    const prompts = {
      father_involvement: `اكتب رسالة محفزة (3-4 جمل) للأب ${fatherName} عن المشاركة الفعالة.
        - نشاط بسيط مع ${childName}
        - أهمية دور الأب
        - فكرة عملية للتواصل`,

      father_leadership: `اكتب رسالة (3-4 جمل) للأب ${fatherName} عن القيادة العائلية.
        - نصيحة للقيادة بالقدوة
        - كيف يكون نموذج لأطفاله
        - قرار عائلي بسيط`,

      father_bonding: `اكتب رسالة (3-4 جمل) للأب ${fatherName} عن الارتباط مع ${childName}.
        - نشاط ربط بسيط (10-15 دقيقة)
        - أهمية الوقت المشترك
        - فكرة إبداعية للتواصل`,

      father_support: `اكتب رسالة (3-4 جمل) للأب ${fatherName} عن دعم شريكته.
        - طريقة بسيطة لدعم الأم
        - تقدير للشراكة
        - فعل صغير يصنع فرق`,

      father_growth: `اكتب رسالة محفزة (3-4 جمل) للأب ${fatherName} عن التطور الشخصي.
        - فكرة للتطور كأب
        - تشجيع على التعلم
        - مهارة أبوية جديدة`,

      father_balance: `اكتب رسالة (3-4 جمل) للأب ${fatherName} عن التوازن بين العمل والحياة.
        - نصيحة لإدارة الوقت
        - أهمية التوازن
        - استراتيجية بسيطة`
    };

    const presenceHint = presenceContext?.description ||
      'إذا كان الأب خارج المنزل قدم أفكار دعم عن بعد، وإذا كان في البيت اقترح تواصل مباشر.';
    const presenceTag = presenceContext?.summary || 'لا يوجد سجل تواجد متاح.';
    const prompt = `${prompts[messageType] || prompts.father_involvement}

سجل التواجد: ${presenceTag}
- اضبط النصيحة بناءً على تواجد الأب حالياً (في البيت = تفاعل مباشر، خارج البيت = دعم عن بعد + تقدير لتعبه)
- اجعل الرسالة لطيفة وتذكر أن خروجه من البيت لصالح العائلة، مع لمسة امتنان للشريك.`;

    try {
      const message = await this.llm.generateMessage({
        messageType,
        guardianName: fatherName,
        childName,
        childAge: this.formatAge(childAge),
        timeOfDay,
        additionalContext: `${prompt}\n\n${presenceHint}`,
        familyId
      });

      return `💙 *رسالة خاصة للأب*\n\n${message}`;
    } catch (error) {
      console.error('Error generating father message:', error);
      return this.getFallbackFatherMessage(messageType, fatherName);
    }
  }

  /**
   * توليد رسالة للعائلة بالذكاء الاصطناعي
   */
  async generateFamilyMessage(familyId, familyName, childName, childAge, messageType, timeOfDay) {
    const prompts = {
      family_bonding: `اكتب رسالة (3-4 جمل) لعائلة ${familyName} عن الترابط العائلي.
        - نشاط عائلي بسيط
        - أهمية الوقت المشترك
        - فكرة للتواصل الأسري`,

      family_traditions: `اكتب رسالة (3-4 جمل) لعائلة ${familyName} عن التقاليد العائلية.
        - اقتراح تقليد بسيط
        - أهمية التقاليد للطفل
        - كيف تبدأ تقليد جديد`,

      family_communication: `اكتب رسالة (3-4 جمل) لعائلة ${familyName} عن التواصل العائلي.
        - نشاط للتواصل (وقت الطعام، قبل النوم)
        - أهمية الاستماع
        - سؤال للنقاش العائلي`,

      family_gratitude: `اكتب رسالة (3-4 جمل) لعائلة ${familyName} عن الامتنان والشكر.
        - نشاط امتنان بسيط
        - تعليم ${childName} الشكر
        - فوائد الامتنان`,

      family_fun: `اكتب رسالة (3-4 جمل) لعائلة ${familyName} عن المرح والضحك.
        - لعبة عائلية بسيطة
        - أهمية الضحك المشترك
        - فكرة مرحة`,

      family_values: `اكتب رسالة (3-4 جمل) لعائلة ${familyName} عن القيم العائلية.
        - قيمة مهمة للتركيز عليها
        - كيف تعلمها لـ${childName}
        - مثال عملي`
    };

    const prompt = prompts[messageType] || prompts.family_bonding;

    try {
      const message = await this.llm.generateMessage({
        messageType,
        guardianName: familyName,
        childName,
        childAge: this.formatAge(childAge),
        timeOfDay,
        additionalContext: prompt,
        familyId
      });

      return `👨‍👩‍👧 *رسالة للعائلة*\n\n${message}`;
    } catch (error) {
      console.error('Error generating family message:', error);
      return this.getFallbackFamilyMessage(messageType, familyName);
    }
  }

  /**
   * جدولة رسالة في قاعدة البيانات
   */
  async scheduleMessage(family, messageContent, messageType, time, recipient) {
    const guardians = GuardianModel.getByFamily(family.id);
    if (guardians.length === 0) return;

    // حساب وقت الإرسال
    const now = new Date();
    const [hours, minutes] = time.split(':');
    const scheduledTime = new Date(now);
    scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (scheduledTime < now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }

    // تحديد المستلم
    let targetGuardian;
    if (recipient === 'mother') {
      targetGuardian = guardians.find(g => g.role === 'mother');
    } else if (recipient === 'father') {
      targetGuardian = guardians.find(g => g.role === 'father');
    } else {
      targetGuardian = guardians[0]; // للرسائل المشتركة
    }

    if (!targetGuardian) return;

    const buttons = this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰'];

    this.notifications.schedule({
      familyId: family.id,
      guardianId: targetGuardian.id,
      messageType,
      content: messageContent,
      scheduledTime: format(scheduledTime, 'yyyy-MM-dd HH:mm:ss'),
      buttons,
      slotLabel: time,
      metadata: { recipient }
    });
  }

  /**
   * حساب عمر الطفل بالأشهر
   */
  calculateAgeInMonths(birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    return years * 12 + months;
  }

  /**
   * تنسيق العمر
   */
  formatAge(months) {
    if (months < 12) {
      return `${months} شهر`;
    } else if (months === 12) {
      return 'سنة واحدة';
    } else if (months < 24) {
      return `سنة و${months - 12} شهر`;
    } else {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      if (remainingMonths === 0) {
        return years === 2 ? 'سنتان' : `${years} سنوات`;
      }
      return `${years} سنة و${remainingMonths} شهر`;
    }
  }

  /**
   * الحصول على فترة اليوم
   */
  getTimeOfDay(time) {
    const [hours] = time.split(':');
    const hour = parseInt(hours);

    if (hour >= 6 && hour < 12) return 'الصباح';
    if (hour >= 12 && hour < 17) return 'الظهر';
    if (hour >= 17 && hour < 22) return 'المساء';
    return 'الليل';
  }

  /**
   * الحصول على المدينة من المنطقة الزمنية
   */
  getCityFromTimezone(timezone) {
    const cityMap = {
      'Africa/Cairo': 'Cairo',
      'Asia/Riyadh': 'Riyadh',
      'Asia/Dubai': 'Dubai',
      'Asia/Kuwait': 'Kuwait',
      'Asia/Beirut': 'Beirut',
      'Africa/Casablanca': 'Casablanca'
    };
    return cityMap[timezone] || 'Cairo';
  }

  /**
   * رسائل احتياطية للطفل
   */
  getFallbackChildMessage(messageType, childName) {
    const messages = {
      child_sleep: `وقت النوم مهم لـ${childName}! حاولوا الحفاظ على روتين ثابت قبل النوم. 😴`,
      child_nutrition: `تغذية ${childName} متوازنة مهمة! قدموا له خيارات صحية متنوعة. 🥗`,
      child_play: `وقت اللعب مع ${childName}! اللعب يطور مهاراته ويقوي ارتباطكم. 🎮`,
      child_language: `تحدثوا مع ${childName} كثيراً! الكلام يطور لغته ومهاراته. 💬`,
      child_creativity: `شجعوا إبداع ${childName}! دعوه يرسم ويلون بحرية. 🎨`,
      child_emotions: `ساعدوا ${childName} في فهم مشاعره. امنحوه مساحة للتعبير. 💙`,
      child_independence: `شجعوا ${childName} على الاستقلالية. دعوه يجرب بنفسه! ⭐`
    };
    return messages[messageType] || messages.child_play;
  }

  /**
   * رسائل احتياطية للأم
   */
  getFallbackMotherMessage(messageType, motherName) {
    const messages = {
      mother_selfcare: `💙 *رسالة للأم*\n\nعزيزتي ${motherName}، خذي 10 دقائق لنفسك اليوم. أنتِ تستحقين! 🌸`,
      mother_energy: `💙 *رسالة للأم*\n\n${motherName}، طاقتك مهمة! حاولي النوم مبكراً اليوم. ✨`,
      mother_emotions: `💙 *رسالة للأم*\n\n${motherName}، مشاعرك طبيعية. كل أم تمر بهذا. أنتِ رائعة! 💕`,
      mother_relationships: `💙 *رسالة للأم*\n\n${motherName}، اتصلي بصديقة اليوم. التواصل مهم! 📱`,
      mother_growth: `💙 *رسالة للأم*\n\n${motherName}، تعلمي شيء جديد اليوم ولو بسيط! 📚`,
      mother_balance: `💙 *رسالة للأم*\n\n${motherName}، أنتِ تقومين بأدوار كثيرة. أنتِ بطلة! 🌟`
    };
    return messages[messageType] || messages.mother_selfcare;
  }

  /**
   * رسائل احتياطية للأب
   */
  getFallbackFatherMessage(messageType, fatherName) {
    const messages = {
      father_involvement: `💙 *رسالة للأب*\n\n${fatherName}، خصص 15 دقيقة للعب مع طفلك اليوم. وجودك مهم! 👨‍👧`,
      father_leadership: `💙 *رسالة للأب*\n\n${fatherName}، أنت قدوة لأطفالك. كن المثال الذي تريد أن يتبعوه! 💪`,
      father_bonding: `💙 *رسالة للأب*\n\n${fatherName}، اقرأ قصة لطفلك قبل النوم اليوم! 📖`,
      father_support: `💙 *رسالة للأب*\n\n${fatherName}، ساعد شريكتك اليوم بشيء غير متوقع! 💕`,
      father_growth: `💙 *رسالة للأب*\n\n${fatherName}، تعلم مهارة أبوية جديدة اليوم! 📚`,
      father_balance: `💙 *رسالة للأب*\n\n${fatherName}، توازن بين عملك وعائلتك. كلاهما مهم! ⚖️`
    };
    return messages[messageType] || messages.father_involvement;
  }

  /**
   * رسائل احتياطية للعائلة
   */
  getFallbackFamilyMessage(messageType, familyName) {
    const messages = {
      family_bonding: `👨‍👩‍👧 *رسالة للعائلة*\n\nعائلة ${familyName}، اقضوا وقتاً معاً اليوم. العائلة كنز! 💎`,
      family_traditions: `👨‍👩‍👧 *رسالة للعائلة*\n\nابدؤوا تقليد عائلي جديد! مثل ليلة لعب أسبوعية. 🎲`,
      family_communication: `👨‍👩‍👧 *رسالة للعائلة*\n\nاسألوا بعضكم: ما أفضل شيء حصل اليوم؟ 💬`,
      family_gratitude: `👨‍👩‍👧 *رسالة للعائلة*\n\nشاركوا شيء واحد تشكرون الله عليه اليوم. 🙏`,
      family_fun: `👨‍👩‍👧 *رسالة للعائلة*\n\nوقت المرح! العبوا لعبة عائلية بسيطة. 😄`,
      family_values: `👨‍👩‍👧 *رسالة للعائلة*\n\nتحدثوا عن قيمة الصدق اليوم. كيف نطبقها؟ ⭐`
    };
    return messages[messageType] || messages.family_bonding;
  }
}

export default DailyMessageService;
