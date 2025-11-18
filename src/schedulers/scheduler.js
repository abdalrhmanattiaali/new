/**
 * Scheduler Service
 * خدمة الجدولة التلقائية
 */

import cron from 'node-cron';
import { MessageEngine } from '../services/messageEngine.js';
import { WeekendPlannerService } from '../services/weekendPlanner.js';
import { WeeklyReportService } from '../services/weeklyReport.js';
import { MotivationalService } from '../services/motivationalService.js';
import { JourneyService } from '../services/journeyService.js';
import { GoalsService } from '../services/goalsService.js';
import { DailyMessageService } from '../services/dailyMessageService.js';
import { AnniversaryReminderService } from '../services/anniversaryReminderService.js';
import { ChildDevelopmentService } from '../services/childDevelopmentService.js';
import { MonthlyMilestoneService } from '../services/monthlyMilestoneService.js';
import { DailyWeatherService } from '../services/dailyWeatherService.js';
import { ChildIssueTrackingService } from '../services/childIssueTrackingService.js';
import { AudioStoryService } from '../services/audioStoryService.js';
import { SpiritualRoutineService } from '../services/spiritualRoutineService.js';
import { ParentResourceService } from '../services/parentResourceService.js';
import { WeeklyMilestoneCheckpointService } from '../services/weeklyMilestoneCheckpointService.js';
import { CoupleInsightService } from '../services/coupleInsightService.js';

