/**
 * WhatsApp Bot Core
 * البوت الأساسي لواتساب
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { EventEmitter } from 'events';

export class WhatsAppBot extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isReady = false;
    this.messageHandlers = new Map();
  }

  /**
   * Initialize WhatsApp client
   */
  async initialize() {
    console.log('🤖 Initializing WhatsApp Bot...');

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: 'family-assistant-main',
        dataPath: './.wwebjs_auth'
      }),
      puppeteer: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        headless: true
      },
      // Increase timeout for stability
      qrMaxRetries: 5,
      restartOnAuthFail: true,
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      }
    });

    // QR Code event
    this.client.on('qr', (qr) => {
      console.log('\n📱 Scan this QR code with your WhatsApp:');
      qrcode.generate(qr, { small: true });
      this.emit('qr', qr);
    });

    // Ready event
    this.client.on('ready', () => {
      console.log('✅ WhatsApp Bot is ready!');
      this.isReady = true;
      this.emit('ready');
    });

    // Authenticated event
    this.client.on('authenticated', () => {
      console.log('✅ WhatsApp authenticated');
      this.emit('authenticated');
    });

    // Authentication failure event
    this.client.on('auth_failure', (msg) => {
      console.error('❌ Authentication failed:', msg);
      this.emit('auth_failure', msg);
    });

    // Disconnected event
    this.client.on('disconnected', (reason) => {
      console.log('⚠️ WhatsApp disconnected:', reason);
      this.isReady = false;
      this.emit('disconnected', reason);
    });

    // Message received event
    this.client.on('message', async (message) => {
      try {
        await this.handleIncomingMessage(message);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });

    // Initialize the client
    await this.client.initialize();
  }

  /**
   * Handle incoming messages
   */
  async handleIncomingMessage(message) {
    const from = message.from;
    const body = message.body;

    console.log(`📨 Message from ${from}: ${body}`);

    // Emit message event
    this.emit('message', { from, body, message });

    // Call registered handlers
    for (const [name, handler] of this.messageHandlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error(`Error in handler '${name}':`, error);
      }
    }
  }

  /**
   * Register a message handler
   */
  registerMessageHandler(name, handler) {
    this.messageHandlers.set(name, handler);
    console.log(`✅ Registered message handler: ${name}`);
  }

  /**
   * Unregister a message handler
   */
  unregisterMessageHandler(name) {
    this.messageHandlers.delete(name);
    console.log(`✅ Unregistered message handler: ${name}`);
  }

  /**
   * Send a text message
   */
  async sendMessage(to, text) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Format phone number to WhatsApp format (e.g., 201234567890@c.us)
      const chatId = to.includes('@') ? to : `${to}@c.us`;
      await this.client.sendMessage(chatId, text);
      console.log(`✅ Message sent to ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending message to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Send a message with buttons (using list message)
   */
  async sendMessageWithButtons(to, text, buttons) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chatId = to.includes('@') ? to : `${to}@c.us`;

      // Create a formatted message with buttons as text options
      let formattedMessage = text + '\n\n';
      buttons.forEach((button, index) => {
        formattedMessage += `${index + 1}. ${button}\n`;
      });

      await this.client.sendMessage(chatId, formattedMessage);
      console.log(`✅ Message with buttons sent to ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending message with buttons to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Get contact info
   */
  async getContact(phoneNumber) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
      const contact = await this.client.getContactById(chatId);
      return contact;
    } catch (error) {
      console.error(`❌ Error getting contact ${phoneNumber}:`, error);
      return null;
    }
  }

  /**
   * Check if a number is registered on WhatsApp
   */
  async isRegisteredUser(phoneNumber) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
      const isRegistered = await this.client.isRegisteredUser(chatId);
      return isRegistered;
    } catch (error) {
      console.error(`❌ Error checking registration for ${phoneNumber}:`, error);
      return false;
    }
  }

  /**
   * Get all chats
   */
  async getChats() {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chats = await this.client.getChats();
      return chats;
    } catch (error) {
      console.error('❌ Error getting chats:', error);
      return [];
    }
  }

  /**
   * Get all WhatsApp groups
   */
  async getGroups() {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chats = await this.client.getChats();
      const groups = chats.filter(chat => chat.isGroup);

      console.log(`✅ Found ${groups.length} WhatsApp groups`);

      return groups.map(group => ({
        id: group.id._serialized,
        name: group.name,
        participantsCount: group.participants ? group.participants.length : 0,
        isGroup: true
      }));
    } catch (error) {
      console.error('❌ Error getting groups:', error);
      return [];
    }
  }

  /**
   * Send message to group
   */
  async sendMessageToGroup(groupId, text) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      await this.client.sendMessage(groupId, text);
      console.log(`✅ Message sent to group ${groupId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending message to group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Get group info by ID
   */
  async getGroupInfo(groupId) {
    if (!this.isReady) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const chat = await this.client.getChatById(groupId);

      if (!chat.isGroup) {
        throw new Error('This is not a group chat');
      }

      return {
        id: chat.id._serialized,
        name: chat.name,
        participants: chat.participants.map(p => ({
          id: p.id._serialized,
          isAdmin: p.isAdmin,
          isSuperAdmin: p.isSuperAdmin
        })),
        participantsCount: chat.participants.length,
        description: chat.description || '',
        createdAt: chat.createdAt,
        owner: chat.owner ? chat.owner._serialized : null
      };
    } catch (error) {
      console.error(`❌ Error getting group info ${groupId}:`, error);
      return null;
    }
  }

  /**
   * Destroy the client
   */
  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.isReady = false;
      console.log('🛑 WhatsApp client destroyed');
    }
  }

  /**
   * Logout
   */
  async logout() {
    if (this.client) {
      await this.client.logout();
      this.isReady = false;
      console.log('👋 WhatsApp logged out');
    }
  }
}

export default WhatsAppBot;
