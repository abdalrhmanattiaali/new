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
          messages: [
            {
              role: 'user',
              content: `${systemPrompt}\n\n${userPrompt}`
            }
          ]
        };

        const response = await this.client.responses.create(requestParams);
        return response.output.content[0].text;
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
        // Combine system prompt with first user message for GPT-5
        const formattedMessages = [...messages];
        if (formattedMessages.length > 0 && formattedMessages[0].role === 'user') {
          formattedMessages[0].content = `${systemPrompt}\n\n${formattedMessages[0].content}`;
        }

        const requestParams = {
          model,
          max_output_tokens: maxTokens,
          messages: formattedMessages
        };

        const response = await this.client.responses.create(requestParams);
        return response.output.content[0].text;
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