export class Scheduler {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.messageEngine = new MessageEngine(bot, config);
    this.weekendPlanner = new WeekendPlannerService(bot, config);
    this.weeklyReport = new WeeklyReportService(bot, config);
    this.motivational = new MotivationalService(bot, config);
    this.journey = new JourneyService(bot, config);
    this.goals = new GoalsService(bot, config);
    this.dailyMessages = new DailyMessageService(bot, config);
    this.anniversaryReminder = new AnniversaryReminderService(bot, config);
    this.childDevelopment = new ChildDevelopmentService(bot, config);
    this.monthlyMilestone = new MonthlyMilestoneService(bot, config);
    this.dailyWeather = new DailyWeatherService(bot, config);
    this.issueTracking = new ChildIssueTrackingService(bot, config);
    this.audioStories = null;
    this.spiritualRoutine = null;
    this.parentResources = new ParentResourceService(bot, config);
    this.weeklyMilestones = new WeeklyMilestoneCheckpointService(bot, config);
    this.coupleInsights = null;
    this.jobs = [];
  }

  /**
   * Initialize all scheduled jobs
   */
  initialize() {
    console.log('⏰ Initializing schedulers...');

    // === رسائل يومية متنوعة ===

    // توليد الرسائل اليومية المتنوعة (كل يوم الساعة 5:00 صباحاً)
    this.scheduleJob(
      '0 5 * * *',
      'Generate Diverse Daily Messages',
      () => this.dailyMessages.generateAllDailyMessages()
    );

    // Send pending messages (every minute)
    this.scheduleJob(
      '* * * * *',
      'Send Pending Messages',
      () => this.messageEngine.sendPendingMessages()
    );

    const generateConfig = this.config.weekend?.generate || {};
    const generateDay = this.getDayNumber(generateConfig.day, 3);
    const generateTime = generateConfig.time || '18:00';
    const [gHour, gMinute] = generateTime.split(':');

    this.scheduleJob(
      `${gMinute} ${gHour} * * ${generateDay}`,
      'Generate Weekend Plans',
      () => this.weekendPlanner.generateWeekendPlans()
    );

    const weekendConfig = this.config.weekend?.send || {};
    const weekendDay = this.getDayNumber(weekendConfig.day, 4);
    const weekendTime = weekendConfig.time || '18:30';
    const [wHour, wMinute] = weekendTime.split(':');

    this.scheduleJob(
      `${wMinute} ${wHour} * * ${weekendDay}`,
      'Send Weekend Plans',
      () => this.weekendPlanner.sendWeekendPlans()
    );

    const previewConfig = this.config.weekend?.preview;
    if (!previewConfig || previewConfig.enabled !== false) {
      const previewDay = this.getDayNumber(previewConfig?.day, 3);
      const previewTime = previewConfig?.time || '12:30';
      const [pHour, pMinute] = previewTime.split(':');

      this.scheduleJob(
        `${pMinute} ${pHour} * * ${previewDay}`,
        'Weekend Preview',
        () => this.weekendPlanner.sendWeekendPreview()
      );
    }

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

    // === Journey & Goals Features ===

    // Send daily motivational messages (every day at 7:00 AM)
    this.scheduleJob(
      '0 7 * * *',
      'Daily Motivational Messages',
      () => this.motivational.sendDailyMotivationToAllFamilies()
    );

    // Send parenting tips (every 2 days at 2:00 PM)
    this.scheduleJob(
      '0 14 */2 * *',
      'Parenting Tips',
      () => this.motivational.sendParentingTipsToAllFamilies()
    );

    // Check milestones and send updates (every Sunday at 8:00 AM)
    this.scheduleJob(
      '0 8 * * 0',
      'Milestone Checks',
      () => this.journey.checkAndSuggestMilestones()
    );

    // Send goal reminders (every Monday at 9:00 AM)
    this.scheduleJob(
      '0 9 * * 1',
      'Goal Reminders',
      () => this.goals.sendGoalReminders()
    );

    // Monthly goal progress check (1st day of month at 10:00 AM)
    this.scheduleJob(
      '0 10 1 * *',
      'Monthly Goal Review',
      () => this.goals.sendMonthlyGoalReview()
    );

    // Suggest toy recommendations (every 3 weeks on Saturday at 3:00 PM)
    this.scheduleJob(
      '0 15 * * 6',
      'Toy Recommendations',
      () => this.journey.sendToyRecommendations()
    );

    const birthdaySettings = this.config.celebrations?.birthdays || {};
    const marriageSettings = this.config.celebrations?.marriage || {};
    const birthdaysDisabled = birthdaySettings.enabled === false;
    const marriageDisabled = marriageSettings.enabled === false;

    if (!(birthdaysDisabled && marriageDisabled)) {
      const checkTime = birthdaySettings.check_time || '06:00';
      const [aHour, aMinute] = checkTime.split(':');

      this.scheduleJob(
        `${aMinute} ${aHour} * * *`,
        'Anniversary Reminders',
        () => this.anniversaryReminder.checkAndSendReminders()
      );
    }

    // Send daily child development messages (every day at 8:00 AM)
    this.scheduleJob(
      '0 8 * * *',
      'Child Development Messages',
      () => this.childDevelopment.sendDailyDevelopmentMessages()
    );

    if (this.config.celebrations?.child_monthly?.enabled !== false) {
      const monthlyTime = this.config.celebrations?.child_monthly?.check_time || '07:00';
      const [mHour, mMinute] = monthlyTime.split(':');

      this.scheduleJob(
        `${mMinute} ${mHour} * * *`,
        'Monthly Milestone Reminders',
        () => this.monthlyMilestone.checkAndSendMonthlyReminders()
      );
    }

    if (this.config.celebrations?.weekly_checkpoint?.enabled !== false) {
      const weeklyConfig = this.config.celebrations?.weekly_checkpoint || {};
      const weeklyDay = this.getDayNumber(weeklyConfig.day, 4);
      const weeklyTime = weeklyConfig.time || '20:30';
      const [wkHour, wkMinute] = weeklyTime.split(':');

      this.scheduleJob(
        `${wkMinute} ${wkHour} * * ${weeklyDay}`,
        'Weekly Milestone Checkpoint',
        () => this.weeklyMilestones.sendWeeklyCheckpoints()
      );
    }

    // Send daily weather updates (every day at 9:00 AM)
    this.scheduleJob(
      '0 9 * * *',
      'Daily Weather Updates',
      () => this.dailyWeather.sendDailyWeatherUpdates()
    );

    // === القصص الصوتية قبل النوم ===
    if (this.config.audio_stories?.enabled !== false) {
      this.audioStories = new AudioStoryService(this.bot, this.config);
      const storyTime = this.config.audio_stories?.send_time || '22:00';
      const [storyHour, storyMinute] = storyTime.split(':');

      this.scheduleJob(
        `${storyMinute} ${storyHour} * * *`,
        'Bedtime Audio Stories',
        () => this.audioStories.sendDailyAudioStories()
      );
    }

    // === الأذكار والروتين الروحاني ===
    if (this.config.spiritual_routines?.enabled !== false) {
      this.spiritualRoutine = new SpiritualRoutineService(this.bot, this.config);
      const seedTime = this.config.spiritual_routines?.schedule_seed_time || '06:10';
      const [seedHour, seedMinute] = seedTime.split(':');

      this.scheduleJob(
        `${seedMinute} ${seedHour} * * *`,
        'Schedule Spiritual Routines',
        () => this.spiritualRoutine.scheduleDailyRoutines()
      );

      // Run once on startup to cover اليوم الحالي
      this.spiritualRoutine
        .scheduleDailyRoutines()
        .catch((error) => console.error('❌ Failed to schedule spiritual routines:', error));
    }

    // === متابعة المشاكل الصحية للأطفال ===

    // Initialize issue tracking service
    this.issueTracking.initialize();

    // Ask families about child issues (every day at 11:00 PM)
    this.scheduleJob(
      '0 23 * * *',
      'Daily Child Issue Check',
      () => this.issueTracking.sendDailyIssueCheck()
    );

    // Send issue reminders (spread throughout the day: 9 AM, 3 PM, 8 PM)
    this.scheduleJob(
      '0 9 * * *',
      'Issue Reminders - Morning',
      () => this.issueTracking.sendDailyReminders()
    );

    this.scheduleJob(
      '0 15 * * *',
      'Issue Reminders - Afternoon',
      () => this.issueTracking.sendDailyReminders()
    );

    this.scheduleJob(
      '0 20 * * *',
      'Issue Reminders - Evening',
      () => this.issueTracking.sendDailyReminders()
    );

    if (this.config.parent_resources?.enabled !== false) {
      const bookCheck = this.config.parent_resources?.books?.check_time || '09:15';
      const [bHour, bMinute] = bookCheck.split(':');
      this.scheduleJob(
        `${bMinute} ${bHour} * * *`,
        'Parent Book Recommendations',
        () => this.parentResources.sendBookRecommendationsIfDue()
      );

      const courseConfig = this.config.parent_resources?.courses || {};
      const courseDay = this.getDayNumber(courseConfig.day, 0);
      const courseTime = courseConfig.time || '21:00';
      const [cHour, cMinute] = courseTime.split(':');
      this.scheduleJob(
        `${cMinute} ${cHour} * * ${courseDay}`,
        'Parent Course Recommendations',
        () => this.parentResources.sendWeeklyCourseRecommendations()
      );
    }

    if (this.config.couple_feedback?.enabled !== false) {
      this.coupleInsights = new CoupleInsightService(this.bot, this.config);
      const prompts = this.config.couple_feedback?.prompts?.length
        ? this.config.couple_feedback.prompts
        : [
            { id: 'midweek_checkin', day: 'wed', time: '21:00', focus: 'checkin' }
          ];

      prompts.forEach((prompt, index) => {
        const focus = prompt.focus || 'checkin';
        const defaultDay = focus === 'gratitude' ? 5 : 3;
        const cronDay = this.getDayNumber(prompt.day, defaultDay);
        const sendTime = prompt.time || (focus === 'gratitude' ? '11:00' : '21:00');
        const [hour, minute] = sendTime.split(':');
        this.scheduleJob(
          `${minute} ${hour} * * ${cronDay}`,
          `Couple Feedback (${focus}) #${index + 1}`,
          () => this.coupleInsights.sendPrompts(focus)
        );
      });
    }

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

  getDayNumber(day, fallback = 0) {
    if (typeof day === 'number') return day;
    const map = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6
    };
    if (typeof day === 'string') {
      const key = day.slice(0, 3).toLowerCase();
      if (key in map) return map[key];
    }
    return fallback;
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
      case 'Generate Diverse Daily Messages':
        await this.dailyMessages.generateAllDailyMessages();
        break;
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
      case 'Weekend Preview':
        await this.weekendPlanner.sendWeekendPreview();
        break;
      case 'Weekly Reports':
        await this.weeklyReport.generateAndSendReports();
        break;
      case 'Daily Motivational Messages':
        await this.motivational.sendDailyMotivationToAllFamilies();
        break;
      case 'Parenting Tips':
        await this.motivational.sendParentingTipsToAllFamilies();
        break;
      case 'Milestone Checks':
        await this.journey.checkAndSuggestMilestones();
        break;
      case 'Goal Reminders':
        await this.goals.sendGoalReminders();
        break;
      case 'Monthly Goal Review':
        await this.goals.sendMonthlyGoalReview();
        break;
      case 'Toy Recommendations':
        await this.journey.sendToyRecommendations();
        break;
      case 'Anniversary Reminders':
        await this.anniversaryReminder.checkAndSendReminders();
        break;
      case 'Child Development Messages':
        await this.childDevelopment.sendDailyDevelopmentMessages();
        break;
      case 'Monthly Milestone Reminders':
        await this.monthlyMilestone.checkAndSendMonthlyReminders();
        break;
      case 'Daily Weather Updates':
        await this.dailyWeather.sendDailyWeatherUpdates();
        break;
      case 'Parent Book Recommendations':
        await this.parentResources.sendBookRecommendationsIfDue();
        break;
      case 'Parent Course Recommendations':
        await this.parentResources.sendWeeklyCourseRecommendations();
        break;
      default:
        console.error(`❌ Unknown job: ${jobName}`);
    }
  }
}

export default Scheduler;
