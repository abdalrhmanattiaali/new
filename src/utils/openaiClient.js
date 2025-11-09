/**
 * OpenAI Client
 * عميل OpenAI ChatGPT API
 */

import OpenAI from 'openai';

export class OpenAIClient {
  constructor() {
    // API Key يُقرأ من ملف index.js (global.OPENAI_API_KEY)
    // يمكنك تعديله مباشرة من أول ملف src/index.js
    const OPENAI_API_KEY = global.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('PLACEHOLDER')) {
      throw new Error('❌ يرجى تعديل OPENAI_API_KEY في ملف src/index.js واستبداله بـ API Key الصحيح من OpenAI');
    }

    this.client = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
  }

  /**
   * Generate text using ChatGPT
   */
  async generateText(systemPrompt, userPrompt, options = {}) {
    try {
      const {
        model = 'gpt-5',
        maxTokens = 1024,
        temperature = 0.7
      } = options;

      // GPT-5 لا يدعم temperature مخصص - يستخدم القيمة الافتراضية 1 فقط
      const requestParams = {
        model,
        max_completion_tokens: maxTokens,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userPrompt
          }
        ]
      };

      // إضافة temperature فقط للموديلات التي تدعمه (ليس GPT-5)
      if (!model.startsWith('gpt-5')) {
        requestParams.temperature = temperature;
      }

      const response = await this.client.chat.completions.create(requestParams);

      return response.choices[0].message.content;

    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }

  /**
   * Generate text with conversation history
   */
  async generateWithHistory(systemPrompt, messages, options = {}) {
    try {
      const {
        model = 'gpt-5',
        maxTokens = 1024,
        temperature = 0.7
      } = options;

      const formattedMessages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...messages
      ];

      // GPT-5 لا يدعم temperature مخصص - يستخدم القيمة الافتراضية 1 فقط
      const requestParams = {
        model,
        max_completion_tokens: maxTokens,
        messages: formattedMessages
      };

      // إضافة temperature فقط للموديلات التي تدعمه (ليس GPT-5)
      if (!model.startsWith('gpt-5')) {
        requestParams.temperature = temperature;
      }

      const response = await this.client.chat.completions.create(requestParams);

      return response.choices[0].message.content;

    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
}

export default OpenAIClient;
