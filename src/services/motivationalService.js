/**
 * Motivational & Parenting Tips Service
 * خدمة الرسائل التحفيزية والنصائح التربوية
 */

import { getDatabase } from '../database/init.js';
import { GuardianModel, ChildModel, FamilyModel } from '../database/models.js';
import { LLMService } from '../ai/llm.js';
import { format, differenceInMonths } from 'date-fns';

export class MotivationalService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
  }

  /**
   * Send daily motivational message
   */
  async sendDailyMotivation(familyId) {
    const guardians = GuardianModel.getByFamily(familyId);
    if (guardians.length === 0) return;

    const family = FamilyModel.getById(familyId);

    for (const guardian of guardians) {
      const message = await this.generateMotivationalMessage(guardian);

      // Check if should send to group or individual
      if (family.send_to_group && family.family_group_id) {
        // Send once to group (for first guardian only)
        if (guardian.id === guardians[0].id) {
          await this.bot.sendMessage(family.family_group_id, message);
        }
      } else {
        await this.bot.sendMessage(guardian.phone_number, message);
      }

      // Save to database
      this.saveMotivationalMessage(guardian.id, 'encouragement', message);

      await this.sleep(1000);
    }
  }

  /**
   * Generate motivational message
   */
  async generateMotivationalMessage(guardian) {
    const role = guardian.role === 'father' ? 'الأب' : 'الأم';
    const timeOfDay = this.getTimeOfDay();

    const prompt = `
اكتب رسالة تحفيزية دافئة وقصيرة (3-4 أسطر) لـ${role}.

الرسالة يجب أن:
- تكون دافئة ومشجعة
- تعترف بالجهد والتعب
- تذكّر بأهمية دوره/دورها
- تعطي أمل وطاقة إيجابية

أمثلة للمواضيع:
- تقدير الجهد اليومي
- أهمية الصبر
- قوة الحب والحضور
- النمو مع الأطفال
- الاعتناء بالنفس
    `.trim();

    try {
      const message = await this.llm.generateMessage({
        messageType: 'motivational',
        guardianName: guardian.name,
        childName: '',
        childAge: '',
        timeOfDay,
        additionalContext: prompt
      });

      return `💙 *رسالة اليوم*\n\n${message}`;

    } catch (error) {
      console.error('Error generating motivational message:', error);
      return this.getDefaultMotivationalMessage(guardian.role, timeOfDay);
    }
  }

  /**
   * Get default motivational messages
   */
  getDefaultMotivationalMessage(role, timeOfDay) {
    const messages = {
      father: [
        'أنت أب رائع! وجودك في حياة طفلك يصنع فرقاً كبيراً. استمر في العطاء، فكل لحظة تقضيها معه هي استثمار في مستقبله.',
        'الأبوة ليست عن الكمال، بل عن الحضور والمحاولة. أنت تقوم بعمل رائع حتى في الأيام الصعبة.',
        'قوتك ليست في عدم الشعور بالتعب، بل في الاستمرار رغمه. طفلك محظوظ بك.',
        'كل يوم تتعلم شيئاً جديداً في رحلة الأبوة. هذا النمو المستمر هو ما يجعلك أباً مميزاً.'
      ],
      mother: [
        'أنتِ أم رائعة! حبك وصبرك يبنيان أساساً قوياً لطفلك. كل جهد صغير تبذلينه له أثر كبير.',
        'الأمومة تحدٍ كبير، وأنتِ تواجهينه ببطولة كل يوم. لا تنسي أن تعتني بنفسك أيضاً.',
        'في اللحظات الصعبة، تذكري: أنتِ تفعلين ما في وسعك، وهذا أكثر من كافٍ.',
        'حضورك في حياة طفلك هو أعظم هدية. استمري في العطاء، فأنتِ تصنعين ذكريات تدوم للأبد.'
      ]
    };

    const roleMessages = messages[role] || messages.mother;
    const randomMessage = roleMessages[Math.floor(Math.random() * roleMessages.length)];

    return `💙 *رسالة ${timeOfDay}*\n\n${randomMessage}`;
  }

  /**
   * Generate parenting tip based on child age
   */
  async generateParentingTip(familyId) {
    const db = getDatabase();
    const children = ChildModel.getByFamily(familyId);

    if (children.length === 0) return null;

    const child = children[0];
    const ageMonths = differenceInMonths(new Date(), new Date(child.birth_date));

    // Check if we already have a recent tip
    const recentTip = db.prepare(`
      SELECT * FROM parenting_tips
      WHERE family_id = ? AND shown = 0
      ORDER BY created_at DESC
      LIMIT 1
    `).get(familyId);

    if (recentTip) {
      return this.formatParentingTip(recentTip);
    }

    // Generate new tip
    const tip = await this.generateAgeTip(child, ageMonths);

    if (!tip) return null;

    // Save to database
    db.prepare(`
      INSERT INTO parenting_tips (
        family_id, child_age_months, category, tip_content, source, relevance_score
      ) VALUES (?, ?, ?, ?, 'ai', 0.9)
    `).run(familyId, ageMonths, tip.category, tip.content);

    return tip.content;
  }

  /**
   * Generate age-appropriate parenting tip
   */
  async generateAgeTip(child, ageMonths) {
    const ageRange = this.getAgeRange(ageMonths);

    const prompt = `
اكتب نصيحة تربوية واحدة عملية وقصيرة (2-3 أسطر) لطفل عمره ${this.formatAge(ageMonths)}.

المرحلة العمرية: ${ageRange}

النصيحة يجب أن:
- تكون مناسبة للعمر
- عملية وسهلة التطبيق
- مبنية على علم التربية
- تركز على موضوع واحد

اختر من المواضيع:
- التواصل والتفاعل
- التأديب الإيجابي
- تطوير المهارات
- النوم والروتين
- التغذية
- اللعب والتعلم
    `.trim();

    try {
      const tipContent = await this.llm.generateMessage({
        messageType: 'parenting_tip',
        guardianName: 'الوالدين',
        childName: child.name,
        childAge: this.formatAge(ageMonths),
        timeOfDay: '',
        additionalContext: prompt
      });

      return {
        category: 'general',
        content: tipContent
      };

    } catch (error) {
      console.error('Error generating parenting tip:', error);
      return this.getDefaultParentingTip(ageMonths);
    }
  }

  /**
   * Get default parenting tips
   */
  getDefaultParentingTip(ageMonths) {
    const tips = {
      '0-6': {
        category: 'bonding',
        content: 'التواصل البصري مع طفلك أثناء الرضاعة أو التغيير يقوي الرابطة العاطفية ويساعد في تطوره الاجتماعي.'
      },
      '6-12': {
        category: 'development',
        content: 'شجّع طفلك على الاستكشاف الآمن. الحبو واللمس والتذوق (بإشراف) كلها طرق طبيعية للتعلم في هذا العمر.'
      },
      '12-24': {
        category: 'communication',
        content: 'تحدث مع طفلك باستمرار، اشرح له ما تفعل وسمّي الأشياء. هذا يبني مخزونه اللغوي حتى لو لم يتكلم بعد.'
      },
      '24-36': {
        category: 'discipline',
        content: 'نوبات الغضب طبيعية في هذا العمر. حافظ على هدوئك، قدم خيارات محدودة، وكن ثابتاً في القواعد.'
      },
      '36+': {
        category: 'independence',
        content: 'شجّع الاستقلالية بمهام بسيطة (ترتيب الألعاب، ارتداء الملابس). هذا يبني ثقته بنفسه ومهاراته.'
      }
    };

    const range = this.getAgeRange(ageMonths);
    return tips[range] || tips['12-24'];
  }

  /**
   * Send parenting tip
   */
  async sendParentingTip(familyId) {
    const family = FamilyModel.getById(familyId);
    const guardians = GuardianModel.getByFamily(familyId);

    if (guardians.length === 0) return;

    const tip = await this.generateParentingTip(familyId);

    if (!tip) return;

    const tipMessage = `
💡 *نصيحة تربوية*

${tip}

---
هل كانت هذه النصيحة مفيدة؟
رد بـ "مفيدة" أو "طبّقتها" أو "غير مفيدة"
    `.trim();

    // Send to group or individuals
    if (family.send_to_group && family.family_group_id) {
      await this.bot.sendMessage(family.family_group_id, tipMessage);
    } else {
      for (const guardian of guardians) {
        await this.bot.sendMessage(guardian.phone_number, tipMessage);
        await this.sleep(1000);
      }
    }

    // Mark as shown
    const db = getDatabase();
    db.prepare(`
      UPDATE parenting_tips
      SET shown = 1, shown_date = ?
      WHERE family_id = ? AND shown = 0
      ORDER BY created_at DESC
      LIMIT 1
    `).run(format(new Date(), 'yyyy-MM-dd'), familyId);
  }

  /**
   * Save motivational message
   */
  saveMotivationalMessage(guardianId, messageType, content) {
    const db = getDatabase();

    db.prepare(`
      INSERT INTO motivational_messages (
        guardian_id, message_type, message_content, sent_date
      ) VALUES (?, ?, ?, ?)
    `).run(guardianId, messageType, content, format(new Date(), 'yyyy-MM-dd'));
  }

  /**
   * Get age range category
   */
  getAgeRange(months) {
    if (months < 6) return '0-6';
    if (months < 12) return '6-12';
    if (months < 24) return '12-24';
    if (months < 36) return '24-36';
    return '36+';
  }

  /**
   * Format age
   */
  formatAge(months) {
    if (months < 12) return `${months} شهر`;
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : `${years} سنوات`;
    }
    return `${years} سنة و${remainingMonths} شهر`;
  }

  /**
   * Get time of day
   */
  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'الصباح';
    if (hour < 17) return 'الظهر';
    return 'المساء';
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send daily motivation to all families
   */
  async sendDailyMotivationToAllFamilies() {
    console.log('💙 Sending daily motivational messages to all families...');

    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        await this.sendDailyMotivation(family.id);
      } catch (error) {
        console.error(`Error sending motivation to family ${family.id}:`, error);
      }
    }

    console.log('✅ Daily motivational messages sent');
  }

  /**
   * Send parenting tips to all families
   */
  async sendParentingTipsToAllFamilies() {
    console.log('💡 Sending parenting tips to all families...');

    const families = FamilyModel.getAll();

    for (const family of families) {
      if (!family.onboarding_completed) continue;

      try {
        await this.sendParentingTip(family.id);
      } catch (error) {
        console.error(`Error sending parenting tip to family ${family.id}:`, error);
      }
    }

    console.log('✅ Parenting tips sent');
  }
}

export default MotivationalService;
