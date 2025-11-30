/**
 * Message Handler
 * معالج الرسائل الواردة
 */

import {
  FamilyModel,
  GuardianModel,
  InteractionModel,
  ChildModel,
  CoupleFeedbackModel,
  InferenceQuestionModel
} from '../database/models.js';
import { OnboardingService } from '../services/onboarding.js';
import { GroupOnboardingService } from '../services/groupOnboardingService.js';
import { ChildIssueTrackingService } from '../services/childIssueTrackingService.js';
import { SpiritualRoutineService } from '../services/spiritualRoutineService.js';
import InteractiveDialogueService from '../services/interactiveDialogueService.js';
import PresenceService from '../services/presenceService.js';
import { InferenceQuestionService } from '../services/inferenceQuestionService.js';

export class MessageHandler {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.onboardingService = new OnboardingService(bot, config);
    this.groupOnboarding = new GroupOnboardingService(bot, config);
    this.userSessions = new Map(); // Track user onboarding sessions
    this.childIssueService = new ChildIssueTrackingService(bot, config);
    this.spiritualService = new SpiritualRoutineService(bot, config);
    this.dialogueService = new InteractiveDialogueService(bot, config);
    this.presenceService = new PresenceService();
    this.inferenceQuestions = new InferenceQuestionService(bot, config);

    try {
      this.childIssueService.initialize();
    } catch (error) {
      console.warn('MessageHandler: failed to initialize child issue service:', error.message);
    }

    this.issueKeywords = [
      'مشكلة',
      'يتعب',
      'تعب',
      'مرض',
      'مريض',
      'حرارة',
      'سخونة',
      'كحة',
      'كحه',
      'يبكي',
      'يبكى',
      'يرفض',
      'ما ياكل',
      'ماينام',
      'مش بينام',
      'صداع',
      'وجع',
      'ألم',
      'الم',
      'سلوك',
      'عصبي',
      'تأخر',
      'قلق'
    ];

    this.noIssueKeywords = ['كل شيء تمام', 'كل شىء تمام', 'لا توجد مشاكل', 'ما في مشكلة', 'مفيش مشكلة'];

