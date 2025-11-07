/**
 * Test Runner
 * مشغّل الاختبارات
 */

import { WhatsAppBot } from './bot/whatsapp.js';
import { TestPanel } from './utils/testPanel.js';
import { getConfigLoader } from './utils/configLoader.js';
import { initDatabase } from './database/init.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTests() {
  try {
    console.log('\n🚀 تهيئة بيئة الاختبار...\n');

    // Load configuration
    const configLoader = getConfigLoader();
    const config = configLoader.load();

    // Initialize database
    initDatabase();

    // Initialize WhatsApp bot
    const bot = new WhatsAppBot();
    await bot.initialize();

    // Wait for bot to be ready
    console.log('⏳ انتظار جاهزية البوت...\n');
    await waitForBot(bot);

    // Create test panel
    const testPanel = new TestPanel(bot, config);

    // Get command from arguments
    const args = process.argv.slice(2);
    const command = args[0];
    const params = args.slice(1);

    // Run test
    await testPanel.run(command, ...params);

    // Cleanup
    await bot.destroy();
    process.exit(0);

  } catch (error) {
    console.error('❌ خطأ في تشغيل الاختبارات:', error);
    process.exit(1);
  }
}

function waitForBot(bot) {
  return new Promise((resolve) => {
    if (bot.isReady) {
      resolve();
    } else {
      bot.once('ready', resolve);
    }
  });
}

// Run tests
runTests();
