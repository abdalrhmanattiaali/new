/**
 * Child Issue Tracking Service
 * خدمة متابعة المشاكل الصحية والتطورية للأطفال
 */

import { getDatabase } from '../database/init.js';
import { LLMService } from '../ai/llm.js';
import { format, addDays, differenceInDays } from 'date-fns';

export class ChildIssueTrackingService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
    this.db = null;
  }

  /**
   * Initialize the service
   */
  initialize() {
    this.db = getDatabase();
    console.log('✅ ChildIssueTrackingService initialized');
  }

  /**
   * Ask families about child issues (runs daily at 11 PM)
   */
  async sendDailyIssueCheck() {
    console.log('🏥 Sending daily child issue check...');

    const db = getDatabase();

    // Get all families with children
    const families = db.prepare(`
      SELECT DISTINCT f.id, f.family_name, f.family_group_id, f.send_to_group
      FROM families f
      INNER JOIN children c ON f.id = c.family_id
      WHERE f.onboarding_completed = 1
    `).all();

    for (const family of families) {
      try {
        // Get children for this family
        const children = db.prepare(`
          SELECT id, name, birth_date
          FROM children
          WHERE family_id = ?
        `).all(family.id);

        const childrenNames = children.map(c => c.name).join('، ');

        const message = `🏥 *فحص يومي - صحة الأطفال*

مساء الخير عائلة ${family.family_name}! 💙

هل هناك أي مشاكل أو ملاحظات تتعلق بصحة أو سلوك ${childrenNames} اليوم؟

مثلاً:
• مشاكل في النوم 😴
• مشاكل في التغذية 🍽️
• مشاكل صحية (حرارة، كحة، إلخ) 🤒
• مشاكل سلوكية 😤
• مشاكل تطورية 👶

*للإبلاغ عن مشكلة:*
أرسل وصف تفصيلي للمشكلة، وسأقوم بإنشاء خطة متابعة ذكية لكم! 📋

*إذا كل شيء بخير:*
أرسل "كل شيء تمام" أو "لا توجد مشاكل" ✅`;

        // Send to group or guardians
        if (family.send_to_group && family.family_group_id) {
          await this.bot.sendMessageToGroup(family.family_group_id, message);
        } else {
          // Send to all guardians
          const guardians = db.prepare(`
            SELECT phone_number FROM guardians WHERE family_id = ? AND phone_number IS NOT NULL
          `).all(family.id);

          for (const guardian of guardians) {
            await this.bot.sendMessage(guardian.phone_number, message);
          }
        }

        await this.sleep(1000);

      } catch (error) {
        console.error(`Error sending issue check to family ${family.id}:`, error);
      }
    }

    console.log('✅ Daily issue check sent');
  }

  /**
   * Process issue report from parents
   */
  async processIssueReport(familyId, childName, issueDescription) {
    const db = getDatabase();

    // Get child info
    const child = db.prepare(`
      SELECT id, name, birth_date FROM children WHERE family_id = ? AND name LIKE ?
    `).get(familyId, `%${childName}%`);

    if (!child) {
      return {
        success: false,
        message: 'لم أتمكن من إيجاد الطفل. من فضلك تأكد من الاسم وحاول مرة أخرى.'
      };
    }

    // Generate AI analysis and treatment plan
    const aiPlan = await this.generateTreatmentPlan(child, issueDescription);

    // Save issue to database
    const issueId = this.saveIssue(child.id, familyId, aiPlan);

    return {
      success: true,
      issueId,
      message: aiPlan.response_message
    };
  }

  /**
   * Generate AI-powered treatment plan
   */
  async generateTreatmentPlan(child, issueDescription) {
    const childAge = this.calculateAgeInMonths(child.birth_date);

    const prompt = `أنت طبيب أطفال ومستشار تربوي خبير. تم الإبلاغ عن المشكلة التالية:

**الطفل:** ${child.name}
**العمر:** ${Math.floor(childAge / 12)} سنة و ${childAge % 12} شهر
**المشكلة:** ${issueDescription}

قم بإنشاء خطة متابعة وعلاج شاملة بصيغة JSON تحتوي على:

1. **diagnosis**: تشخيص مبسط وواضح للمشكلة
2. **issue_type**: نوع المشكلة (اختر واحد فقط: nutrition, sleep, health, behavior, development)
3. **severity**: مستوى الخطورة (low, medium, high, urgent)
4. **expected_duration_days**: المدة المتوقعة لحل المشكلة (بالأيام)
5. **treatment_plan**: خطة العلاج التفصيلية (نص)
6. **daily_actions**: إجراءات يومية محددة (array من 3-5 إجراءات)
7. **reminders_per_day**: عدد التذكيرات اليومية المناسبة (3-5)
8. **followup_frequency_days**: كل كم يوم يتم المتابعة (مثل: 3، 7، 14)
9. **warning_signs**: علامات تحذيرية تستدعي زيارة الطبيب فوراً
10. **response_message**: رسالة واضحة ومطمئنة للأهل تشرح الخطة

**مهم:**
- إذا كانت المشكلة طبية خطيرة، اجعل severity = "urgent" واطلب زيارة الطبيب فوراً
- كن عملياً ومباشراً في النصائح
- استخدم لغة بسيطة ومطمئنة
- ركز على حلول يمكن تطبيقها في المنزل

أرجع النتيجة بصيغة JSON فقط، بدون أي نص إضافي.`;

    try {
      const aiResponse = await this.llm.openai.generateText(
        'أنت طبيب أطفال ومستشار تربوي متخصص. أجب دائماً بصيغة JSON صحيحة.',
        prompt,
        { maxTokens: 20000 }
      );

      // Parse JSON response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }

      throw new Error('Failed to parse AI response');

    } catch (error) {
      console.error('Error generating treatment plan:', error);

      // Fallback plan
      return {
        diagnosis: 'تم استلام المشكلة وسيتم المتابعة',
        issue_type: 'health',
        severity: 'medium',
        expected_duration_days: 7,
        treatment_plan: 'سنقوم بمتابعة الحالة وإرسال نصائح يومية',
        daily_actions: ['متابعة الأعراض', 'تسجيل الملاحظات', 'التواصل عند الحاجة'],
        reminders_per_day: 3,
        followup_frequency_days: 3,
        warning_signs: 'أي تفاقم في الأعراض',
        response_message: 'تم استلام البلاغ. سنقوم بالمتابعة وإرسال نصائح يومية.'
      };
    }
  }

  /**
   * Save issue to database
   */
  saveIssue(childId, familyId, aiPlan) {
    const db = getDatabase();

    const today = format(new Date(), 'yyyy-MM-dd');
    const expectedResolution = format(
      addDays(new Date(), aiPlan.expected_duration_days),
      'yyyy-MM-dd'
    );

    const stmt = db.prepare(`
      INSERT INTO child_issues (
        child_id, family_id, issue_type, issue_title, issue_description,
        severity, status, ai_diagnosis, treatment_plan, daily_actions,
        expected_duration_days, reminders_per_day, reported_date,
        expected_resolution_date, next_followup_date, followup_frequency_days
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      childId,
      familyId,
      aiPlan.issue_type,
      aiPlan.diagnosis,
      aiPlan.diagnosis, // issue_description
      aiPlan.severity,
      aiPlan.diagnosis,
      aiPlan.treatment_plan,
      JSON.stringify(aiPlan.daily_actions),
      aiPlan.expected_duration_days,
      aiPlan.reminders_per_day,
      today,
      expectedResolution,
      format(addDays(new Date(), aiPlan.followup_frequency_days), 'yyyy-MM-dd'),
      aiPlan.followup_frequency_days
    );

    return result.lastInsertRowid;
  }

  /**
   * Send daily reminders for active issues
   */
  async sendDailyReminders() {
    console.log('💊 Sending daily issue reminders...');

    const db = getDatabase();
    const today = format(new Date(), 'yyyy-MM-dd');

    // Get all active issues
    const issues = db.prepare(`
      SELECT
        i.*,
        c.name as child_name,
        c.birth_date,
        f.family_name,
        f.family_group_id,
        f.send_to_group
      FROM child_issues i
      INNER JOIN children c ON i.child_id = c.id
      INNER JOIN families f ON i.family_id = f.id
      WHERE i.status IN ('active', 'monitoring')
        AND (i.last_reminder_sent IS NULL OR DATE(i.last_reminder_sent) < DATE('now'))
      ORDER BY i.severity DESC, i.created_at ASC
    `).all();

    console.log(`Found ${issues.length} active issues`);

    for (const issue of issues) {
      try {
        await this.sendIssueReminders(issue);

        // Update last reminder sent
        db.prepare(`
          UPDATE child_issues
          SET last_reminder_sent = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(issue.id);

        await this.sleep(2000);

      } catch (error) {
        console.error(`Error sending reminders for issue ${issue.id}:`, error);
      }
    }

    console.log('✅ Daily reminders sent');
  }

  /**
   * Send reminders for a specific issue
   */
  async sendIssueReminders(issue) {
    const dailyActions = JSON.parse(issue.daily_actions || '[]');
    const remindersCount = issue.reminders_per_day || 3;

    // Calculate progress
    const daysElapsed = differenceInDays(
      new Date(),
      new Date(issue.reported_date)
    );
    const progressPercentage = Math.min(
      100,
      Math.round((daysElapsed / issue.expected_duration_days) * 100)
    );

    // Generate reminders
    const reminders = [];
    for (let i = 0; i < Math.min(remindersCount, dailyActions.length); i++) {
      reminders.push(dailyActions[i]);
    }

    // If we need more reminders than actions, duplicate some
    while (reminders.length < remindersCount && dailyActions.length > 0) {
      reminders.push(dailyActions[reminders.length % dailyActions.length]);
    }

    // Send reminders one by one
    for (let i = 0; i < reminders.length; i++) {
      const message = `🏥 *متابعة - ${issue.issue_title}*

👶 *الطفل:* ${issue.child_name}
📊 *التقدم:* ${progressPercentage}%
⏰ *تذكير ${i + 1} من ${reminders.length}*

*الإجراء اليوم:*
${reminders[i]}

${i === reminders.length - 1 ? `\n💪 استمروا في العمل الرائع! نحن معكم خطوة بخطوة.\n\n*للتحديث:*\nأرسل "تحسن" أو "لا تحسن" أو "تم الحل"` : ''}`;

      // Send to group or guardians
      if (issue.send_to_group && issue.family_group_id) {
        await this.bot.sendMessageToGroup(issue.family_group_id, message);
      } else {
        const guardians = this.db.prepare(`
          SELECT phone_number FROM guardians
          WHERE family_id = ? AND phone_number IS NOT NULL
        `).all(issue.family_id);

        for (const guardian of guardians) {
          await this.bot.sendMessage(guardian.phone_number, message);
        }
      }

      // Wait between reminders (spread throughout the day)
      if (i < reminders.length - 1) {
        await this.sleep(3000);
      }
    }
  }

  /**
   * Update issue progress
   */
  updateProgress(issueId, progressUpdate) {
    const db = getDatabase();

    let newStatus = progressUpdate.status || 'monitoring';
    let progressPercentage = progressUpdate.progress || 0;

    if (progressUpdate.status === 'resolved') {
      progressPercentage = 100;
    }

    // Get current progress notes
    const issue = db.prepare('SELECT progress_notes FROM child_issues WHERE id = ?').get(issueId);
    const progressNotes = JSON.parse(issue.progress_notes || '[]');

    // Add new note
    progressNotes.push({
      date: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      note: progressUpdate.note || 'تحديث',
      progress: progressPercentage
    });

    // Update database
    const stmt = db.prepare(`
      UPDATE child_issues
      SET status = ?,
          progress_percentage = ?,
          progress_notes = ?,
          actual_resolution_date = CASE WHEN ? = 'resolved' THEN DATE('now') ELSE actual_resolution_date END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(newStatus, progressPercentage, JSON.stringify(progressNotes), newStatus, issueId);
  }

  /**
   * Get active issues for a family
   */
  getActiveIssues(familyId) {
    const db = getDatabase();

    return db.prepare(`
      SELECT i.*, c.name as child_name
      FROM child_issues i
      INNER JOIN children c ON i.child_id = c.id
      WHERE i.family_id = ? AND i.status IN ('active', 'monitoring')
      ORDER BY i.severity DESC, i.created_at DESC
    `).all(familyId);
  }

  /**
   * Calculate child age in months
   */
  calculateAgeInMonths(birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 +
                   (now.getMonth() - birth.getMonth());
    return months;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ChildIssueTrackingService;
