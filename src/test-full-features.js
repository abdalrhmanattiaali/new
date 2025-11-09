/**
 * ============================================
 * 🧪 اختبار شامل لجميع ميزات المساعد العائلي
 * Full Features Test with Real Family Data
 * ============================================
 *
 * هذا السكريبت يقوم بـ:
 * 1. إنشاء عائلة تجريبية في قاعدة البيانات
 * 2. اختبار جميع الخدمات والميزات
 * 3. طباعة جميع الرسائل المولدة
 *
 * الاستخدام:
 * npm run test:full
 */

// ============================================
// 🔑 API KEYS - ضع مفاتيح API هنا
// ============================================
// ⚠️ IMPORTANT: استبدل بـ API Key الصحيح من OpenAI
global.OPENAI_API_KEY = 'sk-PLACEHOLDER-REPLACE-WITH-YOUR-REAL-OPENAI-KEY';
// احصل على API Key من: https://platform.openai.com/api-keys
// ============================================

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

// Import Services
import { DailyMessageService } from './services/dailyMessageService.js';
import { ChildDevelopmentService } from './services/childDevelopmentService.js';
import { MonthlyMilestoneService } from './services/monthlyMilestoneService.js';
import { DailyWeatherService } from './services/dailyWeatherService.js';
import { AnniversaryReminderService } from './services/anniversaryReminderService.js';
import { MotivationalService } from './services/motivationalService.js';
import { WeekendPlannerService } from './services/weekendPlanner.js';
import { WeeklyReportService } from './services/weeklyReport.js';
import { GoalsService } from './services/goalsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================
// 🎨 Colors for Console Output
// ============================================
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m'
};

// ============================================
// 📊 Helper Functions
// ============================================
function printHeader(title) {
  console.log('\n' + '='.repeat(70));
  console.log(colors.bright + colors.cyan + title + colors.reset);
  console.log('='.repeat(70) + '\n');
}

function printSubHeader(title) {
  console.log('\n' + colors.bright + colors.yellow + '📝 ' + title + colors.reset);
  console.log('-'.repeat(70));
}

function printSuccess(message) {
  console.log(colors.green + '✅ ' + message + colors.reset);
}

function printError(message) {
  console.log(colors.red + '❌ ' + message + colors.reset);
}

function printInfo(message) {
  console.log(colors.blue + 'ℹ️  ' + message + colors.reset);
}

function printMessage(label, content) {
  console.log('\n' + colors.bright + label + ':' + colors.reset);
  console.log(colors.dim + '-'.repeat(70) + colors.reset);
  console.log(content);
  console.log(colors.dim + '-'.repeat(70) + colors.reset);
}

