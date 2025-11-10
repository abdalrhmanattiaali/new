/**
 * AI Services Test - اختبار مباشر لخدمات الذكاء الاصطناعي
 * يعمل بدون WhatsApp Bot لاختبار API Keys والخدمات
 */

// ============================================
// 🔑 API KEYS - ضع مفاتيح API هنا
// ============================================
// ⚠️ IMPORTANT: استبدل بـ API Key الصحيح من OpenAI
global.OPENAI_API_KEY = 'sk-PLACEHOLDER-REPLACE-WITH-YOUR-REAL-OPENAI-KEY';
// احصل على API Key من: https://platform.openai.com/api-keys
// ============================================

import { OpenAIClient } from './utils/openaiClient.js';
import { LLMService } from './ai/llm.js';
import { DailyWeatherService } from './services/dailyWeatherService.js';
import { ChildDevelopmentService } from './services/childDevelopmentService.js';
import { MonthlyMilestoneService } from './services/monthlyMilestoneService.js';
import { getConfigLoader } from './utils/configLoader.js';
import { initDatabase } from './database/init.js';

console.log('\n' + '='.repeat(70));
console.log('🧪 اختبار شامل لخدمات الذكاء الاصطناعي');
console.log('   AI Services Comprehensive Test');
console.log('='.repeat(70) + '\n');

/**
 * Test 1: Claude Client Direct Test
 */
async function testOpenAIClient() {
  console.log('📝 [Test 1/6] اختبار OpenAIClient مباشرة...\n');

  try {
    const openai = new OpenAIClient();
    console.log('   ✅ تم إنشاء OpenAIClient بنجاح');

    const systemPrompt = 'أنت مساعد ودود بالعربية.';
    const userPrompt = 'اكتب جملة ترحيبية قصيرة (سطر واحد فقط)';

    console.log('   🔄 إرسال طلب لـ OpenAI ChatGPT API...');
    const startTime = Date.now();

    const response = await openai.generateText(systemPrompt, userPrompt, {
      maxTokens: 1000,  // GPT-5 needs more tokens for reasoning + output
      temperature: 0.7
    });

    const duration = Date.now() - startTime;

    console.log('   ✅ تم استلام الرد من OpenAI ChatGPT!');
    console.log(`   ⏱️  الوقت: ${duration}ms`);
    console.log(`   📄 الرد: "${response}"\n`);

    return { success: true, duration, response };

  } catch (error) {
    console.error('   ❌ فشل اختبار OpenAIClient:');
    console.error('   📛 الخطأ:', error.message);
    if (error.status) console.error('   📛 Status:', error.status);
    if (error.error) console.error('   📛 Details:', JSON.stringify(error.error, null, 2));
    console.log('');
    return { success: false, error: error.message };
  }
}

/**
 * Test 2: LLM Service Test
 */
