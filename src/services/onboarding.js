/**
 * Onboarding Service
 * خدمة الإعداد الأولي للعائلة
 */

import { FamilyModel, GuardianModel, ChildModel } from '../database/models.js';

export class OnboardingService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.sessions = new Map();
  }

  /**
   * Start onboarding process
   */
  async startOnboarding(phoneNumber) {
    const session = {
      step: 'welcome',
      data: {
        phoneNumber
      }
    };

    this.sessions.set(phoneNumber, session);

    const welcomeMessage = `
👋 *أهلاً بك في مساعد العائلة الذكي!*

أنا هنا لمساعدتك في:
✅ تنظيم روتين الأطفال (نوم، أكل، لعب)
✅ دعم الصحة النفسية للوالدين
✅ تذكيرات مهمة (تطعيمات، مواعيد)
✅ اقتراحات تعلم وترفيه
✅ تخطيط نهاية الأسبوع

دعنا نبدأ بإعداد حسابك! 🚀

*ما هو اسمك؟*
    `.trim();

    await this.bot.sendMessage(phoneNumber, welcomeMessage);
    session.step = 'name';
  }

  /**
   * Process onboarding step
   */
  async processStep(phoneNumber, session, message) {
    const currentSession = this.sessions.get(phoneNumber) || session;

    switch (currentSession.step) {
      case 'name':
        await this.handleNameStep(phoneNumber, currentSession, message);
        break;

      case 'role':
        await this.handleRoleStep(phoneNumber, currentSession, message);
        break;

      case 'family_name':
        await this.handleFamilyNameStep(phoneNumber, currentSession, message);
        break;

      case 'timezone':
        await this.handleTimezoneStep(phoneNumber, currentSession, message);
        break;

      case 'preferred_time':
        await this.handlePreferredTimeStep(phoneNumber, currentSession, message);
        break;

      case 'children_count':
        await this.handleChildrenCountStep(phoneNumber, currentSession, message);
        break;

      case 'child_info':
        await this.handleChildInfoStep(phoneNumber, currentSession, message);
        break;

      case 'tracks':
        await this.handleTracksStep(phoneNumber, currentSession, message);
        break;

      case 'complete':
        await this.completeOnboarding(phoneNumber, currentSession);
        break;

      default:
        await this.bot.sendMessage(phoneNumber, 'حدث خطأ. دعنا نبدأ من جديد.');
        await this.startOnboarding(phoneNumber);
    }
  }

  /**
   * Handle name step
   */
  async handleNameStep(phoneNumber, session, message) {
    session.data.name = message;
    session.step = 'role';

    await this.bot.sendMessage(
      phoneNumber,
      `أهلاً ${message}! 😊\n\n*ما هو دورك في العائلة؟*\n1. الأب\n2. الأم`
    );

    this.sessions.set(phoneNumber, session);
  }

  /**
   * Handle role step
   */
  async handleRoleStep(phoneNumber, session, message) {
    const roleMap = {
      '1': 'father',
      '2': 'mother',
      'أب': 'father',
      'أم': 'mother',
      'الأب': 'father',
      'الأم': 'mother'
    };

    const role = roleMap[message.toLowerCase()] || roleMap[message];

    if (!role) {
      await this.bot.sendMessage(phoneNumber, 'اختر رقم 1 للأب أو 2 للأم');
      return;
    }

    session.data.role = role;
    session.step = 'family_name';

    await this.bot.sendMessage(
      phoneNumber,
      `رائع! *ما هو اسم عائلتك؟*\n(مثال: عائلة أحمد)`
    );

    this.sessions.set(phoneNumber, session);
  }

  /**
   * Handle family name step
   */
  async handleFamilyNameStep(phoneNumber, session, message) {
    session.data.familyName = message;
    session.step = 'timezone';

    await this.bot.sendMessage(
      phoneNumber,
      `*ما هي مدينتك أو المنطقة الزمنية؟*\n\n1. القاهرة (Africa/Cairo)\n2. الرياض (Asia/Riyadh)\n3. دبي (Asia/Dubai)\n4. أخرى (سأكتبها)`
    );

    this.sessions.set(phoneNumber, session);
  }

  /**
   * Handle timezone step
   */
  async handleTimezoneStep(phoneNumber, session, message) {
    const timezoneMap = {
      '1': 'Africa/Cairo',
      '2': 'Asia/Riyadh',
      '3': 'Asia/Dubai',
      'القاهرة': 'Africa/Cairo',
      'الرياض': 'Asia/Riyadh',
      'دبي': 'Asia/Dubai'
    };

    const timezone = timezoneMap[message] || message;
    session.data.timezone = timezone;
    session.step = 'preferred_time';

    await this.bot.sendMessage(
      phoneNumber,
      `*ما هو الوقت المفضل لك لاستقبال الرسائل؟*\n\n1. الصباح (7:00 - 12:00)\n2. الظهر (12:00 - 17:00)\n3. المساء (17:00 - 21:00)`
    );

    this.sessions.set(phoneNumber, session);
  }

  /**
   * Handle preferred time step
   */
  async handlePreferredTimeStep(phoneNumber, session, message) {
    const timeMap = {
      '1': 'morning',
      '2': 'noon',
      '3': 'evening',
      'صباح': 'morning',
      'ظهر': 'noon',
      'مساء': 'evening'
    };

    const preferredTime = timeMap[message] || 'morning';
    session.data.preferredTime = preferredTime;
    session.step = 'children_count';

    await this.bot.sendMessage(
      phoneNumber,
      `*كم عدد الأطفال لديك؟*\n(أدخل رقماً من 1 إلى 5)`
    );

    this.sessions.set(phoneNumber, session);
  }

  /**
   * Handle children count step
   */
  async handleChildrenCountStep(phoneNumber, session, message) {
    const count = parseInt(message);

    if (isNaN(count) || count < 1 || count > 5) {
      await this.bot.sendMessage(phoneNumber, 'من فضلك أدخل رقماً من 1 إلى 5');
      return;
    }

    session.data.childrenCount = count;
    session.data.children = [];
    session.data.currentChildIndex = 0;
    session.step = 'child_info';

    await this.bot.sendMessage(
      phoneNumber,
      `ممتاز! دعنا نسجل معلومات الطفل الأول.\n\n*ما هو اسم الطفل الأول؟*`
    );

    session.data.childStep = 'name';
    this.sessions.set(phoneNumber, session);
  }

  /**
   * Handle child info step
   */
  async handleChildInfoStep(phoneNumber, session, message) {
    const childIndex = session.data.currentChildIndex;
    const childStep = session.data.childStep;

    if (!session.data.children[childIndex]) {
      session.data.children[childIndex] = {};
    }

    const child = session.data.children[childIndex];

    if (childStep === 'name') {
      child.name = message;
      session.data.childStep = 'birthdate';
      await this.bot.sendMessage(
        phoneNumber,
        `*ما هو تاريخ ميلاد ${child.name}؟*\n(مثال: 2020-05-15)`
      );
    } else if (childStep === 'birthdate') {
      child.birthdate = message;
      session.data.childStep = 'allergies';
      await this.bot.sendMessage(
        phoneNumber,
        `*هل ${child.name} لديه أي حساسية طعام؟*\n(إذا لا، اكتب "لا")`
      );
    } else if (childStep === 'allergies') {
      child.allergies = message.toLowerCase() === 'لا' ? null : message;

      // Check if we need to add more children
      if (childIndex + 1 < session.data.childrenCount) {
        session.data.currentChildIndex++;
        session.data.childStep = 'name';
        await this.bot.sendMessage(
          phoneNumber,
          `رائع! الآن دعنا نسجل معلومات الطفل ${session.data.currentChildIndex + 1}.\n\n*ما هو اسمه؟*`
        );
      } else {
        // All children added, move to tracks
        session.step = 'tracks';
        await this.bot.sendMessage(
          phoneNumber,
          `ممتاز! *ما هي المسارات التي تريد تفعيلها؟*\n\n1. روتين النوم ✅\n2. التغذية ✅\n3. اللعب والنشاط ✅\n4. تطوير اللغة ✅\n5. أوقات الصلاة (اختياري)\n6. تخطيط نهاية الأسبوع ✅\n\nاكتب "كلها" لتفعيل جميع المسارات، أو "المتابعة" للاستمرار بالإعدادات الافتراضية.`
        );
      }
    }

    this.sessions.set(phoneNumber, session);
  }

  /**
   * Handle tracks selection step
   */
  async handleTracksStep(phoneNumber, session, message) {
    // For now, enable all tracks by default
    session.data.tracks = ['child_sleep', 'child_nutrition', 'child_play', 'child_language', 'weekend_planner'];

    if (message.includes('صلاة')) {
      session.data.tracks.push('prayer_times');
    }

    session.step = 'complete';
    await this.completeOnboarding(phoneNumber, session);
  }

  /**
   * Complete onboarding and save to database
   */
  async completeOnboarding(phoneNumber, session) {
    try {
      // Create family
      const familyId = FamilyModel.create(
        session.data.familyName,
        session.data.timezone,
        'ar'
      );

      // Create guardian
      const guardianId = GuardianModel.create(
        familyId,
        session.data.name,
        session.data.role,
        phoneNumber,
        session.data.preferredTime
      );

      // Create children
      for (const child of session.data.children) {
        ChildModel.create(
          familyId,
          child.name,
          child.birthdate,
          child.allergies,
          null
        );
      }

      // Mark onboarding as complete
      FamilyModel.updateOnboarding(familyId, true);

      // Send completion message
      const completionMessage = `
🎉 *تم إعداد حسابك بنجاح!*

*ملخص:*
👤 العائلة: ${session.data.familyName}
👨‍👩‍👧‍👦 عدد الأطفال: ${session.data.childrenCount}
⏰ الوقت المفضل: ${this.getTimeLabel(session.data.preferredTime)}
🌍 المنطقة الزمنية: ${session.data.timezone}

*ماذا بعد؟*
✅ سأبدأ بإرسال رسائل يومية مخصصة
✅ ستحصل على تذكيرات في الوقت المناسب
✅ كل خميس: اقتراحات نهاية الأسبوع
✅ كل جمعة: تقرير أسبوعي

اكتب "مساعدة" في أي وقت لرؤية الأوامر المتاحة.

مرحباً بك في العائلة! 🎊
      `.trim();

      await this.bot.sendMessage(phoneNumber, completionMessage);

      // Clear session
      this.sessions.delete(phoneNumber);
      session.step = 'completed';

    } catch (error) {
      console.error('Error completing onboarding:', error);
      await this.bot.sendMessage(
        phoneNumber,
        '❌ حدث خطأ في حفظ البيانات. من فضلك حاول مرة أخرى.'
      );
    }
  }

  /**
   * Get time label in Arabic
   */
  getTimeLabel(time) {
    const labels = {
      morning: 'الصباح (7:00 - 12:00)',
      noon: 'الظهر (12:00 - 17:00)',
      evening: 'المساء (17:00 - 21:00)'
    };
    return labels[time] || time;
  }
}

export default OnboardingService;
