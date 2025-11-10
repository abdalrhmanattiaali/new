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
   * Generate text using OpenAI (GPT-5 uses Responses API, others use Chat Completions)
   */
  async generateText(systemPrompt, userPrompt, options = {}) {
    try {
      const {
        model = 'gpt-5',
        maxTokens = 1024,
        temperature = 0.7
      } = options;

      // GPT-5 uses Responses API (/v1/responses)
      if (model.startsWith('gpt-5')) {
        const requestParams = {
          model,
          max_output_tokens: maxTokens,
          input: `${systemPrompt}\n\n${userPrompt}`
        };

        const response = await this.client.responses.create(requestParams);

        // Primary method: use output_text (available in root of response)
        if (response.output_text && response.output_text.trim()) {
          return response.output_text;
        }

        // Fallback: search for message in output array
        if (response.output && Array.isArray(response.output)) {
          const messageOutput = response.output.find(item => item.type === 'message');
          if (messageOutput?.content?.[0]?.text) {
            return messageOutput.content[0].text;
          }
        }

        // If status is incomplete, throw specific error
        if (response.status === 'incomplete') {
          const reason = response.incomplete_details?.reason || 'unknown';
          throw new Error(`GPT-5 response incomplete: ${reason}. Try increasing max_output_tokens.`);
        }

        throw new Error('No text output from GPT-5: ' + JSON.stringify(response));
      }

      // Other models use Chat Completions API (/v1/chat/completions)
      const requestParams = {
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
      };

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

      // GPT-5 uses Responses API
      if (model.startsWith('gpt-5')) {
        // Combine system prompt with messages for GPT-5
        let combinedInput = systemPrompt;
        for (const msg of messages) {
          combinedInput += `\n\n${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`;
        }

        const requestParams = {
          model,
          max_output_tokens: maxTokens,
          input: combinedInput
        };

        const response = await this.client.responses.create(requestParams);

        // Primary method: use output_text
        if (response.output_text && response.output_text.trim()) {
          return response.output_text;
        }

        // Fallback: search for message in output array
        if (response.output && Array.isArray(response.output)) {
          const messageOutput = response.output.find(item => item.type === 'message');
          if (messageOutput?.content?.[0]?.text) {
            return messageOutput.content[0].text;
          }
        }

        // If status is incomplete, throw specific error
        if (response.status === 'incomplete') {
          const reason = response.incomplete_details?.reason || 'unknown';
          throw new Error(`GPT-5 response incomplete: ${reason}. Try increasing max_output_tokens.`);
        }

        throw new Error('No text output from GPT-5: ' + JSON.stringify(response));
      }

      // Other models use Chat Completions API
      const formattedMessages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...messages
      ];

      const requestParams = {
        model,
        max_completion_tokens: maxTokens,
        temperature,
        messages: formattedMessages
      };

      const response = await this.client.chat.completions.create(requestParams);
      return response.choices[0].message.content;

    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
  }
}

export default OpenAIClient;