    this.couplePositiveKeywords = ['ايجاب', 'امتنان', 'شكر', 'حلو', 'جميل'];
    this.coupleNegativeKeywords = ['سلبي', 'شكوى', 'زعل', 'مضايق', 'عتاب'];
    this.coupleSubjectKeywords = ['زوج', 'زوجه', 'زوجي', 'زوجتى', 'زوجتي', 'شريك', 'شريكتي', 'شريكي', 'زوجيه'];
  }

  /**
   * Handle incoming messages
   */
  async handle(message) {
    const from = message.from;
    const body = message.body.trim();
    const chat = await message.getChat();

    // Check if message is from a group
    if (chat.isGroup) {
      await this.handleGroupMessage(message, chat);
      return;
    }

    // Individual message handling
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
   * Handle messages from groups
   */
  async handleGroupMessage(message, chat) {
    const groupId = chat.id._serialized;
    const body = message.body.trim();

    // Check if group is already registered
    const isRegistered = await this.groupOnboarding.checkGroupOnboarding(groupId);

    // Check if group is in onboarding process
    const session = this.groupOnboarding.getSession(groupId);

    if (session) {
      // Group is in onboarding - process the message
      await this.groupOnboarding.processOnboardingMessage(groupId, message, chat);
      return;
    }

    if (!isRegistered) {
      // Group is not registered - check for start command
      if (body === '/start' || body === 'ابدأ' || body === 'تسجيل' || body.includes('بدء التسجيل')) {
        await this.groupOnboarding.startGroupOnboarding(groupId, chat);
        return;
      }

      // Send instruction to start onboarding
      if (body.startsWith('/') || body.includes('مرحبا') || body.includes('السلام')) {
        const instructionMsg = `
👋 مرحباً بكم في المساعد العائلي الذكي!

هذا الجروب غير مسجل بعد.

للبدء في التسجيل، اكتب:
• /start
• ابدأ
• تسجيل

سأقوم بإرشادكم خطوة بخطوة لتسجيل عائلتكم! 🎉
        `.trim();

        await chat.sendMessage(instructionMsg);
      }
      return;
    }

    // Group is registered - handle normal commands
    // Handle group commands
    if (body === '/help' || body === 'مساعدة') {
      await this.handleGroupHelp(chat);
      return;
    }

    if (body === '/status' || body === 'الحالة') {
      await this.handleGroupStatus(chat, groupId);
      return;
    }

    // Ignore other messages in registered groups (unless they're commands)
  }

  /**
   * Show help for group
   */
  async handleGroupHelp(chat) {
    const helpMessage = `
🤖 *مساعد العائلة الذكي - أوامر الجروب*

*الأوامر المتاحة:*
- مساعدة أو /help: عرض هذه الرسالة
- الحالة أو /status: عرض حالة العائلة
- /settings: إعدادات الجروب

*ماذا أفعل؟*
✨ أرسل لكم رسائل يومية متنوعة
📅 أذكركم بالتطعيمات والأحداث
💡 أقدم نصائح تربوية ذكية
🎯 أتابع تطور الطفل وأهدافكم
🎂 أذكركم بأعياد الميلاد والمناسبات

تفاعلوا مع الرسائل باستخدام الأزرار! 👍
    `.trim();

    await chat.sendMessage(helpMessage);
  }

  /**
   * Show status for group
   */
  async handleGroupStatus(chat, groupId) {
    try {
      const Database = (await import('better-sqlite3')).default;
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const dbPath = join(__dirname, '..', '..', 'data', 'family_assistant.db');

      const db = new Database(dbPath);

      const family = db.prepare(`
        SELECT f.*, COUNT(DISTINCT c.id) as children_count
        FROM families f
        LEFT JOIN children c ON c.family_id = f.id
        WHERE f.family_group_id = ?
        GROUP BY f.id
      `).get(groupId);

      const guardians = db.prepare(`
        SELECT name, role FROM guardians WHERE family_id = ?
      `).all(family.id);

      db.close();

      const statusMessage = `
📊 *حالة العائلة*

👨‍👩‍👧 العائلة: ${family.family_name}
📅 تاريخ التسجيل: ${new Date(family.created_at).toLocaleDateString('ar-EG')}

👥 *الأعضاء:*
${guardians.map(g => `${g.role === 'father' ? '👨' : '👩'} ${g.name} (${g.role === 'father' ? 'الأب' : 'الأم'})`).join('\n')}

👶 عدد الأطفال: ${family.children_count}
${family.marriage_date ? `💍 تاريخ الزواج: ${new Date(family.marriage_date).toLocaleDateString('ar-EG')}` : ''}

✅ الإرسال للجروب: ${family.send_to_group ? 'مفعّل' : 'معطّل'}
✅ كل شيء يعمل بشكل جيد!
      `.trim();

      await chat.sendMessage(statusMessage);

    } catch (error) {
      console.error('Error getting group status:', error);
      await chat.sendMessage('❌ حدث خطأ في جلب البيانات.');
    }
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

    if (
      body.startsWith('/dua') ||
      body.includes('دعاء جديد') ||
      body.includes('اكتب دعاء') ||
      body.includes('اذكار جديدة')
    ) {
      await this.handleCustomSpiritualCommand(message, guardian);
      return;
    }

    // Unknown command
    await this.bot.sendMessage(from, 'عذراً، لم أفهم هذا الأمر. اكتب "مساعدة" لرؤية الأوامر المتاحة.');
  }

  async handleCustomSpiritualCommand(message, guardian) {
    const from = message.from;
    const family = FamilyModel.getById(guardian.family_id);
    const children = ChildModel.getByFamily(guardian.family_id);
    const child = children[0] || null;

    const requestText = message.body.replace('/dua', '').trim() || 'دعاء روحاني قصير يعزز الطمأنينة.';

    await this.bot.sendMessage(from, '⏳ لحظة من فضلك... أجهز لك ذكراً جديداً بروح مطمئنة.');

    try {
      const result = await this.spiritualService.generateCustomContent({
        guardian,
        family,
        child,
        requestText,
        type: requestText.includes('قصة') ? 'story' : 'prayer'
      });

      if (result?.text) {
        await this.spiritualService.sendCustomContent({
          guardian,
          family,
          text: result.text,
          buttons: this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰', 'بدّل التوقيت 🔄', 'تخطي ⏭️']
        });
      } else {
        await this.bot.sendMessage(
          from,
          'تعذر إنشاء الدعاء الآن، حاول مرة أخرى بعد قليل.'
        );
      }
    } catch (error) {
      console.error('Error generating custom spiritual content:', error);
      await this.bot.sendMessage(
        from,
        'حدث خطأ غير متوقع أثناء إنشاء الذكر. أعد المحاولة في وقت لاحق.'
      );
    }
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
    const availableButtons = this.extractButtonsFromInteraction(lastInteraction.message_content);
    let buttonClicked = body;

    if (/^\d+$/.test(body)) {
      const index = parseInt(body, 10) - 1;
      if (availableButtons[index]) {
        buttonClicked = availableButtons[index];
      }
    } else {
      const normalizedBody = this.normalizeText(body);
      const synonyms = [
        { match: ['تم', 'done'], value: 'تم ✅' },
        { match: ['ذكرني', 'remind'], value: 'ذكّرني لاحقاً ⏰' },
        { match: ['بدل', 'توقيت'], value: 'بدّل التوقيت 🔄' },
        { match: ['دعاء', 'اضافي'], value: 'علّمني دعاء تاني 📿' },
        { match: ['قصة', 'حكاية'], value: 'قصة تانية بكرة 📖' },
        { match: ['تخطي', 'skip'], value: 'تخطي ⏭️' }
      ];

      for (const synonym of synonyms) {
        if (synonym.match.some((word) => normalizedBody.includes(this.normalizeText(word)))) {
          buttonClicked = synonym.value;
          break;
        }
      }
    }

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
    const normalized = this.normalizeText(buttonClicked);

    if (
      buttonClicked === 'تم ✅' ||
      buttonClicked === 'دعوتم ✅' ||
      buttonClicked === 'رقيناه ✅' ||
      buttonClicked === 'بدأنا ✅' ||
      buttonClicked === 'طبّقنا ✅' ||
      buttonClicked === 'حمدنا الله ✅' ||
      buttonClicked === 'استمعت ✅'
    ) {
      await this.bot.sendMessage(from, 'رائع! تم تسجيل استجابتك 👍');
      return;
    }

    if (normalized.includes('ذكرني') && normalized.includes('صباح')) {
      await this.bot.sendMessage(from, 'تم تثبيت تذكير الصباح لهذا الذكر. 🔔');
      return;
    }

    if (buttonClicked.includes('ذكّرني')) {
      await this.bot.sendMessage(from, 'حسناً، سأذكرك بعد ساعة ⏰');
      return;
    }

    if (buttonClicked.includes('بدّل')) {
      await this.bot.sendMessage(from, 'ما هو الوقت المفضل لك؟ (صباح/ظهر/مساء)');
      return;
    }

    if (buttonClicked.includes('علّمني دعاء') || buttonClicked.includes('أرسل أدعية إضافية')) {
      await this.generateFollowUpSpiritualContent(from, guardian, interaction, buttonClicked, 'prayer');
      return;
    }

    if (buttonClicked.includes('قصة تانية')) {
      await this.generateFollowUpSpiritualContent(from, guardian, interaction, buttonClicked, 'story');
      return;
    }

    if (buttonClicked.includes('أرسل أغنية')) {
      await this.generateFollowUpSpiritualContent(
        from,
        guardian,
        interaction,
        buttonClicked,
        'story',
        'أغنية أذكار جديدة مرحة تناسب الطفل'
      );
      return;
    }

    if (buttonClicked.includes('ذكروني')) {
      await this.bot.sendMessage(from, 'تم تدوين طلب التذكير الشهري 🤲');
      return;
    }

    if (buttonClicked.includes('عرض الإحصائيات')) {
      await this.bot.sendMessage(
        from,
        '📊 جاري تجهيز إحصائيات الدعوات، سأرسلها لكم قريباً.'
      );
      return;
    }

    if (buttonClicked.includes('حمّل التقويم')) {
      await this.bot.sendMessage(
        from,
        '📥 سيتم إرسال رابط التقويم الأسبوعي على شكل PDF قريباً.'
      );
      return;
    }

    if (buttonClicked.includes('تصفح المكتبة')) {
      await this.bot.sendMessage(
        from,
        '📚 سأرسل لكم روابط المكتبة الإلكترونية خلال اليوم.'
      );
      return;
    }

    if (buttonClicked.includes('تحدي تاني')) {
      await this.bot.sendMessage(from, '💪 تحدٍ جديد قيد التحضير لليوم التالي!');
      return;
    }

    if (buttonClicked === 'إيجابيات اليوم 🌟') {
      await this.bot.sendMessage(
        from,
        '✨ أخبرني بأجمل شيئين لاحظتهما في شريكك اليوم، حتى لو كانا بسيطين.'
      );
      return;
    }

    if (buttonClicked === 'احتاج أفضفض 📝') {
      await this.bot.sendMessage(
        from,
        '📝 أرسل ما يزعجك مع ذكر موقف واحد فقط لنساعد على حلّه بهدوء.'
      );
      return;
    }

    if (buttonClicked === 'أشارك لاحقاً ⏰') {
      await this.bot.sendMessage(from, '⏰ تمام، سأذكرك خلال الساعات القادمة للعودة للمحادثة.');
      return;
    }

    if (buttonClicked.includes('تخطي')) {
      await this.bot.sendMessage(from, 'تم التخطي ✓');
      return;
    }
  }

  /**
   * Handle general messages
   */
  async handleGeneralMessage(message, guardian) {
    const from = message.from;
    const body = message.body;

    if (await this.handleActiveConversation(message, guardian)) {
      return;
    }

    if (await this.detectFatherPresenceReply(message, guardian)) {
      return;
    }

    if (await this.detectDirectAIChat(message, guardian)) {
      return;
    }

    if (await this.detectInferenceProbe(message, guardian)) {
      return;
    }

    // Log the interaction
    InteractionModel.create(guardian.family_id, guardian.id, 'general', body, null);

    if (await this.detectCoupleFeedback(message, guardian)) {
      return;
    }

    if (await this.detectAndHandleChildIssue(message, guardian)) {
      return;
    }

    if (await this.detectCustomSpiritualRequest(message, guardian)) {
      return;
    }

    // Send acknowledgment
    await this.bot.sendMessage(
      from,
      'شكراً لرسالتك! أنا هنا لمساعدتك. اكتب "مساعدة" لرؤية ما يمكنني فعله.'
    );
  }

  async handleActiveConversation(message, guardian) {
    const body = message.body?.trim();
    if (!body) return false;

    const session = this.dialogueService.getActiveSessionForGuardian(guardian);
    if (!session) return false;

    await this.dialogueService.recordGuardianMessage(session, guardian, body);
    await this.dialogueService.respond(session, guardian, body, { channel: session.type });
    if (session.type === 'inference_probe') {
      InferenceQuestionModel.markAnswered(session.family_id, body);
    }
    return true;
  }

  async detectFatherPresenceReply(message, guardian) {
    if (guardian.role !== 'father') return false;

    const body = message.body?.trim();
    if (!body) return false;

    const normalized = this.normalizeText(body);
    const isHome =
      normalized.includes('في البيت') ||
      normalized.includes('وصلت البيت') ||
      normalized.includes('رجعت');
    const isAway =
      normalized.includes('برا') ||
      normalized.includes('بره') ||
      normalized.includes('الشغل') ||
      normalized.includes('مسافر');

    if (!isHome && !isAway) return false;

    const status = isHome && !isAway ? 'home' : 'away';
    this.presenceService.recordStatus(guardian.id, status, body, 'whatsapp');

    const reply =
      status === 'home'
        ? 'حمد الله على سلامتك! 🎉 سأضبط رسائلي على أنشطتك داخل البيت مع الكثير من الدفء للأم.'
        : 'عارف أنك برة البيت وتعبان علشان العائلة. سأرسل لك أفكار دعم عن بعد ورسائل تقدير لشريكتك. 💙';

    await this.bot.sendMessage(message.from, reply);
    return true;
  }

  async detectDirectAIChat(message, guardian) {
    const body = message.body?.trim();
    if (!body) return false;

    const normalized = this.normalizeText(body);
    const triggers = ['استشارة', 'محادثة', 'حوار', 'اسأل', 'ذكاء', 'ai'];
    const matched = triggers.some(keyword => normalized.includes(this.normalizeText(keyword)));
    if (!matched) return false;

    const guardians = GuardianModel.getByFamily(guardian.family_id) || [];
    const session = this.dialogueService.ensureSession({
      familyId: guardian.family_id,
      type: 'ai_chat',
      topic: 'direct_help',
      participants: guardians.map(member => member.id)
    });

    await this.dialogueService.recordGuardianMessage(session, guardian, body);
    await this.dialogueService.respond(session, guardian, body, { channel: 'ai_chat' });
    return true;
  }

  async detectInferenceProbe(message, guardian) {
    const body = message.body?.trim();
    if (!body) return false;

    const normalized = this.normalizeText(body);
    const triggers = ['استنباط', 'استنتاج', 'قيم', 'استبيان', 'تحليل الوضع'];
    const matched = triggers.some(keyword => normalized.includes(this.normalizeText(keyword)));
    if (!matched) return false;

    const sent = await this.inferenceQuestions.startOnDemand(guardian, body);
    if (sent) {
      await this.bot.sendMessage(
        message.from,
        'سأوجه سؤالاً استنباطياً للأهل بناءً على سجلكم حتى نضبط التوصيات. يمكنك الاستمرار في الردود التفاعلية المعتادة.'
      );
    } else {
      await this.bot.sendMessage(
        message.from,
        'حاولت إطلاق سؤال استنباطي لكن لم أتمكن من ذلك الآن. سأحاول لاحقاً تلقائياً.'
      );
    }
    return true;
  }

  async detectCoupleFeedback(message, guardian) {
    const body = message.body.trim();
    if (!body) return false;

    const normalized = this.normalizeText(body);
    const hasPositive = this.couplePositiveKeywords.some(keyword =>
      normalized.includes(this.normalizeText(keyword))
    );
    const hasNegative = this.coupleNegativeKeywords.some(keyword =>
      normalized.includes(this.normalizeText(keyword))
    );
    if (!hasPositive && !hasNegative) {
      return false;
    }

    const mentionsPartner = this.coupleSubjectKeywords.some(keyword =>
      normalized.includes(this.normalizeText(keyword))
    );
    const replyingToPrompt = this.wasRecentCouplePrompt(guardian.id);
    if (!mentionsPartner && !replyingToPrompt) {
      return false;
    }

    const positivesText = hasPositive ? this.extractPositiveSection(body) : '';
    const challengesText = hasNegative ? this.extractNegativeSection(body) : '';
    const gratitudeText = this.extractGratitudeSection(body);

    if (!positivesText && !challengesText) {
      // fallback to raw body if clearly tied to prompt
      if (!replyingToPrompt) {
        return false;
      }
    }

    const sentiment = hasPositive && hasNegative ? 'mixed' : hasNegative ? 'challenge' : 'positive';

    CoupleFeedbackModel.logEntry({
      familyId: guardian.family_id,
      guardianId: guardian.id,
      partnerRole: guardian.role === 'father' ? 'mother' : 'father',
      sentiment,
      positivesText: positivesText || (hasPositive ? body : ''),
      challengesText: challengesText || (hasNegative ? body : ''),
      gratitudeText,
      source: 'whatsapp'
    });

    const guardians = GuardianModel.getByFamily(guardian.family_id) || [];
    const session = this.dialogueService.ensureSession({
      familyId: guardian.family_id,
      type: 'couple_feedback',
      topic: 'weekly_checkin',
      participants: guardians.map(member => member.id),
      metadata: { sentiment }
    });

    await this.dialogueService.recordGuardianMessage(session, guardian, body);
    await this.dialogueService.respond(session, guardian, body, { channel: 'couple_feedback' });

    return true;
  }

  /**
   * Detect if a message contains a child complaint and trigger tracking flow
   */
  async detectAndHandleChildIssue(message, guardian) {
    const body = message.body.trim();
    if (!body) {
      return false;
    }

    const normalized = this.normalizeText(body);

    // Handle explicit "no issues" confirmations
    if (this.noIssueKeywords.some(keyword => normalized.includes(this.normalizeText(keyword)))) {
      await this.bot.sendMessage(message.from, 'سعيد لسماع أن كل شيء بخير! ✅ استمروا على هذا المنوال.');
      return true;
    }

    const hasIssueKeyword = this.issueKeywords.some(keyword => normalized.includes(this.normalizeText(keyword)));
    if (!hasIssueKeyword) {
      return false;
    }

    const children = ChildModel.getByFamily(guardian.family_id);
    if (!children.length) {
      await this.bot.sendMessage(
        message.from,
        'التقطت وجود مشكلة ولكن لم أجد بيانات للأطفال في سجلكم بعد. من فضلك أرسل اسم وتاريخ ميلاد الطفل ليتم التتبع الذكي. 👶'
      );
      return true;
    }

    const matchedChild = children.find(child => normalized.includes(this.normalizeText(child.name)));

    if (!matchedChild) {
      const childNames = children.map(child => child.name).join('، ');
      await this.bot.sendMessage(
        message.from,
        `فهمت أن هناك مشكلة. من فضلك اذكر اسم الطفل بشكل صريح (${childNames}) حتى أستطيع تجهيز خطة متابعة دقيقة. 📝`
      );
      return true;
    }

    try {
      const result = await this.childIssueService.processIssueReport(
        guardian.family_id,
        matchedChild.name,
        body
      );

      if (result.success) {
        const responseText = `✅ تم تسجيل المشكلة لطفلك ${matchedChild.name}.\n\n${result.message}\n\nسأرسل لك تذكيرات يومية لمتابعة التحسن. يمكنك الرد بكلمة "تحسن" أو "لا تحسن" لتحديث الحالة.`;
        await this.bot.sendMessage(message.from, responseText);

        const guardians = GuardianModel.getByFamily(guardian.family_id) || [];
        const session = this.dialogueService.ensureSession({
          familyId: guardian.family_id,
          type: 'child_issue',
          topic: `issue_${result.issueId || matchedChild.name}`,
          participants: guardians.map(member => member.id),
          metadata: { issueId: result.issueId, child: matchedChild.name }
        });
        await this.dialogueService.recordGuardianMessage(session, guardian, body);
        await this.dialogueService.appendAssistantMessage(session, responseText);
      } else {
        await this.bot.sendMessage(
          message.from,
          result.message || 'تعذر تسجيل المشكلة حالياً، حاول مرة أخرى لو سمحت.'
        );
      }
    } catch (error) {
      console.error('Error handling child issue report:', error);
      await this.bot.sendMessage(
        message.from,
        '❌ حدث خطأ أثناء معالجة البلاغ. سأحاول مرة أخرى لاحقاً أو يمكنك إعادة الإرسال.'
      );
    }

    return true;
  }

  async detectCustomSpiritualRequest(message, guardian) {
    const body = message.body.trim();
    if (!body) return false;

    const normalized = this.normalizeText(body);
    const wantsNewPrayer =
      normalized.includes('دعاء') &&
      (normalized.includes('جديد') || normalized.includes('تاني') || normalized.includes('اضاف'));
    const wantsStory =
      normalized.includes('قصة') &&
      (normalized.includes('جديد') || normalized.includes('تاني') || normalized.includes('بكره'));

    if (!wantsNewPrayer && !wantsStory) {
      return false;
    }

    const family = FamilyModel.getById(guardian.family_id);
    const children = ChildModel.getByFamily(guardian.family_id);
    const child = children[0] || null;
    const type = wantsStory ? 'story' : 'prayer';

    await this.bot.sendMessage(message.from, '✍️ جاري إعداد محتوى روحاني جديد لكم.');

    try {
      const result = await this.spiritualService.generateCustomContent({
        guardian,
        family,
        child,
        requestText: body,
        type
      });

      if (result?.text) {
        await this.spiritualService.sendCustomContent({
          guardian,
          family,
          text: result.text,
          buttons: this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰', 'بدّل التوقيت 🔄', 'تخطي ⏭️']
        });
      } else {
        await this.bot.sendMessage(
          message.from,
          'تعذر إنشاء المحتوى الآن، حاولوا مرة أخرى بعد قليل.'
        );
      }
    } catch (error) {
      console.error('Error generating custom spiritual request:', error);
      await this.bot.sendMessage(
        message.from,
        'حدث خطأ غير متوقع أثناء إنشاء الذكر. أعد المحاولة في وقت لاحق.'
      );
    }

    return true;
  }

  extractPositiveSection(text) {
    return this.extractSection(text, /(إيجابيات?|الايجابيات|اجمل ما فيه|احب فيه)/i);
  }

  extractNegativeSection(text) {
    return this.extractSection(text, /(سلبيات?|السلبيات|عيوب|ملاحظات سلبية|شكوى زوجية)/i);
  }

  extractGratitudeSection(text) {
    return this.extractSection(text, /(شكراً|شكرا|امتنان|ممتن|شاكرة)/i, true);
  }

  extractSection(text, regex, singleLine = false) {
    if (!text) return '';
    const match = text.match(regex);
    if (!match) return '';
    const after = text.slice(match.index + match[0].length);
    let section = after.split(/(?:\n\s*\n|\n\s*[-•]|سلبيات|السلبيات|إيجابيات|الايجابيات)/i)[0];
    if (singleLine) {
      section = section.split(/\n|\./)[0];
    }
    return section.trim();
  }

  wasRecentCouplePrompt(guardianId) {
    if (!guardianId) return false;
    const interactions = InteractionModel.getByGuardian(guardianId, 6);
    if (!interactions?.length) return false;
    const cutoff = Date.now() - 1000 * 60 * 60 * 72; // 3 أيام
    return interactions.some((interaction) => {
      if (!interaction.message_type?.startsWith('couple_feedback')) return false;
      const created = interaction.created_at ? new Date(interaction.created_at).getTime() : 0;
      return created >= cutoff;
    });
  }

  async generateFollowUpSpiritualContent(
    from,
    guardian,
    interaction,
    buttonClicked,
    type = 'prayer',
    hint = ''
  ) {
    const family = FamilyModel.getById(guardian.family_id);
    const children = ChildModel.getByFamily(guardian.family_id);
    const child = children[0] || null;
    const baseMessage = this.cleanInteractionMessage(interaction.message_content);
    const requestText = hint || `${buttonClicked} - محتوى مرتبط بالرسالة التالية:\n${baseMessage}`;

    await this.bot.sendMessage(from, '⏳ لحظة... أجهز استكمالاً ملهماً لهذا الذكر.');

    try {
      const result = await this.spiritualService.generateCustomContent({
        guardian,
        family,
        child,
        requestText,
        type
      });

      if (result?.text) {
        await this.spiritualService.sendCustomContent({
          guardian,
          family,
          text: result.text,
          buttons: this.config.ui?.buttons || ['تم ✅', 'ذكّرني لاحقاً ⏰', 'بدّل التوقيت 🔄', 'تخطي ⏭️']
        });
      } else {
        await this.bot.sendMessage(
          from,
          'لم أتمكن من إنشاء محتوى إضافي الآن. حاول مرة أخرى لاحقاً.'
        );
      }
    } catch (error) {
      console.error('Error generating follow-up spiritual content:', error);
      await this.bot.sendMessage(
        from,
        'حدث خطأ أثناء إنشاء المحتوى الإضافي. أعد المحاولة لاحقاً.'
      );
    }
  }

  cleanInteractionMessage(content) {
    if (!content) return '';
    return content
      .split('\n')
      .filter(line => !/^\d+\.\s+/.test(line.trim()))
      .join('\n')
      .trim();
  }

  extractButtonsFromInteraction(content) {
    if (!content) return [];
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => /^\d+\.\s+/.test(line))
      .map(line => line.replace(/^\d+\.\s+/, '').trim());
  }

  normalizeText(text) {
    return text
      .toString()
      .toLowerCase()
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
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
4️⃣ تخطي: تجاوز الرسالة إذا لم تكن مناسبة الآن

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
    const buttonKeywords = ['تم', 'ذكرني', 'بدل', 'تخطي'];
    return /^[1-4]$/.test(body) || buttonKeywords.some(kw => body.includes(kw));
  }
}

export default MessageHandler;
