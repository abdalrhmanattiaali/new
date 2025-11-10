/**
 * Anniversary Reminder Service
 * خدمة تذكيرات المناسبات (أعياد ميلاد وذكرى زواج)
 *
 * Sends reminders for birthdays and marriage anniversaries
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { OpenAIClient } from '../utils/openaiClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AnniversaryReminderService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');

    // Initialize Claude
    this.claude = new OpenAIClient();
  }

  /**
   * Check and send all anniversary reminders
   */
  async checkAndSendReminders() {
    console.log('🎂 Checking anniversary reminders...');

    const db = new Database(this.dbPath);

    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      // Get all enabled reminders
      const reminders = db.prepare(`
        SELECT ar.*, f.family_name, f.family_group_id, f.send_to_group,
               g.name as guardian_name, g.role as guardian_role
        FROM anniversary_reminders ar
        JOIN families f ON ar.family_id = f.id
        LEFT JOIN guardians g ON ar.guardian_id = g.id
        WHERE ar.enabled = 1
      `).all();

      for (const reminder of reminders) {
        const anniversaryDate = new Date(reminder.anniversary_date);
        const daysUntil = this.getDaysUntilAnniversary(anniversaryDate, today);

        // Check if we should send reminder
        if (daysUntil === reminder.reminder_days_before) {
          // Send advance reminder
          await this.sendAdvanceReminder(reminder, anniversaryDate, db);
        } else if (daysUntil === 0) {
          // Send celebration message
          await this.sendCelebrationMessage(reminder, anniversaryDate, currentYear, db);
        }
      }

      db.close();
      console.log('✅ Anniversary reminders check completed');

    } catch (error) {
      db.close();
      console.error('❌ Error checking anniversary reminders:', error);
    }
  }

  /**
   * Send advance reminder (1 day before)
   */
  async sendAdvanceReminder(reminder, anniversaryDate, db) {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Check if already reminded this year
    if (reminder.last_reminded_year === currentYear) {
      return;
    }

    const tomorrowDate = this.formatArabicDate(anniversaryDate);
    const age = this.calculateUpcomingAge(anniversaryDate, currentYear);

    // Get child name if it's a child birthday
    let childName = null;
    if (reminder.reminder_type === 'birthday_child') {
      const child = db.prepare(`
        SELECT name FROM children
        WHERE family_id = ? AND birth_date = ?
      `).get(reminder.family_id, reminder.anniversary_date);
      childName = child?.name || 'الطفل';
    }

    // Generate AI-powered reminder message
    const message = await this.generateAdvanceReminderMessage(
      reminder.reminder_type,
      reminder.guardian_name || childName,
      tomorrowDate,
      age,
      reminder.family_name
    );

    // Send message
    await this.sendToFamily(reminder.family_group_id, reminder.send_to_group, message);

    // Update last_reminded_year
    db.prepare(`
      UPDATE anniversary_reminders
      SET last_reminded_year = ?
      WHERE id = ?
    `).run(currentYear, reminder.id);

    console.log(`📨 Sent advance reminder: ${reminder.reminder_type} for family ${reminder.family_name}`);
  }

  /**
   * Send celebration message (on the day)
   */
  async sendCelebrationMessage(reminder, anniversaryDate, currentYear, db) {
    // For celebration messages, we don't track last_reminded_year
    // because advance reminders already update it

    const todayDate = this.formatArabicDate(anniversaryDate);
    const age = this.calculateUpcomingAge(anniversaryDate, currentYear);

    // Get child name if it's a child birthday
    let childName = null;
    if (reminder.reminder_type === 'birthday_child') {
      const child = db.prepare(`
        SELECT name FROM children
        WHERE family_id = ? AND birth_date = ?
      `).get(reminder.family_id, reminder.anniversary_date);
      childName = child?.name || 'الطفل';
    }

    // Generate AI-powered celebration message
    const message = await this.generateCelebrationMessage(
      reminder.reminder_type,
      reminder.guardian_name || childName,
      todayDate,
      age,
      reminder.family_name
    );

    // Send message
    await this.sendToFamily(reminder.family_group_id, reminder.send_to_group, message);

    console.log(`🎉 Sent celebration message: ${reminder.reminder_type} for family ${reminder.family_name}`);
  }

  /**
   * Calculate days until anniversary
   */
  getDaysUntilAnniversary(anniversaryDate, today) {
    const currentYear = today.getFullYear();

    // Create this year's anniversary date
    const thisYearAnniversary = new Date(
      currentYear,
      anniversaryDate.getMonth(),
      anniversaryDate.getDate()
    );

    // If this year's anniversary has passed, use next year
    if (thisYearAnniversary < today) {
      thisYearAnniversary.setFullYear(currentYear + 1);
    }

    // Calculate days difference
    const diffTime = thisYearAnniversary - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Calculate upcoming age
   */
  calculateUpcomingAge(birthDate, currentYear) {
    return currentYear - birthDate.getFullYear();
  }

  /**
   * Format date in Arabic
   */
  formatArabicDate(date) {
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    return `${date.getDate()} ${months[date.getMonth()]}`;
  }

  /**
   * Send message to family (group or individuals)
   */
  async sendToFamily(groupId, sendToGroup, message) {
    try {
      if (sendToGroup && groupId) {
        // Send to group
        await this.bot.sendMessage(groupId, message);
      } else {
        // Send to individuals (fallback)
        // Get guardian phone numbers from database
        const db = new Database(this.dbPath);
        const guardians = db.prepare(`
          SELECT phone_number FROM guardians
          WHERE family_id = (
            SELECT id FROM families WHERE family_group_id = ?
          ) AND phone_number IS NOT NULL
        `).all(groupId);
        db.close();

        for (const guardian of guardians) {
          const chatId = guardian.phone_number + '@c.us';
          await this.bot.sendMessage(chatId, message);
        }
      }
    } catch (error) {
      console.error('Error sending anniversary message:', error);
    }
  }

  /**
   * Get upcoming anniversaries (for testing or display)
   */
  getUpcomingAnniversaries(days = 7) {
    const db = new Database(this.dbPath);

    try {
      const today = new Date();
      const reminders = db.prepare(`
        SELECT ar.*, f.family_name, g.name as guardian_name
        FROM anniversary_reminders ar
        JOIN families f ON ar.family_id = f.id
        LEFT JOIN guardians g ON ar.guardian_id = g.id
        WHERE ar.enabled = 1
      `).all();

      const upcoming = reminders
        .map(reminder => {
          const anniversaryDate = new Date(reminder.anniversary_date);
          const daysUntil = this.getDaysUntilAnniversary(anniversaryDate, today);

          return {
            ...reminder,
            daysUntil,
            anniversaryDate
          };
        })
        .filter(reminder => reminder.daysUntil >= 0 && reminder.daysUntil <= days)
        .sort((a, b) => a.daysUntil - b.daysUntil);

      db.close();
      return upcoming;

    } catch (error) {
      db.close();
      throw error;
    }
  }

  /**
   * Manually trigger anniversary check (for testing)
   */
  async testAnniversaryReminders(familyId = null) {
    console.log('🧪 Testing anniversary reminders...');

    const db = new Database(this.dbPath);

    try {
      let query = `
        SELECT ar.*, f.family_name, f.family_group_id, f.send_to_group,
               g.name as guardian_name
        FROM anniversary_reminders ar
        JOIN families f ON ar.family_id = f.id
        LEFT JOIN guardians g ON ar.guardian_id = g.id
        WHERE ar.enabled = 1
      `;

      if (familyId) {
        query += ` AND ar.family_id = ${familyId}`;
      }

      query += ` LIMIT 1`;

      const reminder = db.prepare(query).get();

      if (!reminder) {
        console.log('❌ No reminders found for testing');
        db.close();
        return;
      }

      const anniversaryDate = new Date(reminder.anniversary_date);
      const currentYear = new Date().getFullYear();

      console.log(`📨 Sending test reminder: ${reminder.reminder_type}`);
      await this.sendCelebrationMessage(reminder, anniversaryDate, currentYear, db);

      db.close();
      console.log('✅ Test reminder sent');

    } catch (error) {
      db.close();
      console.error('❌ Error testing anniversary reminders:', error);
    }
  }

  /**
   * Generate advance reminder message using AI
   */
  async generateAdvanceReminderMessage(reminderType, personName, date, age, familyName) {
    const prompts = {
      birthday_father: `أنت مساعد عائلة ذكي. اكتب رسالة تذكير دافئة ومحفزة بعيد ميلاد الأب ${personName} غداً ${date} (سيكمل ${age} سنة).

المطلوب:
- رسالة قصيرة ودافئة (100-150 كلمة)
- ابدأ بـ 🎂 تذكير بعيد ميلاد الأب
- اذكر الاسم والتاريخ والعمر
- 3-4 اقتراحات عملية للاحتفال
- كلمات تحفيزية للعائلة
- استخدم الإيموجيز المناسبة
- بالعربية الفصحى الدافئة

اجعل الرسالة فريدة ومميزة في كل مرة!`,

      birthday_mother: `أنت مساعد عائلة ذكي. اكتب رسالة تذكير دافئة ومحفزة بعيد ميلاد الأم ${personName} غداً ${date} (ستكمل ${age} سنة).

المطلوب:
- رسالة قصيرة ودافئة (100-150 كلمة)
- ابدأ بـ 🎂 تذكير بعيد ميلاد الأم
- اذكر الاسم والتاريخ والعمر
- 3-4 اقتراحات عملية للاحتفال تناسب الأم
- كلمات تحفيزية وتقدير للأم
- استخدم الإيموجيز المناسبة
- بالعربية الفصحى الدافئة

اجعل الرسالة فريدة ومليئة بالحب!`,

      birthday_child: `أنت مساعد عائلة ذكي. اكتب رسالة تذكير مبهجة وحماسية بعيد ميلاد الطفل ${personName} غداً ${date} (سيكمل/ستكمل ${age} سنة).

المطلوب:
- رسالة قصيرة ومبهجة (100-150 كلمة)
- ابدأ بـ 🎂 تذكير بعيد ميلاد الطفل
- اذكر الاسم والتاريخ والعمر
- 3-4 اقتراحات للاحتفال تناسب عمر ${age} سنة
- كلمات حماسية للوالدين
- إيموجيز مرحة
- بالعربية الفصحى المبسطة

اجعل الرسالة مليئة بالفرح والحماس!`,

      marriage_anniversary: `أنت مساعد عائلة ذكي. اكتب رسالة تذكير رومانسية ودافئة بذكرى زواج عائلة ${familyName} غداً ${date} (${age} سنة معاً).

المطلوب:
- رسالة قصيرة ورومانسية (100-150 كلمة)
- ابدأ بـ 💍 تذكير بذكرى الزواج
- اذكر التاريخ وعدد السنين
- 3-4 اقتراحات رومانسية للاحتفال
- كلمات تقدير لرحلتهم معاً
- إيموجيز رومانسية
- بالعربية الفصحى الدافئة

اجعل الرسالة تحتفي بالحب والعائلة!`
    };

    const prompt = prompts[reminderType];
    if (!prompt) {
      throw new Error(`Unknown reminder type: ${reminderType}`);
    }

    try {
      const message = await this.claude.generateText(
        'أنت مساعد عائلة ذكي متخصص في كتابة رسائل دافئة ومحفزة بالعربية.',
        prompt,
        {
          temperature: 0.9,
          maxTokens: 1500  // GPT-5 needs more tokens for reasoning + output
        }
      );

      return message.trim();

    } catch (error) {
      console.error('Error generating advance reminder with AI:', error);
      // Fallback to simple message
      return `🎂 تذكير: غداً ${date} مناسبة خاصة لـ ${personName}! لا تنسوا الاحتفال 🎉`;
    }
  }

  /**
   * Generate celebration message using AI
   */
  async generateCelebrationMessage(reminderType, personName, date, age, familyName) {
    const prompts = {
      birthday_father: `أنت مساعد عائلة ذكي. اكتب رسالة احتفالية مفرحة ودافئة لعيد ميلاد الأب ${personName} اليوم ${date} (${age} سنة).

المطلوب:
- رسالة احتفالية مميزة (120-180 كلمة)
- ابدأ بتهنئة حماسية بالاسم
- اذكر التاريخ والعمر
- كلمات تقدير للأب ودوره
- دعوات طيبة وتمنيات
- إيموجيز احتفالية
- هاشتاق مناسب
- بالعربية الفصحى الدافئة

اجعل الرسالة تنبض بالفرح والامتنان!`,

      birthday_mother: `أنت مساعد عائلة ذكي. اكتب رسالة احتفالية مفرحة ودافئة لعيد ميلاد الأم ${personName} اليوم ${date} (${age} سنة).

المطلوب:
- رسالة احتفالية مميزة (120-180 كلمة)
- ابدأ بتهنئة حماسية بالاسم
- اذكر التاريخ والعمر
- كلمات تقدير للأم وحنانها
- دعوات طيبة وتمنيات
- إيموجيز احتفالية
- هاشتاق مناسب
- بالعربية الفصحى الدافئة

اجعل الرسالة تنبض بالحب والتقدير!`,

      birthday_child: `أنت مساعد عائلة ذكي. اكتب رسالة احتفالية مبهجة وحماسية لعيد ميلاد الطفل ${personName} اليوم ${date} (${age} سنة).

المطلوب:
- رسالة احتفالية مرحة (120-180 كلمة)
- ابدأ بتهنئة حماسية بالاسم
- اذكر التاريخ والعمر
- كلمات فرح وبهجة
- دعوات طيبة للطفل
- إيموجيز مرحة وملونة
- هاشتاق مناسب
- بالعربية الفصحى المبسطة

اجعل الرسالة تنفجر بالفرح والحماس!`,

      marriage_anniversary: `أنت مساعد عائلة ذكي. اكتب رسالة احتفالية رومانسية لذكرى زواج عائلة ${familyName} اليوم ${date} (${age} سنة معاً).

المطلوب:
- رسالة احتفالية رومانسية (120-180 كلمة)
- ابدأ بتهنئة حماسية بذكرى الزواج
- اذكر التاريخ وعدد السنين
- احتفِ برحلتهم وذكرياتهم
- كلمات عن الحب والعائلة
- دعوات بالسعادة الدائمة
- إيموجيز رومانسية
- هاشتاق مناسب
- بالعربية الفصحى الدافئة

اجعل الرسالة تحتفي بالحب والإنجاز المشترك!`
    };

    const prompt = prompts[reminderType];
    if (!prompt) {
      throw new Error(`Unknown reminder type: ${reminderType}`);
    }

    try {
      const message = await this.claude.generateText(
        'أنت مساعد عائلة ذكي متخصص في كتابة رسائل احتفالية دافئة ومميزة بالعربية.',
        prompt,
        {
          temperature: 0.95,
          maxTokens: 1500  // GPT-5 needs more tokens for reasoning + output
        }
      );

      return message.trim();

    } catch (error) {
      console.error('Error generating celebration message with AI:', error);
      // Fallback to simple message
      return `🎊 كل عام و${personName} بخير! 🎉\n\nاليوم ${date}\nيوم مميز ومبارك! 💝`;
    }
  }
}

export default AnniversaryReminderService;
