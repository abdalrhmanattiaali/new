/**
 * Anniversary Reminder Service
 * خدمة تذكيرات المناسبات (أعياد ميلاد وذكرى زواج)
 *
 * Sends reminders for birthdays and marriage anniversaries
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class AnniversaryReminderService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');
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

    let message = '';
    const tomorrowDate = this.formatArabicDate(anniversaryDate);

    switch (reminder.reminder_type) {
      case 'birthday_father':
        const fatherAge = this.calculateUpcomingAge(anniversaryDate, currentYear);
        message = `
🎂 *تذكير بعيد ميلاد الأب*

غداً ${tomorrowDate} عيد ميلاد الأب *${reminder.guardian_name}* 🎉

سيكمل *${fatherAge} سنة* 🎈

💡 *اقتراحات للاحتفال:*
• تحضير هدية مفاجئة
• كعكة عيد ميلاد مع الأطفال
• قضاء وقت ممتع معاً

لا تنسوا أن تجعلوا يومه مميزاً! 💙
        `.trim();
        break;

      case 'birthday_mother':
        const motherAge = this.calculateUpcomingAge(anniversaryDate, currentYear);
        message = `
🎂 *تذكير بعيد ميلاد الأم*

غداً ${tomorrowDate} عيد ميلاد الأم *${reminder.guardian_name}* 🎉

ستكمل *${motherAge} سنة* 🎈

💡 *اقتراحات للاحتفال:*
• هدية خاصة من القلب
• كعكة عيد ميلاد مع الأطفال
• يوم راحة تستحقه

اجعلوا يومها استثنائياً! 💝
        `.trim();
        break;

      case 'birthday_child':
        // Get child info
        const child = db.prepare(`
          SELECT name FROM children
          WHERE family_id = ? AND birth_date = ?
        `).get(reminder.family_id, reminder.anniversary_date);

        const childAge = this.calculateUpcomingAge(anniversaryDate, currentYear);
        message = `
🎂 *تذكير بعيد ميلاد الطفل*

غداً ${tomorrowDate} عيد ميلاد *${child?.name || 'الطفل'}* 🎉

سيكمل/ستكمل *${childAge} سنة* 🎈

💡 *اقتراحات للاحتفال:*
• حفلة عيد ميلاد صغيرة
• كعكة وبالونات
• هدايا وألعاب جديدة
• دعوة الأصدقاء والعائلة

اجعلوا يومه/يومها لا يُنسى! 🎊
        `.trim();
        break;

      case 'marriage_anniversary':
        const yearsMarried = currentYear - anniversaryDate.getFullYear();
        message = `
💍 *تذكير بذكرى الزواج*

غداً ${tomorrowDate} ذكرى زواجكم السعيد! 🎊

ستكملون *${yearsMarried} سنة* معاً 💕

💡 *اقتراحات للاحتفال:*
• عشاء رومانسي خاص
• نزهة عائلية
• تبادل الهدايا
• إعادة النظر في صور الزفاف

احتفلوا بحبكم ورحلتكم المشتركة! 🌹
        `.trim();
        break;

      default:
        return;
    }

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

    let message = '';
    const todayDate = this.formatArabicDate(anniversaryDate);

    switch (reminder.reminder_type) {
      case 'birthday_father':
        const fatherAge = this.calculateUpcomingAge(anniversaryDate, currentYear);
        message = `
🎊 *كل عام وأنت بخير يا ${reminder.guardian_name}!* 🎊

اليوم ${todayDate} 🎂
عيد ميلاد سعيد لأب رائع! 👨‍👧

🎈 *${fatherAge} سنة* من العطاء والحب

نتمنى لك يوماً مليئاً بالسعادة والمفاجآت! 💙
بارك الله فيك وفي عمرك 🤲

#عيد_ميلاد_سعيد 🎉
        `.trim();
        break;

      case 'birthday_mother':
        const motherAge = this.calculateUpcomingAge(anniversaryDate, currentYear);
        message = `
🎊 *كل عام وأنتِ بخير يا ${reminder.guardian_name}!* 🎊

اليوم ${todayDate} 🎂
عيد ميلاد سعيد لأم غالية! 👩‍👧

🎈 *${motherAge} سنة* من الحنان والتضحية

نتمنى لكِ يوماً مليئاً بالفرح والسعادة! 💝
بارك الله فيكِ وفي عمرك 🤲

#عيد_ميلاد_سعيد 🎉
        `.trim();
        break;

      case 'birthday_child':
        // Get child info
        const child = db.prepare(`
          SELECT name FROM children
          WHERE family_id = ? AND birth_date = ?
        `).get(reminder.family_id, reminder.anniversary_date);

        const childAge = this.calculateUpcomingAge(anniversaryDate, currentYear);
        message = `
🎊 *كل عام و${child?.name || 'الطفل'} بخير!* 🎊

اليوم ${todayDate} 🎂
عيد ميلاد سعيد! 👶

🎈 *${childAge} سنة* من الفرح والبهجة

نتمنى لكم يوماً مليئاً بالمرح والضحك! 🎉
بارك الله في عمره/ها وأسعد أيامه/ها 🤲

#عيد_ميلاد_سعيد 🎊
        `.trim();
        break;

      case 'marriage_anniversary':
        const yearsMarried = currentYear - anniversaryDate.getFullYear();
        message = `
💍 *ذكرى زواج سعيدة!* 💍

اليوم ${todayDate} 🎊
ذكرى *${yearsMarried} سنة* من الحب والسعادة! 💕

✨ رحلة جميلة قضيتموها معاً
✨ ذكريات لا تُنسى صنعتموها
✨ عائلة رائعة بنيتموها

نتمنى لكم المزيد من السنين السعيدة معاً! 🌹
بارك الله في زواجكم وأسعد أيامكم 🤲

#ذكرى_زواج_سعيدة 🎉
        `.trim();
        break;

      default:
        return;
    }

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
}

export default AnniversaryReminderService;
