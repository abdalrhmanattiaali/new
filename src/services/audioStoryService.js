/**
 * Audio Story Service
 * خدمة القصص الصوتية اليومية للأطفال
 */

import axios from 'axios';
import { format, differenceInMonths, differenceInCalendarDays, subDays } from 'date-fns';

import {
  FamilyModel,
  GuardianModel,
  ChildModel,
  ChildAudioStoryModel,
  CoupleFeedbackModel,
  InteractionModel
} from '../database/models.js';
import { getDatabase } from '../database/init.js';
import { LLMService } from '../ai/llm.js';

export class AudioStoryService {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.llm = new LLMService(config);
    this.apiKey = global.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
    this.voiceId = config.audio_stories?.voice_id || process.env.ELEVENLABS_VOICE_ID || 'haytham-conversation';
    this.modelId = config.audio_stories?.model_id || 'eleven_monolingual_v3';
    this.stability = typeof config.audio_stories?.stability === 'number' ? config.audio_stories.stability : 0.3;
    this.similarity = typeof config.audio_stories?.similarity === 'number' ? config.audio_stories.similarity : 0.75;
    this.style = config.audio_stories?.style || 'Creative';
    this.historyDays = config.audio_stories?.history_days || 14;
    this.minGapDays = config.audio_stories?.min_gap_days || 1;
    this.db = getDatabase();

