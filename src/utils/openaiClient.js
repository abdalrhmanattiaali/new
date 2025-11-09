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

      const response = await this.client.chat.completions.create({
        model,
        max_completion_tokens: maxTokens,
        temperature,
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
      });

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

      const response = await this.client.chat.completions.create({
        model,
        max_completion_tokens: maxTokens,
        temperature,
        messages: formattedMessages
      });

      return response.choices[0].message.content;

    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
}

export default OpenAIClient;
