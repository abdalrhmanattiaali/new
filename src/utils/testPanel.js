/**
 * Test Panel for WhatsApp Family AI Assistant
 * لوحة اختبار لمساعد واتساب العائلي
 */

import { MessageEngine } from '../services/messageEngine.js';
import { WeatherService } from '../services/weatherService.js';
import { WeekendPlannerService } from '../services/weekendPlanner.js';
import { WeeklyReportService } from '../services/weeklyReport.js';
import { MotivationalService } from '../services/motivationalService.js';
import { JourneyService } from '../services/journeyService.js';
import { GoalsService } from '../services/goalsService.js';
import { DailyMessageService } from '../services/dailyMessageService.js';
import { FamilyModel, GuardianModel, ChildModel } from '../database/models.js';

export class TestPanel {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.messageEngine = new MessageEngine(bot, config);
    this.weatherService = new WeatherService(config);
    this.weekendPlanner = new WeekendPlannerService(bot, config);
    this.weeklyReport = new WeeklyReportService(bot, config);
    this.motivational = new MotivationalService(bot, config);
    this.journey = new JourneyService(bot, config);
    this.goals = new GoalsService(bot, config);
    this.dailyMessages = new DailyMessageService(bot, config);
  }

  /**
   * Show test menu
   */
  showMenu() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 لوحة اختبار مساعد واتساب العائلي');
    console.log('   WhatsApp Family AI Assistant - Test Panel');
    console.log('='.repeat(60));
    console.log('\n📋 الأوامر المتاحة:\n');
    console.log('  === الميزات الأساسية ===');
    console.log('1️⃣  test:weather          - اختبار حالة الطقس');
    console.log('2️⃣  test:message [type]   - اختبار رسالة محددة');
    console.log('3️⃣  test:weekend          - اختبار خطة نهاية الأسبوع');
    console.log('4️⃣  test:report           - اختبار التقرير الأسبوعي');
    console.log('5️⃣  test:generate         - توليد رسائل اليوم');
    console.log('6️⃣  test:send             - إرسال الرسائل المجدولة');
    console.log('7️⃣  test:group            - اختبار الإرسال للجروب');
    console.log('8️⃣  test:daily            - اختبار الرسائل اليومية المتنوعة ⭐');
    console.log('\n  === الميزات الجديدة (رحلة التطور) ===');
    console.log('9️⃣  test:motivation       - رسالة تحفيزية');
    console.log('🔟 test:tip              - نصيحة تربوية');
    console.log('1️⃣1️⃣ test:milestone       - معالم التطور');
    console.log('1️⃣2️⃣ test:toys            - اقتراحات الألعاب');
    console.log('1️⃣3️⃣ test:goals           - أهداف الوالدين');
    console.log('1️⃣4️⃣ test:journey         - رحلة التطور الكاملة');
    console.log('\n8️⃣  test:all              - اختبار شامل لجميع الخصائص');
    console.log('\n💡 أمثلة:');
    console.log('   npm run test -- weather');
    console.log('   npm run test -- message child_play');
    console.log('   npm run test -- motivation');
    console.log('   npm run test -- journey');
    console.log('   npm run test -- all\n');
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Run test based on command
   */
  async run(command, ...args) {
    try {
      switch (command) {
        case 'weather':
          await this.testWeather();
          break;

        case 'message':
          await this.testMessage(args[0] || 'child_play');
          break;

        case 'weekend':
          await this.testWeekend();
          break;

        case 'report':
          await this.testReport();
          break;

        case 'generate':
          await this.testGenerate();
          break;

        case 'send':
          await this.testSend();
          break;

        case 'group':
          await this.testGroup();
          break;

        case 'motivation':
          await this.testMotivation();
          break;

        case 'tip':
          await this.testParentingTip();
          break;

        case 'milestone':
          await this.testMilestone();
          break;

        case 'toys':
          await this.testToys();
          break;

        case 'goals':
          await this.testGoals();
          break;

        case 'journey':
          await this.testJourney();
          break;

        case 'daily':
          await this.testDailyMessages();
          break;

        case 'all':
          await this.testAll();
          break;

        default:
          this.showMenu();
      }
    } catch (error) {
      console.error('❌ خطأ في الاختبار:', error);
    }
  }

  /**
   * Test weather service
   */
  async testWeather() {
    console.log('\n🌤️ اختبار خدمة الطقس...\n');

    const cities = ['Cairo', 'Riyadh', 'Dubai'];

    for (const city of cities) {
      console.log(`📍 ${city}:`);
      const weather = await this.weatherService.getWeather(city);
      console.log(this.weatherService.formatWeatherMessage(weather));
      console.log('');
    }

    console.log('✅ اكتمل اختبار الطقس\n');
  }

  /**
   * Test message generation
   */
  async testMessage(messageType) {
    console.log(`\n📨 اختبار توليد رسالة: ${messageType}...\n`);

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة. قم بتشغيل Onboarding أولاً.');
      return;
    }

    const family = families[0];
    const guardians = GuardianModel.getByFamily(family.id);
    const children = ChildModel.getByFamily(family.id);

    if (guardians.length === 0 || children.length === 0) {
      console.log('❌ بيانات العائلة غير مكتملة.');
      return;
    }

    await this.messageEngine.generateInstantMessage(
      guardians[0],
      children[0],
      messageType
    );

    console.log('✅ تم إرسال الرسالة الاختبارية\n');
  }

  /**
   * Test weekend planning
   */
  async testWeekend() {
    console.log('\n🎬 اختبار خطة نهاية الأسبوع...\n');

    await this.weekendPlanner.generateWeekendPlans();
    await this.weekendPlanner.sendWeekendPlans();

    console.log('✅ اكتمل اختبار نهاية الأسبوع\n');
  }

  /**
   * Test weekly report
   */
  async testReport() {
    console.log('\n📊 اختبار التقرير الأسبوعي...\n');

    await this.weeklyReport.generateAndSendReports();

    console.log('✅ اكتمل اختبار التقرير\n');
  }

  /**
   * Test message generation
   */
  async testGenerate() {
    console.log('\n⚙️ اختبار توليد الرسائل اليومية...\n');

    await this.messageEngine.generateDailyMessages();

    console.log('✅ اكتمل توليد الرسائل\n');
  }

  /**
   * Test sending messages
   */
  async testSend() {
    console.log('\n📤 اختبار إرسال الرسائل المجدولة...\n');

    await this.messageEngine.sendPendingMessages();

    console.log('✅ اكتمل إرسال الرسائل\n');
  }

  /**
   * Test group messaging
   */
  async testGroup() {
    console.log('\n👨‍👩‍👧‍👦 اختبار الإرسال للجروب العائلي...\n');

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة.');
      return;
    }

    for (const family of families) {
      console.log(`\nالعائلة: ${family.family_name}`);
      console.log(`الإرسال للجروب: ${family.send_to_group ? 'نعم ✅' : 'لا ❌'}`);
      console.log(`معرف الجروب: ${family.family_group_id || 'غير محدد'}`);

      if (family.send_to_group && family.family_group_id) {
        console.log('✅ الإعدادات صحيحة للإرسال للجروب');
        console.log('\n💡 لاختبار إرسال رسالة للجروب، استخدم:');
        console.log('   npm run test -- message child_play');
      } else {
        console.log('⚠️ لم يتم تفعيل الإرسال للجروب');
        console.log('\n💡 لتفعيل الإرسال للجروب:');
        console.log('   1. أضف البوت لجروب واتساب يحتوي على الأب والأم');
        console.log('   2. احصل على معرف الجروب (group ID)');
        console.log('   3. حدّث قاعدة البيانات بمعرف الجروب');
      }
    }

    console.log('\n✅ اكتمل اختبار الجروب\n');
  }

  /**
   * Test motivational messages
   */
  async testMotivation() {
    console.log('\n💙 اختبار الرسائل التحفيزية...\n');

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة.');
      return;
    }

    const family = families[0];
    const guardians = GuardianModel.getByFamily(family.id);

    if (guardians.length > 0) {
      const message = await this.motivational.generateMotivationalMessage(guardians[0]);
      console.log('📨 رسالة تحفيزية للأب/الأم:\n');
      console.log(message);
      console.log();
    }

    console.log('✅ اكتمل اختبار الرسائل التحفيزية\n');
  }

  /**
   * Test parenting tips
   */
  async testParentingTip() {
    console.log('\n💡 اختبار النصائح التربوية...\n');

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة.');
      return;
    }

    const family = families[0];
    const tip = await this.motivational.generateParentingTip(family.id);

    if (tip) {
      console.log('📝 نصيحة تربوية:\n');
      console.log(tip);
      console.log();
    }

    console.log('✅ اكتمل اختبار النصائح التربوية\n');
  }

  /**
   * Test milestones
   */
  async testMilestone() {
    console.log('\n📊 اختبار معالم التطور...\n');

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة.');
      return;
    }

    const family = families[0];
    const children = ChildModel.getByFamily(family.id);

    if (children.length > 0) {
      const child = children[0];
      const ageMonths = this.journey.calculateAgeInMonths(child.birth_date);

      console.log(`👶 طفل: ${child.name}`);
      console.log(`📅 العمر: ${this.journey.formatAge(ageMonths)}\n`);

      // Initialize journey if not done
      await this.journey.initializeJourney(family.id);

      // Get milestones
      const milestones = this.journey.getMilestoneTemplates(ageMonths);
      console.log('📋 معالم التطور المتوقعة:\n');
      milestones.slice(0, 5).forEach(m => {
        console.log(`  ${this.getMilestoneIcon(m.type)} ${m.title}`);
        console.log(`     ${m.description}`);
        console.log();
      });
    }

    console.log('✅ اكتمل اختبار معالم التطور\n');
  }

  /**
   * Test toy recommendations
   */
  async testToys() {
    console.log('\n🎁 اختبار اقتراحات الألعاب...\n');

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة.');
      return;
    }

    const family = families[0];
    const children = ChildModel.getByFamily(family.id);

    if (children.length > 0) {
      const child = children[0];
      const ageMonths = this.journey.calculateAgeInMonths(child.birth_date);

      console.log(`👶 طفل: ${child.name}`);
      console.log(`📅 العمر: ${this.journey.formatAge(ageMonths)}\n`);

      await this.journey.generateToyRecommendations(child.id, ageMonths);
      console.log('✅ تم توليد اقتراحات الألعاب\n');
    }

    console.log('✅ اكتمل اختبار اقتراحات الألعاب\n');
  }

  /**
   * Test parent goals
   */
  async testGoals() {
    console.log('\n📚 اختبار أهداف الوالدين...\n');

    const guardians = GuardianModel.getAll();
    if (guardians.length === 0) {
      console.log('❌ لا يوجد أولياء أمور مسجلون.');
      return;
    }

    const guardian = guardians[0];
    console.log(`👤 ولي الأمر: ${guardian.name} (${guardian.role})\n`);

    // Suggest goals
    const goals = await this.goals.suggestGoals(guardian.id);

    console.log('🎯 أهداف مقترحة:\n');
    goals.forEach((goal, index) => {
      console.log(`${index + 1}. ${this.goals.getGoalIcon(goal.type)} ${goal.title}`);
      console.log(`   ${goal.description}`);
      console.log(`   الفئة: ${goal.category}`);
      console.log();
    });

    console.log('✅ اكتمل اختبار أهداف الوالدين\n');
  }

  /**
   * Test full journey
   */
  async testJourney() {
    console.log('\n🌟 اختبار رحلة التطور الكاملة...\n');

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة.');
      return;
    }

    const family = families[0];
    console.log(`👨‍👩‍👧 عائلة: ${family.family_name}\n`);

    // Initialize journey
    await this.journey.initializeJourney(family.id);

    // Get journey timeline
    const timeline = this.journey.getJourneyTimeline(family.id, 10);

    if (timeline.length > 0) {
      console.log('📜 آخر أحداث الرحلة:\n');
      timeline.forEach(event => {
        console.log(`  📅 ${event.journey_date}`);
        console.log(`  ${this.getEventIcon(event.event_type)} ${event.event_title}`);
        console.log(`     ${event.event_description}`);
        console.log();
      });
    } else {
      console.log('📝 الرحلة بدأت للتو! سيتم تسجيل الأحداث تلقائياً.\n');
    }

    console.log('✅ اكتمل اختبار رحلة التطور\n');
  }

  /**
   * Test diverse daily messages
   */
  async testDailyMessages() {
    console.log('\n🌟 اختبار الرسائل اليومية المتنوعة...\n');

    const families = FamilyModel.getAll();
    if (families.length === 0) {
      console.log('❌ لا توجد عائلات مسجلة.');
      return;
    }

    const family = families[0];
    const guardians = GuardianModel.getByFamily(family.id);
    const children = ChildModel.getByFamily(family.id);

    if (children.length === 0 || guardians.length === 0) {
      console.log('❌ لا توجد بيانات كافية (تحتاج طفل و ولي أمر على الأقل).');
      return;
    }

    const child = children[0];
    const father = guardians.find(g => g.role === 'father');
    const mother = guardians.find(g => g.role === 'mother');

    console.log(`👨‍👩‍👧 عائلة: ${family.family_name}`);
    console.log(`👶 طفل: ${child.name}\n`);

    // اختبار رسالة للطفل
    if (child) {
      console.log('📨 اختبار رسالة للطفل (child_creativity):\n');
      const childMsg = await this.dailyMessages.generateChildMessage(
        child.name,
        this.dailyMessages.calculateAgeInMonths(child.birth_date),
        'child_creativity',
        'الصباح',
        null
      );
      console.log(childMsg);
      console.log('\n---\n');
    }

    // اختبار رسالة للأم
    if (mother && child) {
      console.log('💙 اختبار رسالة للأم (mother_selfcare):\n');
      const motherMsg = await this.dailyMessages.generateMotherMessage(
        mother.name,
        child.name,
        this.dailyMessages.calculateAgeInMonths(child.birth_date),
        'mother_selfcare',
        'الصباح'
      );
      console.log(motherMsg);
      console.log('\n---\n');
    }

    // اختبار رسالة للأب
    if (father && child) {
      console.log('💙 اختبار رسالة للأب (father_bonding):\n');
      const fatherMsg = await this.dailyMessages.generateFatherMessage(
        father.name,
        child.name,
        this.dailyMessages.calculateAgeInMonths(child.birth_date),
        'father_bonding',
        'المساء'
      );
      console.log(fatherMsg);
      console.log('\n---\n');
    }

    // اختبار رسالة للعائلة
    if (child) {
      console.log('👨‍👩‍👧 اختبار رسالة للعائلة (family_bonding):\n');
      const familyMsg = await this.dailyMessages.generateFamilyMessage(
        family.family_name,
        child.name,
        this.dailyMessages.calculateAgeInMonths(child.birth_date),
        'family_bonding',
        'المساء'
      );
      console.log(familyMsg);
      console.log('\n---\n');
    }

    // توليد جميع الرسائل اليومية
    console.log('🔄 توليد جميع الرسائل اليومية للعائلة...\n');
    await this.dailyMessages.generateFamilyDailyMessages(family);

    console.log('✅ اكتمل اختبار الرسائل اليومية المتنوعة\n');
  }

  /**
   * Run all tests
   */
  async testAll() {
    console.log('\n🔬 تشغيل جميع الاختبارات...\n');

    await this.testWeather();
    await this.sleep(2000);

    await this.testGenerate();
    await this.sleep(2000);

    await this.testSend();
    await this.sleep(2000);

    await this.testGroup();
    await this.sleep(2000);

    // Journey tests
    await this.testMotivation();
    await this.sleep(2000);

    await this.testParentingTip();
    await this.sleep(2000);

    await this.testMilestone();
    await this.sleep(2000);

    await this.testToys();
    await this.sleep(2000);

    await this.testGoals();
    await this.sleep(2000);

    await this.testJourney();

    console.log('\n✅ اكتملت جميع الاختبارات بنجاح! 🎉\n');
  }

  /**
   * Get milestone icon by type
   */
  getMilestoneIcon(type) {
    const icons = {
      physical: '🏃',
      cognitive: '🧠',
      social: '👥',
      language: '💬'
    };
    return icons[type] || '📌';
  }

  /**
   * Get event icon by type
   */
  getEventIcon(type) {
    const icons = {
      milestone: '🎯',
      goal_achieved: '🏆',
      learning_completed: '📚',
      challenge: '💪'
    };
    return icons[type] || '⭐';
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TestPanel;
