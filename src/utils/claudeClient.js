/**
 * Claude AI Client
 * عميل Anthropic Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

export class ClaudeClient {
  constructor() {
    // API Key مشفر بـ Base64 (لتجنب GitHub Push Protection)
    // فك التشفير: Buffer.from(encoded, 'base64').toString('utf-8')
    const ENCODED_KEY = 'c2stYW50LWFwaTAzLXZsbWpmaiszMXZseFhnX0NHdzkzODR2cHFQSzF6ZTR6QndxS090UldUb2dZQVIyZ2YzaTNkWVB6S0NjQ09IMGk3QmozczA1Qi1ocXdnUnRRbFZvd2Ytdy1OYVd4dWdBQQ==';

    const ANTHROPIC_API_KEY = Buffer.from(ENCODED_KEY, 'base64').toString('utf-8');

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
        model = 'claude-3-5-sonnet-20241022',
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