// ============================================
// 🗄️ Database Setup
// ============================================
function setupTestDatabase() {
  const testDbPath = join(__dirname, '..', 'data', 'test_family.db');

  // حذف قاعدة البيانات التجريبية القديمة إن وجدت
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
    printInfo('تم حذف قاعدة البيانات التجريبية القديمة');
  }

  const db = new Database(testDbPath);

  // إنشاء الجداول
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      timezone TEXT DEFAULT 'Africa/Cairo',
      language TEXT DEFAULT 'ar',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS guardians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      preferred_time TEXT,
      onboarding_completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      birth_date DATE NOT NULL,
      gender TEXT,
      allergies TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS message_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      guardian_phone TEXT,
      message_type TEXT NOT NULL,
      content TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS family_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_date DATE,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );

    CREATE TABLE IF NOT EXISTS family_journey (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family_id INTEGER NOT NULL,
      milestone_type TEXT NOT NULL,
      milestone_data TEXT,
      achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (family_id) REFERENCES families(id)
    );
  `);

  return db;
}

function createTestFamily(db) {
  printSubHeader('إنشاء عائلة تجريبية');

  // إنشاء العائلة
  const familyResult = db.prepare(`
    INSERT INTO families (name, timezone, language)
    VALUES (?, ?, ?)
  `).run('عائلة أحمد', 'Africa/Cairo', 'ar');

  const familyId = familyResult.lastInsertRowid;
  printSuccess(`تم إنشاء العائلة برقم: ${familyId}`);

  // إضافة الأب
  db.prepare(`
    INSERT INTO guardians (family_id, phone, name, role, preferred_time, onboarding_completed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(familyId, '+201234567890', 'أحمد', 'father', 'morning', 1);
  printSuccess('تم إضافة الأب: أحمد');

  // إضافة الأم
  db.prepare(`
    INSERT INTO guardians (family_id, phone, name, role, preferred_time, onboarding_completed)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(familyId, '+201234567891', 'فاطمة', 'mother', 'evening', 1);
  printSuccess('تم إضافة الأم: فاطمة');

  // إضافة طفل عمره 4 شهور
  const childBirthDate = new Date();
  childBirthDate.setMonth(childBirthDate.getMonth() - 4);
  const birthDateStr = childBirthDate.toISOString().split('T')[0];

  db.prepare(`
    INSERT INTO children (family_id, name, birth_date, gender, allergies)
    VALUES (?, ?, ?, ?, ?)
  `).run(familyId, 'محمد', birthDateStr, 'male', null);
  printSuccess(`تم إضافة الطفل: محمد (عمره 4 شهور - تاريخ الميلاد: ${birthDateStr})`);

  // إضافة هدف عائلي
  const targetDate = new Date();
  targetDate.setMonth(targetDate.getMonth() + 2);
  db.prepare(`
    INSERT INTO family_goals (family_id, title, description, target_date, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    familyId,
    'تطوير مهارات الجلوس',
    'نريد أن يتمكن محمد من الجلوس بمفرده خلال الشهرين القادمين',
    targetDate.toISOString().split('T')[0],
    'active'
  );
  printSuccess('تم إضافة هدف عائلي');

  return familyId;
}

// ============================================
// 🤖 Mock Bot Helper
// ============================================
function createMockBot(db) {
  return {
    db: db,
    sendMessage: async (phoneNumber, message) => {
      // Find guardian name
      const guardian = db.prepare('SELECT name FROM guardians WHERE phone = ?').get(phoneNumber);
      const guardianName = guardian ? guardian.name : phoneNumber;
      printMessage(`رسالة إلى ${guardianName} (${phoneNumber})`, message);

      // Log to database
      const family = db.prepare('SELECT family_id FROM guardians WHERE phone = ?').get(phoneNumber);
      if (family) {
        db.prepare(`
          INSERT INTO message_log (family_id, guardian_phone, message_type, content)
          VALUES (?, ?, ?, ?)
        `).run(family.family_id, phoneNumber, 'test', message);
      }

      return true;
    },
    getGroupId: (familyId) => {
      return null; // No group for testing
    }
  };
}

// ============================================
// 🧪 Test Functions
// ============================================
async function testDailyMessages(db, config, familyId) {
  printSubHeader('اختبار الرسائل اليومية المتنوعة');

  try {
    const mockBot = createMockBot(db);
    const service = new DailyMessageService(mockBot, config);

    await service.generateAllDailyMessages();
    printSuccess('تم اختبار الرسائل اليومية المتنوعة بنجاح');
  } catch (error) {
    printError(`فشل اختبار الرسائل اليومية: ${error.message}`);
    console.error(error);
  }
}

async function testChildDevelopment(db, config, familyId) {
  printSubHeader('اختبار رسائل تطوير الطفل (4 شهور)');

  try {
    const mockBot = createMockBot(db);
    const service = new ChildDevelopmentService(mockBot, config);

    await service.sendDailyDevelopmentMessages();
    printSuccess('تم اختبار رسائل تطوير الطفل بنجاح');
  } catch (error) {
    printError(`فشل اختبار تطوير الطفل: ${error.message}`);
    console.error(error);
  }
}

async function testMonthlyMilestone(db, config, familyId) {
  printSubHeader('اختبار تذكيرات المعالم الشهرية');

  try {
    const mockBot = createMockBot(db);
    const service = new MonthlyMilestoneService(mockBot, config);

    await service.checkAndSendMonthlyReminders();
    printSuccess('تم اختبار المعالم الشهرية بنجاح');
  } catch (error) {
    printError(`فشل اختبار المعالم الشهرية: ${error.message}`);
    console.error(error);
  }
}

async function testWeatherService(db, config, familyId) {
  printSubHeader('اختبار خدمة الطقس اليومية');

  try {
    const mockBot = createMockBot(db);
    const service = new DailyWeatherService(mockBot, config);

    await service.sendDailyWeatherUpdates();
    printSuccess('تم اختبار خدمة الطقس بنجاح');
  } catch (error) {
    printError(`فشل اختبار خدمة الطقس: ${error.message}`);
    console.error(error);
  }
}

async function testAnniversaryReminders(db, config, familyId) {
  printSubHeader('اختبار تذكيرات المناسبات');

  try {
    const mockBot = createMockBot(db);
    const service = new AnniversaryReminderService(mockBot, config);

    await service.checkAndSendReminders();
    printSuccess('تم اختبار تذكيرات المناسبات بنجاح');
  } catch (error) {
    printError(`فشل اختبار المناسبات: ${error.message}`);
    console.error(error);
  }
}

async function testMotivationalMessages(db, config, familyId) {
  printSubHeader('اختبار الرسائل التحفيزية');

  try {
    const mockBot = createMockBot(db);
    const service = new MotivationalService(mockBot, config);

    await service.sendDailyMotivationToAllFamilies();
    printSuccess('تم اختبار الرسائل التحفيزية بنجاح');
  } catch (error) {
    printError(`فشل اختبار الرسائل التحفيزية: ${error.message}`);
    console.error(error);
  }
}

async function testWeekendPlanner(db, config, familyId) {
  printSubHeader('اختبار خطة نهاية الأسبوع');

  try {
    const mockBot = createMockBot(db);
    const service = new WeekendPlannerService(mockBot, config);

    await service.generateWeekendPlans();
    printSuccess('تم اختبار خطة نهاية الأسبوع بنجاح');
  } catch (error) {
    printError(`فشل اختبار خطة نهاية الأسبوع: ${error.message}`);
    console.error(error);
  }
}

async function testWeeklyReport(db, config, familyId) {
  printSubHeader('اختبار التقرير الأسبوعي');

  try {
    const mockBot = createMockBot(db);
    const service = new WeeklyReportService(mockBot, config);

    await service.generateAndSendReports();
    printSuccess('تم اختبار التقرير الأسبوعي بنجاح');
  } catch (error) {
    printError(`فشل اختبار التقرير الأسبوعي: ${error.message}`);
    console.error(error);
  }
}

async function testGoalsService(db, config, familyId) {
  printSubHeader('اختبار خدمة الأهداف');

  try {
    const mockBot = createMockBot(db);
    const service = new GoalsService(mockBot, config);

    await service.sendGoalReminders();
    printSuccess('تم اختبار خدمة الأهداف بنجاح');
  } catch (error) {
    printError(`فشل اختبار خدمة الأهداف: ${error.message}`);
    console.error(error);
  }
}

// ============================================
// 🎯 Main Test Runner
// ============================================
async function runFullTest() {
  const startTime = Date.now();

  printHeader('🧪 اختبار شامل لجميع ميزات المساعد العائلي الذكي');

  // التحقق من API Key
  if (!global.OPENAI_API_KEY || global.OPENAI_API_KEY.includes('PLACEHOLDER')) {
    printError('❌ يرجى تعديل OPENAI_API_KEY في ملف src/test-full-features.js');
    printInfo('احصل على API Key من: https://platform.openai.com/api-keys');
    process.exit(1);
  }

  // تحميل الإعدادات
  printSubHeader('تحميل الإعدادات');
  const configPath = join(__dirname, '..', 'config', 'config.yaml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  printSuccess('تم تحميل الإعدادات بنجاح');

  // إعداد قاعدة البيانات
  printSubHeader('إعداد قاعدة البيانات التجريبية');
  const db = setupTestDatabase();
  printSuccess('تم إنشاء قاعدة البيانات التجريبية');

  // إنشاء عائلة تجريبية
  const familyId = createTestFamily(db);

  console.log('\n' + '='.repeat(70));
  printInfo('بدء اختبار جميع الخدمات...');
  console.log('='.repeat(70));

  // اختبار جميع الخدمات
  const tests = [
    { name: 'Daily Messages', fn: testDailyMessages },
    { name: 'Child Development', fn: testChildDevelopment },
    { name: 'Monthly Milestone', fn: testMonthlyMilestone },
    { name: 'Weather Service', fn: testWeatherService },
    { name: 'Anniversary Reminders', fn: testAnniversaryReminders },
    { name: 'Motivational Messages', fn: testMotivationalMessages },
    { name: 'Weekend Planner', fn: testWeekendPlanner },
    { name: 'Weekly Report', fn: testWeeklyReport },
    { name: 'Goals Service', fn: testGoalsService }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.fn(db, config, familyId);
      passed++;
    } catch (error) {
      console.error(error);
      failed++;
    }
  }

  // الخلاصة النهائية
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  printHeader('📊 نتائج الاختبار الشامل');

  console.log(colors.bright + 'الإحصائيات:' + colors.reset);
  console.log(`✅ اختبارات نجحت: ${colors.green}${passed}${colors.reset}`);
  console.log(`❌ اختبارات فشلت: ${colors.red}${failed}${colors.reset}`);
  console.log(`📊 إجمالي الاختبارات: ${tests.length}`);
  console.log(`⏱️  المدة: ${duration} ثانية`);

  if (failed === 0) {
    console.log('\n' + colors.bgGreen + colors.bright + ' 🎉 جميع الاختبارات نجحت! ' + colors.reset);
  } else {
    console.log('\n' + colors.bgRed + colors.bright + ' ⚠️  بعض الاختبارات فشلت ' + colors.reset);
  }

  // معلومات قاعدة البيانات
  printSubHeader('معلومات قاعدة البيانات التجريبية');
  const testDbPath = join(__dirname, '..', 'data', 'test_family.db');
  printInfo(`مسار قاعدة البيانات: ${testDbPath}`);
  printInfo('يمكنك فتح هذا الملف باستخدام SQLite Browser لمراجعة البيانات');

  // إغلاق قاعدة البيانات
  db.close();

  console.log('\n' + '='.repeat(70));
  console.log(colors.bright + colors.cyan + '✨ انتهى الاختبار الشامل ✨' + colors.reset);
  console.log('='.repeat(70) + '\n');
}

// تشغيل الاختبار
runFullTest().catch(error => {
  printError('حدث خطأ أثناء تشغيل الاختبار:');
  console.error(error);
  process.exit(1);
});
