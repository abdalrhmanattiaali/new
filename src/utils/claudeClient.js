/**
 * Claude AI Client
 * عميل Anthropic Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

export class ClaudeClient {
  constructor() {
    // API Key يُقرأ من ملف index.js (global.ANTHROPIC_API_KEY)
    // يمكنك تعديله مباشرة من أول ملف src/index.js
    const ANTHROPIC_API_KEY = global.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.includes('PLACEHOLDER')) {
      throw new Error('❌ يرجى تعديل ANTHROPIC_API_KEY في ملف src/index.js واستبداله بـ API Key الصحيح من Anthropic');
    }

    this.client = new Anthropic({
      apiKey: ANTHROPIC_API_KEY
    });
  }

  /**
   * Generate text using Claude
   */
  async generateText(systemPrompt, userPrompt, options = {}) {
    try {
      const {
        model = 'claude-3-5-sonnet-20240620',
        maxTokens = 1024,
        temperature = 0.7
      } = options;

      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      return response.content[0].text;

    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw error;
    }
  }

  /**
   * Generate text with conversation history
   */
  async generateWithHistory(systemPrompt, messages, options = {}) {
    try {
      const {
        model = 'claude-3-5-sonnet-20241022',
        maxTokens = 1024,
        temperature = 0.7
      } = options;

      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages
      });

      return response.content[0].text;

    } catch (error) {
      console.error('Error calling Claude API:', error);
      throw error;
    }
  }
}

export default ClaudeClient;