    if (this.voiceId === 'haytham-conversation') {
      console.log('ℹ️ Using ElevenLabs voice "Haytham - Conversation" (ensure the voice_id matches your ElevenLabs account).');
    }
  }

  async sendDailyAudioStories() {
    if (this.config.audio_stories?.enabled === false) {
      console.log('ℹ️ Audio stories are disabled in configuration.');
      return;
    }

    if (!this.apiKey || this.apiKey.includes('PLACEHOLDER')) {
      console.warn('⚠️ ELEVENLABS_API_KEY is missing. Skipping audio stories.');
      return;
    }

    console.log('🎧 Generating bedtime audio stories...');

    const families = FamilyModel.getAll();
    const today = format(new Date(), 'yyyy-MM-dd');
    const historyThreshold = format(subDays(new Date(), this.historyDays), 'yyyy-MM-dd');

    for (const family of families) {
      if (!family.onboarding_completed) {
        continue;
      }

      const children = ChildModel.getByFamily(family.id);
      if (!children.length) {
        continue;
      }

      const guardians = GuardianModel.getByFamily(family.id).filter((guardian) => guardian.phone_number);

      for (const child of children) {
        try {
          const existingToday = ChildAudioStoryModel.getByChildAndDate(child.id, today);
          if (existingToday) {
            console.log(`ℹ️ Story for child ${child.name} already generated today. Skipping.`);
            continue;
          }

          const previousStories = ChildAudioStoryModel.getRecent(child.id, {
            limit: 7,
            sinceDate: historyThreshold
          });

          if (previousStories.length && this.minGapDays > 1) {
            const lastStoryDate = new Date(previousStories[0].generated_for);
            const daysSince = differenceInCalendarDays(new Date(), lastStoryDate);
            if (daysSince < this.minGapDays) {
              console.log(`ℹ️ Skipping story for ${child.name}; last story sent ${daysSince} day(s) ago.`);
              continue;
            }
          }

          const storyPlan = await this.generateStoryForChild(family, child, guardians, previousStories);
          if (!storyPlan) {
            console.warn(`⚠️ Failed to generate story plan for ${child.name}.`);
            continue;
          }

          const audioBuffer = await this.synthesizeStoryAudio(storyPlan.script);
          if (!audioBuffer) {
            console.warn(`⚠️ Failed to synthesize audio for ${child.name}. Sending text fallback.`);
            await this.deliverTextFallback(family, guardians, storyPlan);
            continue;
          }

          await this.deliverStory(family, guardians, child, storyPlan, audioBuffer);

          ChildAudioStoryModel.create({
            childId: child.id,
            familyId: family.id,
            storyTitle: storyPlan.title,
            storySummary: storyPlan.summary,
            storyText: storyPlan.script,
            durationSeconds: storyPlan.durationSeconds,
            voiceId: this.voiceId,
            modelId: this.modelId,
            generatedFor: today
          });

          await this.sleep(1200);
        } catch (error) {
          console.error(`❌ Error creating audio story for ${child.name}:`, error);
        }
      }
    }

    console.log('✅ Finished generating bedtime audio stories.');
  }

  async generateStoryForChild(family, child, guardians, previousStories = []) {
    const childAgeMonths = this.calculateAgeInMonths(child.birth_date);
    const childAgeLabel = this.formatAge(childAgeMonths);
    const childDay = this.calculateDayOfLife(child.birth_date);
    const guardianName = guardians?.[0]?.name || family.family_name || 'الأسرة';
    const activeIssues = this.getActiveChildIssues(child.id);
    const notificationStats = InteractionModel.getFamilyNotificationStats(family.id, 'audio_story', 60);

    const previousInteractions = previousStories.map((story) => ({
      message_type: 'audio_story',
      message_content: `عنوان: ${story.story_title}\nخلاصة: ${story.story_summary || this.safeTruncate(story.story_text, 180)}`,
      created_at: story.generated_for
    }));

    const previousHighlights = previousStories
      .map((story) => `• ${story.story_title}`)
      .join('\n');

    const relationshipInsights = CoupleFeedbackModel.getRecentByFamily(
      family.id,
      this.config.couple_feedback?.history_window || 6
    );

    const additionalContextParts = [
      `القصة موجهة للاستماع قبل النوم لتعزيز عادة السماع لدى الطفل ${child.name}.`,
      `احرص على أن تتراوح مدة القصة بين 2 و5 دقائق مع إيقاع هادئ ونبرة حنونة.`,
      `استخدم لغة عربية فصحى بسيطة مع بعض التعابير العامية الخفيفة إذا لزم الأمر.`
    ];

    if (childAgeMonths !== null) {
      additionalContextParts.push(`العمر التقريبي للطفل: ${childAgeLabel}. ركز على موضوع يناسب هذا العمر.`);
    }

    if (previousHighlights) {
      additionalContextParts.push(`تجنب تكرار الأفكار أو العناوين التالية:\n${previousHighlights}`);
    }

    if (activeIssues.length) {
      const issueSummary = activeIssues
        .map((issue) => `${issue.issue_title} (الحالة: ${issue.status || 'active'})`)
        .join('، ');
      additionalContextParts.push(`يرجى مراعاة أن هناك تحديات حالية: ${issueSummary}. اجعل القصة داعمة وهادئة.`);
    }

    const additionalContext = additionalContextParts.join('\n');

    const baseContext = {
      messageType: 'audio_story',
      guardianName,
      childName: child.name,
      childAge: childAgeLabel,
      timeOfDay: 'evening',
      additionalContext,
      previousInteractions,
      activeIssues,
      notificationStats,
      childDay,
      preferredFormat: 'audio_story',
      configFormats: this.config.tracks?.formats || [],
      relationshipInsights,
      familyId: family.id
    };

    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await this.llm.generateMessage(baseContext);
      const storyData = this.parseStoryResponse(response);

      if (!storyData || !storyData.script) {
        console.warn('⚠️ LLM returned invalid story payload.');
        continue;
      }

      const normalizedScript = storyData.script.trim();
      const duplicate = ChildAudioStoryModel.findByHash(child.id, normalizedScript);
      if (duplicate) {
        console.warn('⚠️ Generated story matches a previous story. Retrying with stronger anti-duplication hint.');
        baseContext.additionalContext += '\nرجاء ابتكر حبكة جديدة مختلفة تماماً عن القصص السابقة. تجنب أي تشابه حرفي.';
        continue;
      }

      const durationSeconds = storyData.durationSeconds || this.estimateDurationFromText(normalizedScript);

      return {
        title: storyData.title,
        summary: storyData.summary || storyData.synopsis || '',
        script: normalizedScript,
        moral: storyData.moral || '',
        durationSeconds,
        estimatedMinutes: storyData.estimatedMinutes || null
      };
    }

    return null;
  }

  parseStoryResponse(response) {
    if (!response) return null;

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('⚠️ Unable to find JSON payload in LLM response.');
      return null;
    }

    try {
      const data = JSON.parse(jsonMatch[0]);
      if (!data.title || !data.script) {
        return null;
      }

      const durationMinutes = Number(data.estimated_duration_minutes || data.estimatedMinutes || 0);

      return {
        title: data.title,
        summary: data.summary || data.synopsis || '',
        script: (data.script || '').trim(),
        moral: data.moral || '',
        durationSeconds: durationMinutes ? Math.round(durationMinutes * 60) : null,
        estimatedMinutes: durationMinutes || null
      };
    } catch (error) {
      console.error('❌ Failed to parse story JSON:', error);
      return null;
    }
  }

  async synthesizeStoryAudio(text) {
    if (!text) return null;

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        {
          model_id: this.modelId,
          text,
          voice_settings: {
            stability: this.stability,
            similarity_boost: this.similarity,
            style: this.style,
            use_speaker_boost: true
          },
          output_format: 'mp3_44100_128'
        },
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg'
          },
          responseType: 'arraybuffer'
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      console.error('❌ Error synthesizing audio with ElevenLabs:', error.response?.data || error.message);
      return null;
    }
  }

  async deliverStory(family, guardians, child, storyPlan, audioBuffer) {
    const recipients = this.getRecipients(family, guardians);
    if (!recipients.length) {
      console.warn(`⚠️ No recipients found for family ${family.family_name}.`);
      return;
    }

    const captionLines = [
      `🎧 *قصة قبل النوم لـ ${child.name}*`,
      `العنوان: ${storyPlan.title}`
    ];

    if (storyPlan.moral) {
      captionLines.push(`العبرة: ${storyPlan.moral}`);
    }

    const durationMinutes = storyPlan.durationSeconds ? Math.round(storyPlan.durationSeconds / 60) : null;
    if (durationMinutes) {
      captionLines.push(`المدة التقريبية: ${durationMinutes} دقيقة`);
    } else {
      captionLines.push('المدة التقريبية: بين 2 و5 دقائق');
    }

    captionLines.push('استمعوا معها قبل النوم وعزّزوا عادة السماع الهادئ 💙');

    const caption = captionLines.join('\n');

    const filename = `bedtime-story-${child.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.mp3`;

    for (const recipient of recipients) {
      try {
        await this.bot.sendAudioMessage(recipient.id, audioBuffer, filename, caption, {
          sendAudioAsVoice: true
        });
        await this.bot.sendMessage(recipient.id, `📖 نص القصة:\n${storyPlan.script}`);
        await this.sleep(800);
      } catch (error) {
        console.error(`❌ Failed to deliver audio story to ${recipient.id}:`, error);
      }
    }
  }

  async deliverTextFallback(family, guardians, storyPlan) {
    const recipients = this.getRecipients(family, guardians);
    if (!recipients.length) return;

    const textMessage = `🎧 *قصة قبل النوم*\nالعنوان: ${storyPlan.title}\nالمدة التقريبية: ${storyPlan.estimatedMinutes || '3'} دقائق\n\n${storyPlan.script}`;

    for (const recipient of recipients) {
      try {
        await this.bot.sendMessage(recipient.id, textMessage);
        await this.sleep(600);
      } catch (error) {
        console.error(`❌ Failed to deliver text fallback to ${recipient.id}:`, error);
      }
    }
  }

  getRecipients(family, guardians) {
    if (family.send_to_group && family.family_group_id) {
      return [{ id: family.family_group_id }];
    }

    const unique = new Set();
    const recipients = [];

    guardians.forEach((guardian) => {
      if (!guardian.phone_number) return;
      const id = guardian.phone_number;
      if (unique.has(id)) return;
      unique.add(id);
      recipients.push({ id });
    });

    return recipients;
  }

  getActiveChildIssues(childId) {
    return this.db
      .prepare(
        `SELECT issue_title, severity, status
         FROM child_issues
         WHERE child_id = ? AND (status IS NULL OR status NOT IN ('resolved', 'closed'))
         ORDER BY updated_at DESC
         LIMIT 5`
      )
      .all(childId);
  }

  calculateAgeInMonths(birthDate) {
    if (!birthDate) return null;
    try {
      return differenceInMonths(new Date(), new Date(birthDate));
    } catch (error) {
      return null;
    }
  }

  calculateDayOfLife(birthDate) {
    if (!birthDate) return null;
    try {
      const diff = differenceInCalendarDays(new Date(), new Date(birthDate));
      return diff + 1;
    } catch (error) {
      return null;
    }
  }

  formatAge(ageMonths) {
    if (ageMonths === null || Number.isNaN(ageMonths)) {
      return 'غير معروف';
    }

    if (ageMonths < 12) {
      return `${ageMonths} شهر`; 
    }

    const years = Math.floor(ageMonths / 12);
    const months = ageMonths % 12;
    if (months === 0) {
      return `${years} سنة`;
    }
    return `${years} سنة و ${months} شهر`;
  }

  estimateDurationFromText(text) {
    if (!text) return 180;
    const wordCount = text.split(/\s+/).length;
    const minutes = Math.max(2, Math.min(5, wordCount / 150));
    return Math.round(minutes * 60);
  }

  safeTruncate(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 3)}...`;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