async function testLLMService() {
  console.log('📝 [Test 2/6] اختبار LLMService...\n');

  try {
    const configLoader = getConfigLoader();
    const config = configLoader.load();

    const llm = new LLMService(config);
    console.log('   ✅ تم إنشاء LLMService بنجاح');

    console.log('   🔄 توليد رسالة تجريبية...');
    const startTime = Date.now();

    const context = {
      messageType: 'child_play',
      guardianName: 'أحمد',
      childName: 'سارة',
      childAge: 18,
      timeOfDay: 'morning',
      additionalContext: 'اختبار'
    };

    const message = await llm.generateMessage(context);
    const duration = Date.now() - startTime;

    console.log('   ✅ تم توليد الرسالة!');
    console.log(`   ⏱️  الوقت: ${duration}ms`);
    console.log(`   📄 الرسالة (أول 200 حرف):\n   "${message.substring(0, 200)}..."\n`);

    return { success: true, duration, messageLength: message.length };

  } catch (error) {
    console.error('   ❌ فشل اختبار LLMService:');
    console.error('   📛 الخطأ:', error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

/**
 * Test 3: Weather Service Test
 */
async function testWeatherService() {
  console.log('📝 [Test 3/6] اختبار خدمة الطقس (Open-Meteo API)...\n');

  try {
    const configLoader = getConfigLoader();
    const config = configLoader.load();

    const weatherService = new DailyWeatherService(null, config);
    console.log('   ✅ تم إنشاء DailyWeatherService بنجاح');

    console.log('   🔄 جلب بيانات الطقس من Open-Meteo...');
    const startTime = Date.now();

    const weatherData = await weatherService.getWeatherData();
    const duration = Date.now() - startTime;

    if (!weatherData) {
      throw new Error('فشل في جلب بيانات الطقس');
    }

    console.log('   ✅ تم جلب بيانات الطقس!');
    console.log(`   ⏱️  الوقت: ${duration}ms`);
    console.log('   📊 البيانات:');
    console.log(`      🌡️  درجة الحرارة: ${weatherData.temperature}°م`);
    console.log(`      💧 الرطوبة: ${weatherData.humidity}%`);
    console.log(`      🌬️  الرياح: ${weatherData.windSpeed} كم/س (${weatherData.windDirection})`);
    console.log(`      ☁️  الغيوم: ${weatherData.clouds}%`);
    console.log(`      🌧️  احتمال مطر: ${weatherData.rainProbability}%`);
    console.log(`      ☀️  UV: ${weatherData.uvIndex}`);
    console.log(`      📝 الوصف: ${weatherData.description}`);

    console.log('\n   🔄 توليد رسالة طقس بالذكاء الاصطناعي...');
    const msgStartTime = Date.now();

    const weatherMessage = await weatherService.generateWeatherMessage(weatherData);
    const msgDuration = Date.now() - msgStartTime;

    console.log('   ✅ تم توليد رسالة الطقس!');
    console.log(`   ⏱️  الوقت: ${msgDuration}ms`);
    console.log(`   📄 الرسالة (أول 300 حرف):\n   "${weatherMessage.substring(0, 300)}..."\n`);

    return {
      success: true,
      duration,
      msgDuration,
      weatherData,
      messageLength: weatherMessage.length
    };

  } catch (error) {
    console.error('   ❌ فشل اختبار خدمة الطقس:');
    console.error('   📛 الخطأ:', error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

/**
 * Test 4: Child Development Service Test
 */
async function testChildDevelopment() {
  console.log('📝 [Test 4/6] اختبار خدمة تطوير الطفل...\n');

  try {
    const configLoader = getConfigLoader();
    const config = configLoader.load();

    const devService = new ChildDevelopmentService(null, config);
    console.log('   ✅ تم إنشاء ChildDevelopmentService بنجاح');

    // Test age calculation
    const birthDate = new Date();
    birthDate.setMonth(birthDate.getMonth() - 8); // 8 months old

    const ageInMonths = devService.calculateAgeInMonths(birthDate.toISOString().split('T')[0]);
    console.log(`   📅 عمر الطفل المحسوب: ${ageInMonths} شهر`);

    // Test stage info
    const stageInfo = devService.getDevelopmentStageInfo(ageInMonths);
    console.log(`   📚 المرحلة: ${stageInfo.stageName}`);

    console.log('\n   🔄 توليد رسالة تطوير يومية...');
    const startTime = Date.now();

    const message = await devService.generateDevelopmentMessage('سارة', ageInMonths, 'عائلة أحمد');
    const duration = Date.now() - startTime;

    console.log('   ✅ تم توليد رسالة التطوير!');
    console.log(`   ⏱️  الوقت: ${duration}ms`);
    console.log(`   📄 الرسالة (أول 300 حرف):\n   "${message.substring(0, 300)}..."\n`);

    return { success: true, duration, ageInMonths, messageLength: message.length };

  } catch (error) {
    console.error('   ❌ فشل اختبار خدمة تطوير الطفل:');
    console.error('   📛 الخطأ:', error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

/**
 * Test 5: Monthly Milestone Service Test
 */
async function testMonthlyMilestone() {
  console.log('📝 [Test 5/6] اختبار خدمة المعالم الشهرية...\n');

  try {
    const configLoader = getConfigLoader();
    const config = configLoader.load();

    const milestoneService = new MonthlyMilestoneService(null, config);
    console.log('   ✅ تم إنشاء MonthlyMilestoneService بنجاح');

    console.log('   🔄 توليد رسالة معلم شهري...');
    const startTime = Date.now();

    const birthDate = new Date();
    birthDate.setMonth(birthDate.getMonth() - 12); // 12 months = 1 year

    const message = await milestoneService.generateMonthlyMilestoneMessage(
      'خالد',
      12,
      birthDate.toISOString().split('T')[0]
    );

    const duration = Date.now() - startTime;

    console.log('   ✅ تم توليد رسالة المعلم!');
    console.log(`   ⏱️  الوقت: ${duration}ms`);
    console.log(`   📄 الرسالة (أول 300 حرف):\n   "${message.substring(0, 300)}..."\n`);

    return { success: true, duration, messageLength: message.length };

  } catch (error) {
    console.error('   ❌ فشل اختبار خدمة المعالم الشهرية:');
    console.error('   📛 الخطأ:', error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

/**
 * Test 6: Performance Test
 */
async function testPerformance() {
  console.log('📝 [Test 6/6] اختبار الأداء (5 طلبات متتالية)...\n');

  try {
    const openai = new OpenAIClient();
    const times = [];

    console.log('   🔄 إرسال 5 طلبات...');

    for (let i = 1; i <= 5; i++) {
      const startTime = Date.now();

      await openai.generateText(
        'أنت مساعد عائلي.',
        `اكتب نصيحة قصيرة رقم ${i} عن تربية الأطفال (سطر واحد)`,
        { maxTokens: 500 }  // GPT-5 needs more tokens even for short responses
      );

      const duration = Date.now() - startTime;
      times.push(duration);

      console.log(`   ${i}/5 ✅ ${duration}ms`);
    }

    const avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log('\n   📊 نتائج الأداء:');
    console.log(`      ⚡ أسرع: ${minTime}ms`);
    console.log(`      🐢 أبطأ: ${maxTime}ms`);
    console.log(`      📈 المتوسط: ${avgTime}ms\n`);

    return { success: true, avgTime, minTime, maxTime };

  } catch (error) {
    console.error('   ❌ فشل اختبار الأداء:');
    console.error('   📛 الخطأ:', error.message);
    console.log('');
    return { success: false, error: error.message };
  }
}

/**
 * Main Test Runner
 */
async function runAllTests() {
  const results = {
    tests: [],
    passed: 0,
    failed: 0,
    startTime: Date.now()
  };

  // Initialize database
  console.log('📊 تهيئة قاعدة البيانات...\n');
  initDatabase();

  // Run all tests
  const tests = [
    { name: 'OpenAIClient', fn: testOpenAIClient },
    { name: 'LLMService', fn: testLLMService },
    { name: 'WeatherService', fn: testWeatherService },
    { name: 'ChildDevelopment', fn: testChildDevelopment },
    { name: 'MonthlyMilestone', fn: testMonthlyMilestone },
    { name: 'Performance', fn: testPerformance }
  ];

  for (const test of tests) {
    const result = await test.fn();
    results.tests.push({ name: test.name, ...result });

    if (result.success) {
      results.passed++;
    } else {
      results.failed++;
    }
  }

  results.totalTime = Date.now() - results.startTime;

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

/**
 * Print Test Summary
 */
function printSummary(results) {
  console.log('='.repeat(70));
  console.log('📊 ملخص الاختبارات - Test Summary');
  console.log('='.repeat(70));

  results.tests.forEach((test, i) => {
    const status = test.success ? '✅' : '❌';
    const duration = test.duration ? ` (${test.duration}ms)` : '';
    console.log(`${status} [${i + 1}/6] ${test.name}${duration}`);

    if (!test.success) {
      console.log(`   ❌ Error: ${test.error}`);
    }
  });

  console.log('='.repeat(70));
  console.log(`✅ نجح: ${results.passed}/${results.tests.length}`);
  console.log(`❌ فشل: ${results.failed}/${results.tests.length}`);
  console.log(`⏱️  الوقت الكلي: ${results.totalTime}ms`);
  console.log('='.repeat(70));

  if (results.failed === 0) {
    console.log('\n🎉 تهانينا! جميع الاختبارات نجحت!');
    console.log('✅ الذكاء الاصطناعي يعمل بشكل صحيح');
    console.log('✅ خدمة الطقس تعمل بشكل صحيح');
    console.log('✅ جميع الخدمات متكاملة ومتصلة\n');
  } else {
    console.log('\n⚠️  بعض الاختبارات فشلت. يرجى مراجعة الأخطاء أعلاه.\n');
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('\n❌ خطأ فادح في تشغيل الاختبارات:', error);
  process.exit(1);
});
