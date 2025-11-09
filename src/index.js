/**
 * WhatsApp Family AI Assistant - Main Entry Point
 * مساعد واتساب العائلي الذكي - نقطة الدخول الرئيسية
 */

// ============================================
// 🔑 API KEYS - ضع مفاتيح API هنا
// ============================================
// ⚠️ IMPORTANT: استبدل بـ API Key الصحيح من OpenAI
global.OPENAI_API_KEY = 'sk-PLACEHOLDER-REPLACE-WITH-YOUR-REAL-OPENAI-KEY';
// احصل على API Key من: https://platform.openai.com/api-keys
// ============================================

import { WhatsAppBot } from './bot/whatsapp.js';
import { MessageHandler } from './handlers/messageHandler.js';
import { Scheduler } from './schedulers/scheduler.js';
import { getConfigLoader } from './utils/configLoader.js';
import { initDatabase } from './database/init.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class FamilyAssistant {
  constructor() {
    this.configLoader = null;
    this.config = null;
    this.bot = null;
    this.messageHandler = null;
    this.scheduler = null;
  }

  /**
   * Initialize the application
   */
  async initialize() {
    try {
      console.log('🚀 Starting WhatsApp Family AI Assistant...\n');

      // Load configuration
      console.log('📋 Loading configuration...');
      this.configLoader = getConfigLoader();
      this.config = this.configLoader.load();
      this.configLoader.validate();

      // Start watching for config changes
      this.configLoader.startWatching();
      this.configLoader.on('reload', (changes) => {
        console.log('🔄 Configuration reloaded, applying changes...');
        this.handleConfigReload(changes);
      });

      // Initialize database
      console.log('\n📚 Initializing database...');
      initDatabase();

      // Initialize WhatsApp bot
      console.log('\n🤖 Initializing WhatsApp bot...');
      this.bot = new WhatsAppBot();

      // Initialize message handler
      this.messageHandler = new MessageHandler(this.bot, this.config);

      // Register message handler
      this.bot.registerMessageHandler('main', (message) => {
        this.messageHandler.handle(message);
      });

      // Initialize bot
      await this.bot.initialize();

      // Wait for bot to be ready
      await this.waitForBot();

      // Initialize scheduler
      console.log('\n⏰ Initializing scheduler...');
      this.scheduler = new Scheduler(this.bot, this.config);
      this.scheduler.initialize();

      console.log('\n✅ Family Assistant is ready!');
      console.log('📱 Waiting for messages...\n');

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Initialization failed:', error);
      process.exit(1);
    }
  }

  /**
   * Wait for bot to be ready
   */
  async waitForBot() {
    return new Promise((resolve) => {
      if (this.bot.isReady) {
        resolve();
      } else {
        this.bot.once('ready', resolve);
      }
    });
  }

  /**
   * Handle configuration reload
   */
  handleConfigReload(changes) {
    // Update config reference
    this.config = changes.new;

    // Recreate scheduler if scheduling config changed
    const scheduleChanged = changes.old.tracks !== changes.new.tracks ||
                           changes.old.weekend !== changes.new.weekend ||
                           changes.old.reports !== changes.new.reports;

    if (scheduleChanged) {
      console.log('🔄 Restarting scheduler with new configuration...');
      if (this.scheduler) {
        this.scheduler.stopAll();
      }
      this.scheduler = new Scheduler(this.bot, this.config);
      this.scheduler.initialize();
    }

    // Recreate message handler if UI config changed
    const uiChanged = changes.old.ui !== changes.new.ui ||
                     changes.old.ai !== changes.new.ai;

    if (uiChanged) {
      console.log('🔄 Updating message handler with new configuration...');
      this.messageHandler = new MessageHandler(this.bot, this.config);
      this.bot.unregisterMessageHandler('main');
      this.bot.registerMessageHandler('main', (message) => {
        this.messageHandler.handle(message);
      });
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);

      try {
        // Stop scheduler
        if (this.scheduler) {
          this.scheduler.stopAll();
        }

        // Stop config watcher
        if (this.configLoader) {
          this.configLoader.stopWatching();
        }

        // Destroy bot
        if (this.bot) {
          await this.bot.destroy();
        }

        console.log('✅ Shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    });
  }

  /**
   * Get application status
   */
  getStatus() {
    return {
      botReady: this.bot?.isReady || false,
      configLoaded: this.config !== null,
      schedulerActive: this.scheduler?.jobs.length > 0
    };
  }
}

// Create and start the application
const app = new FamilyAssistant();
app.initialize().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

// Export for testing
export default FamilyAssistant;
