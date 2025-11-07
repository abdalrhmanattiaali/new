/**
 * Test Panel for WhatsApp Family AI Assistant
 * لوحة اختبار لمساعد واتساب العائلي
 */

import { MessageEngine } from '../services/messageEngine.js';
import { WeatherService } from '../services/weatherService.js';
import { WeekendPlannerService } from '../services/weekendPlanner.js';
import { WeeklyReportService } from '../services/weeklyReport.js';
import { FamilyModel, GuardianModel, ChildModel } from '../database/models.js';

export class TestPanel {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.messageEngine = new MessageEngine(bot, config);
    this.weatherService = new WeatherService(config);
    this.weekendPlanner = new WeekendPlannerService(bot, config);
    this.weeklyReport = new WeeklyReportService(bot, config);
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
    console.log('1️⃣  test:weather          - اختبار حالة الطقس');
    console.log('2️⃣  test:message [type]   - اختبار رسالة محددة');
    console.log('3️⃣  test:weekend          - اختبار خطة نهاية الأسبوع');
    console.log('4️⃣  test:report           - اختبار التقرير الأسبوعي');
    console.log('5️⃣  test:generate         - توليد رسائل اليوم');
    console.log('6️⃣  test:send             - إرسال الرسائل المجدولة');
    console.log('7️⃣  test:group            - اختبار الإرسال للجروب');
    console.log('8️⃣  test:all              - اختبار شامل لجميع الخصائص');
    console.log('\n💡 أمثلة:');
    console.log('   npm run test -- weather');
    console.log('   npm run test -- message child_play');
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

    console.log('\n✅ اكتملت جميع الاختبارات بنجاح! 🎉\n');
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default TestPanel;
