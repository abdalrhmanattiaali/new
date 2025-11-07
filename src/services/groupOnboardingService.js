/**
 * Group Onboarding Service
 * خدمة التسجيل من خلال الجروب
 *
 * Handles family registration directly from WhatsApp groups
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class GroupOnboardingService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');

    // Track ongoing onboarding sessions per group
    this.onboardingSessions = new Map();
  }

  /**
   * Check if a group needs onboarding
   */
  async checkGroupOnboarding(groupId) {
    const db = new Database(this.dbPath);

    try {
      const family = db.prepare(`
        SELECT * FROM families
        WHERE family_group_id = ? AND onboarding_completed = 1
      `).get(groupId);

      db.close();
      return family !== undefined;
    } catch (error) {
      db.close();
      throw error;
    }
  }

  /**
   * Start onboarding process for a group
   */
  async startGroupOnboarding(groupId, chat) {
    // Check if already onboarding
    if (this.onboardingSessions.has(groupId)) {
      await chat.sendMessage('⏳ عملية التسجيل جارية بالفعل...');
      return;
    }

    // Check if already registered
    const isRegistered = await this.checkGroupOnboarding(groupId);
    if (isRegistered) {
      await chat.sendMessage('✅ هذا الجروب مسجل بالفعل!');
      return;
    }

    // Initialize session
    this.onboardingSessions.set(groupId, {
      step: 'family_name',
      data: {
        groupId,
        onboardingSource: 'group'
      },
      startedAt: new Date()
    });

    // Send welcome message
    const welcomeMsg = `
🎉 *مرحباً بكم في المساعد العائلي الذكي!*

سأساعدكم في رحلة التربية من خلال:
✨ رسائل يومية متنوعة للأب والأم والطفل
📅 تذكيرات بالتطعيمات والأحداث المهمة
💡 نصائح تربوية ذكية
🎯 تتبع تطور الطفل وأهداف الوالدين
🎂 تذكيرات بأعياد الميلاد والمناسبات

دعونا نبدأ التسجيل!

*ما هو اسم العائلة؟*
مثال: عائلة أحمد، عائلة المصري، إلخ.
    `.trim();

    await chat.sendMessage(welcomeMsg);
  }

  /**
   * Process incoming message during onboarding
   */
  async processOnboardingMessage(groupId, message, chat) {
    const session = this.onboardingSessions.get(groupId);

    if (!session) {
      return false; // Not in onboarding
    }

    const messageText = message.body.trim();

    // Skip if message is empty
    if (!messageText) {
      return true;
    }

    try {
      switch (session.step) {
        case 'family_name':
          await this.handleFamilyName(groupId, messageText, chat);
          break;

        case 'father_name':
          await this.handleFatherName(groupId, messageText, chat);
          break;

        case 'father_birth_date':
          await this.handleFatherBirthDate(groupId, messageText, chat);
          break;

        case 'mother_name':
          await this.handleMotherName(groupId, messageText, chat);
          break;

        case 'mother_birth_date':
          await this.handleMotherBirthDate(groupId, messageText, chat);
          break;

        case 'marriage_date':
          await this.handleMarriageDate(groupId, messageText, chat);
          break;

        case 'child_name':
          await this.handleChildName(groupId, messageText, chat);
          break;

        case 'child_birth_date':
          await this.handleChildBirthDate(groupId, messageText, chat);
          break;

        case 'more_children':
          await this.handleMoreChildren(groupId, messageText, chat);
          break;

        default:
          return false;
      }

      return true; // Message was handled
    } catch (error) {
      console.error('Error processing onboarding message:', error);
      await chat.sendMessage('❌ حدث خطأ. دعنا نحاول مرة أخرى.');
      return true;
    }
  }

  /**
   * Handle family name input
   */
  async handleFamilyName(groupId, familyName, chat) {
    const session = this.onboardingSessions.get(groupId);
    session.data.familyName = familyName;
    session.step = 'father_name';

    await chat.sendMessage(`
✅ تم حفظ: *${familyName}*

الآن، *ما هو اسم الأب؟*
    `.trim());
  }

  /**
   * Handle father name input
   */
  async handleFatherName(groupId, fatherName, chat) {
    const session = this.onboardingSessions.get(groupId);
    session.data.fatherName = fatherName;
    session.step = 'father_birth_date';

    await chat.sendMessage(`
✅ تم حفظ: *${fatherName}*

*ما هو تاريخ ميلاد الأب؟*
📅 الصيغة: YYYY-MM-DD
مثال: 1990-05-15
    `.trim());
  }

  /**
   * Handle father birth date input
   */
  async handleFatherBirthDate(groupId, birthDate, chat) {
    // Validate date format
    if (!this.isValidDate(birthDate)) {
      await chat.sendMessage(`
❌ تاريخ غير صحيح!

الرجاء إدخال التاريخ بالصيغة: YYYY-MM-DD
مثال: 1990-05-15
      `.trim());
      return;
    }

    const session = this.onboardingSessions.get(groupId);
    session.data.fatherBirthDate = birthDate;
    session.data.fatherAge = this.calculateAge(birthDate);
    session.step = 'mother_name';

    await chat.sendMessage(`
✅ تم حفظ تاريخ الميلاد (العمر: ${session.data.fatherAge} سنة)

*ما هو اسم الأم؟*
    `.trim());
  }

  /**
   * Handle mother name input
   */
  async handleMotherName(groupId, motherName, chat) {
    const session = this.onboardingSessions.get(groupId);
    session.data.motherName = motherName;
    session.step = 'mother_birth_date';

    await chat.sendMessage(`
✅ تم حفظ: *${motherName}*

*ما هو تاريخ ميلاد الأم؟*
📅 الصيغة: YYYY-MM-DD
مثال: 1992-08-20
    `.trim());
  }

  /**
   * Handle mother birth date input
   */
  async handleMotherBirthDate(groupId, birthDate, chat) {
    // Validate date format
    if (!this.isValidDate(birthDate)) {
      await chat.sendMessage(`
❌ تاريخ غير صحيح!

الرجاء إدخال التاريخ بالصيغة: YYYY-MM-DD
مثال: 1992-08-20
      `.trim());
      return;
    }

    const session = this.onboardingSessions.get(groupId);
    session.data.motherBirthDate = birthDate;
    session.data.motherAge = this.calculateAge(birthDate);
    session.step = 'marriage_date';

    await chat.sendMessage(`
✅ تم حفظ تاريخ الميلاد (العمر: ${session.data.motherAge} سنة)

*ما هو تاريخ الزواج؟*
📅 الصيغة: YYYY-MM-DD
مثال: 2018-06-10

(إذا كنت لا تريد إدخاله الآن، اكتب: تخطي)
    `.trim());
  }

  /**
   * Handle marriage date input
   */
  async handleMarriageDate(groupId, input, chat) {
    const session = this.onboardingSessions.get(groupId);

    if (input === 'تخطي' || input.toLowerCase() === 'skip') {
      session.data.marriageDate = null;
    } else {
      // Validate date format
      if (!this.isValidDate(input)) {
        await chat.sendMessage(`
❌ تاريخ غير صحيح!

الرجاء إدخال التاريخ بالصيغة: YYYY-MM-DD
أو اكتب: تخطي
        `.trim());
        return;
      }
      session.data.marriageDate = input;
    }

    session.step = 'child_name';
    session.data.children = [];

    const marriageMsg = session.data.marriageDate
      ? `✅ تم حفظ تاريخ الزواج: ${session.data.marriageDate}`
      : '⏭️ تم تخطي تاريخ الزواج';

    await chat.sendMessage(`
${marriageMsg}

الآن دعنا نسجل معلومات الأطفال:

*ما هو اسم الطفل الأول؟*
    `.trim());
  }

  /**
   * Handle child name input
   */
  async handleChildName(groupId, childName, chat) {
    const session = this.onboardingSessions.get(groupId);
    session.data.currentChild = { name: childName };
    session.step = 'child_birth_date';

    await chat.sendMessage(`
✅ تم حفظ: *${childName}*

*ما هو تاريخ ميلاد ${childName}؟*
📅 الصيغة: YYYY-MM-DD
مثال: 2020-03-15
    `.trim());
  }

  /**
   * Handle child birth date input
   */
  async handleChildBirthDate(groupId, birthDate, chat) {
    // Validate date format
    if (!this.isValidDate(birthDate)) {
      await chat.sendMessage(`
❌ تاريخ غير صحيح!

الرجاء إدخال التاريخ بالصيغة: YYYY-MM-DD
مثال: 2020-03-15
      `.trim());
      return;
    }

    const session = this.onboardingSessions.get(groupId);
    session.data.currentChild.birthDate = birthDate;
    session.data.currentChild.age = this.calculateAge(birthDate);
    session.data.children.push(session.data.currentChild);
    delete session.data.currentChild;

    session.step = 'more_children';

    await chat.sendMessage(`
✅ تم حفظ معلومات الطفل

*هل لديكم أطفال آخرون؟*
أجب بـ: نعم أو لا
    `.trim());
  }

  /**
   * Handle more children question
   */
  async handleMoreChildren(groupId, answer, chat) {
    const session = this.onboardingSessions.get(groupId);
    const lowerAnswer = answer.toLowerCase();

    if (lowerAnswer === 'نعم' || lowerAnswer === 'yes' || lowerAnswer === 'y') {
      session.step = 'child_name';
      await chat.sendMessage('*ما هو اسم الطفل التالي؟*');
    } else {
      // Finish onboarding
      await this.completeOnboarding(groupId, chat);
    }
  }

  /**
   * Complete onboarding and save to database
   */
  async completeOnboarding(groupId, chat) {
    const session = this.onboardingSessions.get(groupId);
    const data = session.data;

    await chat.sendMessage('⏳ جاري حفظ البيانات...');

    const db = new Database(this.dbPath);

    try {
      db.prepare('BEGIN TRANSACTION').run();

      // 1. Create family
      const familyStmt = db.prepare(`
        INSERT INTO families (
          family_name, family_group_id, send_to_group,
          marriage_date, onboarding_completed, onboarding_source
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const familyResult = familyStmt.run(
        data.familyName,
        data.groupId,
        1, // send_to_group
        data.marriageDate,
        1, // onboarding_completed
        'group'
      );

      const familyId = familyResult.lastInsertRowid;

      // 2. Create guardians
      const guardianStmt = db.prepare(`
        INSERT INTO guardians (
          family_id, name, role, birth_date, age
        ) VALUES (?, ?, ?, ?, ?)
      `);

      // Father
      const fatherResult = guardianStmt.run(
        familyId,
        data.fatherName,
        'father',
        data.fatherBirthDate,
        data.fatherAge
      );
      const fatherId = fatherResult.lastInsertRowid;

      // Mother
      const motherResult = guardianStmt.run(
        familyId,
        data.motherName,
        'mother',
        data.motherBirthDate,
        data.motherAge
      );
      const motherId = motherResult.lastInsertRowid;

      // 3. Create children
      const childStmt = db.prepare(`
        INSERT INTO children (
          family_id, name, birth_date, development_stage
        ) VALUES (?, ?, ?, ?)
      `);

      const childIds = [];
      for (const child of data.children) {
        const stage = this.getDevelopmentStage(child.age);
        const childResult = childStmt.run(
          familyId,
          child.name,
          child.birthDate,
          stage
        );
        childIds.push(childResult.lastInsertRowid);
      }

      // 4. Create anniversary reminders
      const reminderStmt = db.prepare(`
        INSERT INTO anniversary_reminders (
          family_id, guardian_id, reminder_type, anniversary_date, enabled
        ) VALUES (?, ?, ?, ?, ?)
      `);

      // Father birthday
      reminderStmt.run(familyId, fatherId, 'birthday_father', data.fatherBirthDate, 1);

      // Mother birthday
      reminderStmt.run(familyId, motherId, 'birthday_mother', data.motherBirthDate, 1);

      // Children birthdays
      for (let i = 0; i < childIds.length; i++) {
        reminderStmt.run(familyId, null, 'birthday_child', data.children[i].birthDate, 1);
      }

      // Marriage anniversary (if provided)
      if (data.marriageDate) {
        reminderStmt.run(familyId, null, 'marriage_anniversary', data.marriageDate, 1);
      }

      db.prepare('COMMIT').run();
      db.close();

      // Remove session
      this.onboardingSessions.delete(groupId);

      // Send success message
      const successMsg = `
🎉 *تم التسجيل بنجاح!*

📋 *ملخص البيانات:*
👨‍👩‍👧 العائلة: ${data.familyName}
👨 الأب: ${data.fatherName} (${data.fatherAge} سنة)
👩 الأم: ${data.motherName} (${data.motherAge} سنة)
${data.children.map(c => `👶 ${c.name} (${c.age} سنة)`).join('\n')}
${data.marriageDate ? `💍 تاريخ الزواج: ${data.marriageDate}` : ''}

✨ *ماذا سيحدث الآن؟*

📨 ستصلكم رسائل يومية متنوعة:
  • ${this.config.tracks?.distribution?.child || 3} رسائل للطفل
  • ${this.config.tracks?.distribution?.mother || 2} رسائل للأم
  • ${this.config.tracks?.distribution?.father || 2} رسائل للأب
  • ${this.config.tracks?.distribution?.family || 1} رسالة للعائلة

🎂 تذكيرات بأعياد الميلاد والمناسبات
📊 تقارير أسبوعية عن تطور الطفل
💡 نصائح تربوية وتحفيزية

مرحباً بكم في رحلة التطور! 🌟
      `.trim();

      await chat.sendMessage(successMsg);

    } catch (error) {
      db.prepare('ROLLBACK').run();
      db.close();
      console.error('Error completing onboarding:', error);
      await chat.sendMessage('❌ حدث خطأ أثناء حفظ البيانات. الرجاء المحاولة مرة أخرى.');
      this.onboardingSessions.delete(groupId);
    }
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Calculate age from birth date
   */
  calculateAge(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Determine development stage based on age
   */
  getDevelopmentStage(age) {
    if (age < 1) return 'infant';
    if (age < 3) return 'toddler';
    if (age < 6) return 'preschool';
    return 'school';
  }

  /**
   * Cancel ongoing onboarding
   */
  cancelOnboarding(groupId) {
    if (this.onboardingSessions.has(groupId)) {
      this.onboardingSessions.delete(groupId);
      return true;
    }
    return false;
  }

  /**
   * Get session info
   */
  getSession(groupId) {
    return this.onboardingSessions.get(groupId);
  }
}

export default GroupOnboardingService;
