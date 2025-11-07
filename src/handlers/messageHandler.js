/**
 * Message Handler
 * معالج الرسائل الواردة
 */

import { GuardianModel, InteractionModel } from '../database/models.js';
import { OnboardingService } from '../services/onboarding.js';

export class MessageHandler {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.onboardingService = new OnboardingService(bot, config);
    this.userSessions = new Map(); // Track user onboarding sessions
  }

  /**
   * Handle incoming messages
   */
  async handle(message) {
    const from = message.from;
    const body = message.body.trim();

    // Get guardian from database
    const guardian = GuardianModel.getByPhoneNumber(from);

    // Check if user is in onboarding
    if (!guardian || !guardian.family_id) {
      await this.handleOnboardingMessage(message);
      return;
    }

    // Handle commands
    if (body.startsWith('/') || this.isCommand(body)) {
      await this.handleCommand(message, guardian);
      return;
    }

    // Handle button responses (numbered responses)
    if (this.isButtonResponse(body)) {
      await this.handleButtonResponse(message, guardian);
      return;
    }

    // Handle general conversation
    await this.handleGeneralMessage(message, guardian);
  }

  /**
   * Handle onboarding flow
   */
  async handleOnboardingMessage(message) {
    const from = message.from;
    const body = message.body.trim();

    // Check if user has an active onboarding session
    let session = this.userSessions.get(from);

    if (!session) {
      // Start new onboarding
      session = {
        step: 'welcome',
        data: {}
      };
      this.userSessions.set(from, session);
      await this.onboardingService.startOnboarding(from);
      return;
    }

    // Process onboarding step
    await this.onboardingService.processStep(from, session, body);

    // Check if onboarding is complete
    if (session.step === 'completed') {
      this.userSessions.delete(from);
    }
  }

  /**
   * Handle commands (بياناتي، انساني، etc.)
   */
  async handleCommand(message, guardian) {
    const body = message.body.trim().toLowerCase();
    const from = message.from;

    // Privacy commands
    if (body === 'بياناتي' || body === '/mydata') {
      await this.handleExportData(from, guardian);
      return;
    }

    if (body === 'انساني' || body === '/forgetme') {
      await this.handleForgetMe(from, guardian);
      return;
    }

    if (body === 'خصوصيتي' || body === '/privacy') {
      await this.handlePrivacyInfo(from);
      return;
    }

    // Help command
    if (body === '/help' || body === 'مساعدة') {
      await this.handleHelp(from);
      return;
    }

    // Status command
    if (body === '/status' || body === 'الحالة') {
      await this.handleStatus(from, guardian);
      return;
    }

    // Unknown command
    await this.bot.sendMessage(from, 'عذراً، لم أفهم هذا الأمر. اكتب "مساعدة" لرؤية الأوامر المتاحة.');
  }

  /**
   * Handle button responses (1, 2, 3, etc. or text)
   */
  async handleButtonResponse(message, guardian) {
    const body = message.body.trim();
    const from = message.from;

    // Get the last interaction for this guardian
    const interactions = InteractionModel.getByGuardian(guardian.id, 1);
    if (interactions.length === 0) {
      await this.bot.sendMessage(from, 'لا توجد رسالة سابقة للرد عليها.');
      return;
    }

    const lastInteraction = interactions[0];

    // Map button response
    const buttonMap = {
      '1': 'تم ✅',
      '2': 'ذكّرني لاحقاً ⏰',
      '3': 'بدّل التوقيت 🔄',
      '4': 'أرسل صوت 30ث 🎤',
      '5': 'تخطي ⏭️',
      'تم': 'تم ✅',
      'ذكرني': 'ذكّرني لاحقاً ⏰',
      'بدل': 'بدّل التوقيت 🔄',
      'صوت': 'أرسل صوت 30ث 🎤',
      'تخطي': 'تخطي ⏭️'
    };

    const buttonClicked = buttonMap[body] || body;

    // Update interaction
    const responseTime = Math.floor((Date.now() - new Date(lastInteraction.created_at).getTime()) / 1000);
    InteractionModel.updateButtonClick(lastInteraction.id, buttonClicked, responseTime);

    // Handle specific button actions
    await this.handleButtonAction(from, guardian, buttonClicked, lastInteraction);
  }

  /**
   * Handle specific button actions
   */
  async handleButtonAction(from, guardian, buttonClicked, interaction) {
    if (buttonClicked === 'تم ✅') {
      await this.bot.sendMessage(from, 'رائع! تم تسجيل استجابتك 👍');
    } else if (buttonClicked.includes('ذكّرني')) {
      await this.bot.sendMessage(from, 'حسناً، سأذكرك بعد ساعة ⏰');
      // TODO: Schedule reminder
    } else if (buttonClicked.includes('بدّل')) {
      await this.bot.sendMessage(from, 'ما هو الوقت المفضل لك؟ (صباح/ظهر/مساء)');
    } else if (buttonClicked.includes('صوت')) {
      await this.bot.sendMessage(from, 'ميزة الصوت ستكون متاحة قريباً 🎤');
    } else if (buttonClicked.includes('تخطي')) {
      await this.bot.sendMessage(from, 'تم التخطي ✓');
    }
  }

  /**
   * Handle general messages
   */
  async handleGeneralMessage(message, guardian) {
    const from = message.from;
    const body = message.body;

    // Log the interaction
    InteractionModel.create(guardian.family_id, guardian.id, 'general', body, null);

    // Send acknowledgment
    await this.bot.sendMessage(
      from,
      'شكراً لرسالتك! أنا هنا لمساعدتك. اكتب "مساعدة" لرؤية ما يمكنني فعله.'
    );
  }

  /**
   * Export user data
   */
  async handleExportData(from, guardian) {
    // TODO: Implement data export
    await this.bot.sendMessage(
      from,
      '📊 سيتم إرسال بياناتك قريباً. هذه الميزة قيد التطوير.'
    );
  }

  /**
   * Forget user (delete all data)
   */
  async handleForgetMe(from, guardian) {
    await this.bot.sendMessage(
      from,
      '⚠️ هذا سيحذف جميع بياناتك نهائياً. هل أنت متأكد؟\nاكتب "نعم أنا متأكد" للتأكيد.'
    );
    // TODO: Implement data deletion with confirmation
  }

  /**
   * Show privacy information
   */
  async handlePrivacyInfo(from) {
    const privacyMessage = `
🔒 *سياسة الخصوصية*

- جميع بياناتك مشفرة ومحفوظة محلياً
- لا نشارك بياناتك مع أي طرف ثالث
- يمكنك طلب بياناتك في أي وقت: "بياناتي"
- يمكنك حذف بياناتك نهائياً: "انساني"
- مدة الاحتفاظ: ${this.config.privacy?.data_retention_days || 365} يوم

للمزيد من المعلومات، تواصل معنا.
    `.trim();

    await this.bot.sendMessage(from, privacyMessage);
  }

  /**
   * Show help message
   */
  async handleHelp(from) {
    const helpMessage = `
🤖 *مساعد العائلة الذكي*

*الأوامر المتاحة:*
- مساعدة: عرض هذه الرسالة
- الحالة: عرض حالة حسابك
- بياناتي: طلب نسخة من بياناتك
- خصوصيتي: معلومات عن الخصوصية
- انساني: حذف جميع بياناتك

*الأزرار التفاعلية:*
1️⃣ تم: تأكيد إتمام المهمة
2️⃣ ذكّرني لاحقاً: تأجيل التذكير
3️⃣ بدّل التوقيت: تغيير وقت الرسائل
4️⃣ أرسل صوت 30ث: استماع للمحتوى
5️⃣ تخطي: تخطي هذه الرسالة

لأي استفسار، أرسل رسالتك وسأكون سعيداً بالمساعدة!
    `.trim();

    await this.bot.sendMessage(from, helpMessage);
  }

  /**
   * Show user status
   */
  async handleStatus(from, guardian) {
    const stats = InteractionModel.getStats(guardian.id);

    const statusMessage = `
📊 *حالة حسابك*

👤 الاسم: ${guardian.name}
📱 الدور: ${guardian.role === 'father' ? 'الأب' : 'الأم'}
⏰ الوقت المفضل: ${guardian.preferred_time || 'غير محدد'}

📈 *الإحصائيات:*
- إجمالي الرسائل: ${stats.total_interactions}
- الردود: ${stats.responded}
- معدل التفاعل: ${stats.total_interactions > 0 ? ((stats.responded / stats.total_interactions) * 100).toFixed(1) : 0}%
- متوسط وقت الرد: ${stats.avg_response_time ? Math.floor(stats.avg_response_time / 60) : 0} دقيقة

✅ كل شيء يعمل بشكل جيد!
    `.trim();

    await this.bot.sendMessage(from, statusMessage);
  }

  /**
   * Check if message is a command
   */
  isCommand(body) {
    const commands = ['بياناتي', 'انساني', 'خصوصيتي', 'مساعدة', 'الحالة'];
    return commands.some(cmd => body.toLowerCase().includes(cmd.toLowerCase()));
  }

  /**
   * Check if message is a button response
   */
  isButtonResponse(body) {
    const buttonKeywords = ['تم', 'ذكرني', 'بدل', 'صوت', 'تخطي'];
    return /^[1-5]$/.test(body) || buttonKeywords.some(kw => body.includes(kw));
  }
}

export default MessageHandler;
