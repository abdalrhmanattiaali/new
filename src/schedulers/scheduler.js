/**
 * Scheduler Service
 * خدمة الجدولة التلقائية
 */

import cron from 'node-cron';
import { MessageEngine } from '../services/messageEngine.js';
import { WeekendPlannerService } from '../services/weekendPlanner.js';
import { WeeklyReportService } from '../services/weeklyReport.js';

export class Scheduler {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.messageEngine = new MessageEngine(bot, config);
    this.weekendPlanner = new WeekendPlannerService(bot, config);
    this.weeklyReport = new WeeklyReportService(bot, config);
    this.jobs = [];
  }

  /**
   * Initialize all scheduled jobs
   */
  initialize() {
    console.log('⏰ Initializing schedulers...');

    // Daily message generation (every day at 6:00 AM)
    this.scheduleJob(
      '0 6 * * *',
      'Daily Message Generation',
      () => this.messageEngine.generateDailyMessages()
    );

    // Send pending messages (every minute)
    this.scheduleJob(
      '* * * * *',
      'Send Pending Messages',
      () => this.messageEngine.sendPendingMessages()
    );

    // Generate weekend plans (every Wednesday at 6:00 PM)
    this.scheduleJob(
      '0 18 * * 3',
      'Generate Weekend Plans',
      () => this.weekendPlanner.generateWeekendPlans()
    );

    // Send weekend plans (every Thursday at 6:30 PM)
    const weekendConfig = this.config.weekend?.send;
    const weekendTime = weekendConfig?.time || '18:30';
    const [wHour, wMinute] = weekendTime.split(':');

    this.scheduleJob(
      `${wMinute} ${wHour} * * 4`,
      'Send Weekend Plans',
      () => this.weekendPlanner.sendWeekendPlans()
    );

    // Generate and send weekly reports (every Friday at 9:00 AM)
    const reportConfig = this.config.reports?.weekly;
    const reportTime = reportConfig?.send_time || '09:00';
    const [rHour, rMinute] = reportTime.split(':');

    this.scheduleJob(
      `${rMinute} ${rHour} * * 5`,
      'Weekly Reports',
      () => this.weeklyReport.generateAndSendReports()
    );

    // Clean up old scheduled messages (every day at 3:00 AM)
    this.scheduleJob(
      '0 3 * * *',
      'Cleanup Old Messages',
      () => this.cleanupOldMessages()
    );

    console.log(`✅ ${this.jobs.length} scheduled jobs initialized`);
  }

  /**
   * Schedule a job
   */
  scheduleJob(cronExpression, name, task) {
    try {
      const job = cron.schedule(cronExpression, async () => {
        console.log(`🔄 Running scheduled job: ${name}`);
        try {
          await task();
          console.log(`✅ Completed: ${name}`);
        } catch (error) {
          console.error(`❌ Error in ${name}:`, error);
        }
      });

      this.jobs.push({ name, cronExpression, job });
      console.log(`✅ Scheduled: ${name} (${cronExpression})`);
    } catch (error) {
      console.error(`❌ Error scheduling ${name}:`, error);
    }
  }

  /**
   * Cleanup old scheduled messages
   */
  async cleanupOldMessages() {
    const { ScheduledMessageModel } = await import('../database/models.js');
    const deleted = ScheduledMessageModel.deleteOld(30);
    console.log(`🗑️ Cleaned up ${deleted.changes} old messages`);
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    console.log('🛑 Stopping all scheduled jobs...');
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`🛑 Stopped: ${name}`);
    });
  }

  /**
   * List all scheduled jobs
   */
  listJobs() {
    console.log('\n📋 Scheduled Jobs:');
    this.jobs.forEach(({ name, cronExpression }, index) => {
      console.log(`${index + 1}. ${name} - ${cronExpression}`);
    });
    console.log('');
  }

  /**
   * Run a job manually by name
   */
  async runJobManually(jobName) {
    const job = this.jobs.find(j => j.name === jobName);
    if (!job) {
      console.error(`❌ Job not found: ${jobName}`);
      return;
    }

    console.log(`🔄 Running job manually: ${jobName}`);
    // Jobs are scheduled with cron, so we need to extract the task
    // For now, we'll run the appropriate method directly
    switch (jobName) {
      case 'Daily Message Generation':
        await this.messageEngine.generateDailyMessages();
        break;
      case 'Send Pending Messages':
        await this.messageEngine.sendPendingMessages();
        break;
      case 'Generate Weekend Plans':
        await this.weekendPlanner.generateWeekendPlans();
        break;
      case 'Send Weekend Plans':
        await this.weekendPlanner.sendWeekendPlans();
        break;
      case 'Weekly Reports':
        await this.weeklyReport.generateAndSendReports();
        break;
      default:
        console.error(`❌ Unknown job: ${jobName}`);
    }
  }
}

export default Scheduler;
