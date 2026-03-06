/**
 * 中转引擎 - 核心中转逻辑
 * 负责构造虚拟消息事件并转发给目标机器人
 */

const crypto = require('crypto');
const axios = require('axios');

class RelayEngine {
  constructor(config = {}, options = {}) {
    // 支持两种调用方式：
    // 1. new RelayEngine({ botRegistry: registry, ... })
    // 2. new RelayEngine(registry, { ... })
    if (config && typeof config.get === 'function') {
      // 旧版调用方式：第一个参数是BotRegistry实例
      this.botRegistry = config;
      this.maxRelayCount = options.maxRelayCount || 3;
      this.timeout = options.timeout || 5000;
    } else {
      // 新版调用方式：第一个参数是config对象
      this.botRegistry = config.botRegistry;
      this.maxRelayCount = config.maxRelayCount || 3;
      this.timeout = config.timeout || 5000;
    }
    
    // 统计信息
    this.stats = {
      totalRelayed: 0,
      successCount: 0,
      failureCount: 0,
      loopDetected: 0
    };
  }

  /**
   * 中转消息给被@的机器人
   * @param {Object} parsedMessage - 解析后的消息
   * @returns {Object} 中转结果
   */
  async relay(parsedMessage) {
    const result = {
      success: true,
      relayed: [],
      failed: [],
      skipped: []
    };

    // 检查是否有机器人@提及
    if (!parsedMessage.botMentions || parsedMessage.botMentions.length === 0) {
      return result;
    }

    const { botMentions, sender } = parsedMessage;

    // 获取发送者机器人ID
    const senderBotId = this.extractSenderId(sender);

    // 为每个被@的机器人构造虚拟事件
    for (const mention of botMentions) {
      const targetBotId = mention.id;
      
      try {
        // 检查目标机器人是否存在且激活
        const targetBot = this.botRegistry.get(targetBotId);
        if (!targetBot) {
          result.skipped.push({
            botId: targetBotId,
            reason: 'Bot not found'
          });
          continue;
        }

        if (targetBot.status !== 'active') {
          result.skipped.push({
            botId: targetBotId,
            reason: 'Bot not active'
          });
          continue;
        }

        // 检查权限
        if (!this.checkPermission(senderBotId, targetBotId)) {
          result.skipped.push({
            botId: targetBotId,
            reason: 'Permission denied'
          });
          continue;
        }

        // 构造虚拟消息事件
        const virtualEvent = this.constructVirtualEvent(parsedMessage, targetBotId);

        // 检测循环
        if (this.detectLoop(virtualEvent)) {
          result.skipped.push({
            botId: targetBotId,
            reason: 'Loop detected'
          });
          this.stats.loopDetected++;
          console.warn(`[RelayEngine] Loop detected for ${targetBotId}`);
          continue;
        }

        // 发送给目标机器人
        const relayResult = await this.sendToBot(targetBot, virtualEvent);
        
        if (relayResult.success) {
          result.relayed.push({
            botId: targetBotId,
            messageId: virtualEvent.event.message.message_id
          });
          this.stats.successCount++;
        } else {
          result.failed.push({
            botId: targetBotId,
            error: relayResult.error
          });
          this.stats.failureCount++;
        }

        this.stats.totalRelayed++;

      } catch (error) {
        console.error(`[RelayEngine] Failed to relay to ${targetBotId}:`, error);
        result.failed.push({
          botId: targetBotId,
          error: error.message
        });
        this.stats.failureCount++;
      }
    }

    result.success = result.failed.length === 0;
    return result;
  }

  /**
   * 构造虚拟消息事件
   * @param {Object} parsedMessage - 解析后的消息
   * @param {string} targetBotId - 目标机器人ID
   * @returns {Object} 虚拟事件对象
   */
  constructVirtualEvent(parsedMessage, targetBotId) {
    const { messageId, chatId, sender, content, timestamp } = parsedMessage;
    
    // 提取转发链信息
    let relayChain = [];
    let relayCount = 0;
    
    // 如果原始消息是虚拟事件，继续转发链
    if (parsedMessage._rawEvent && parsedMessage._rawEvent.event && 
        parsedMessage._rawEvent.event.relay_context) {
      relayChain = [...parsedMessage._rawEvent.event.relay_context.relay_chain];
      relayCount = parsedMessage._rawEvent.event.relay_context.relay_count;
    }

    // 添加发送者到转发链
    const senderBotId = this.extractSenderId(sender);
    if (senderBotId && !relayChain.includes(senderBotId)) {
      relayChain.push(senderBotId);
      relayCount++;
    }

    // 构造虚拟事件
    const virtualEvent = {
      schema: 'openclaw.relay.v1',
      type: 'virtual.message.receive_v1',
      event: {
        sender: sender,
        message: {
          message_id: `virtual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          root_id: messageId,
          parent_id: messageId,
          create_time: timestamp || Date.now(),
          chat_id: chatId,
          content: content,
          mentions: parsedMessage.botMentions,
          message_type: 'text'
        },
        relay_context: {
          original_message_id: messageId,
          relay_chain: relayChain,
          relay_count: relayCount
        }
      }
    };

    return virtualEvent;
  }

  /**
   * 发送虚拟事件给目标机器人
   * @param {Object} bot - 目标机器人配置
   * @param {Object} event - 虚拟事件
   * @returns {Object} 发送结果
   */
  async sendToBot(bot, event) {
    try {
      // 签名事件
      const signature = this.signEvent(event, bot.appSecret);

      // 发送HTTP请求
      const response = await this.httpPost(bot.webhookUrl, {
        event: event,
        signature: signature
      }, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Relay-Signature': signature
        }
      });

      console.log(`[RelayEngine] Sent to ${bot.botId}, status: ${response.status}`);
      
      return {
        success: response.status >= 200 && response.status < 300,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      console.error(`[RelayEngine] Failed to send to ${bot.botId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检测消息循环
   * @param {Object} event - 虚拟事件
   * @returns {boolean} 是否检测到循环
   */
  detectLoop(event) {
    const { relay_context } = event.event;
    
    if (!relay_context) {
      return false;
    }

    // 检查转发次数
    if (relay_context.relay_count >= this.maxRelayCount) {
      return true;
    }

    // 检查转发链中是否有重复
    const chain = relay_context.relay_chain;
    const unique = new Set(chain);
    if (unique.size !== chain.length) {
      return true;  // 有重复，说明形成循环
    }

    return false;
  }

  /**
   * 检查权限
   * @param {string} fromBotId - 发送者机器人ID
   * @param {string} toBotId - 目标机器人ID
   * @returns {boolean} 是否有权限
   */
  checkPermission(fromBotId, toBotId) {
    const fromBot = this.botRegistry.get(fromBotId);
    const toBot = this.botRegistry.get(toBotId);

    // 如果发送者未注册，允许（可能是用户直接发送）
    if (!fromBot) {
      return true;
    }

    // 检查发送方权限
    if (fromBot.permissions.canRelayTo.length > 0 && 
        !fromBot.permissions.canRelayTo.includes('*') &&
        !fromBot.permissions.canRelayTo.includes(toBotId)) {
      return false;
    }

    // 检查接收方权限
    if (toBot.permissions.canBeRelayedBy.length > 0 &&
        !toBot.permissions.canBeRelayedBy.includes('*') &&
        !toBot.permissions.canBeRelayedBy.includes(fromBotId)) {
      return false;
    }

    return true;
  }

  /**
   * 从发送者信息中提取机器人ID
   * @param {Object} sender - 发送者对象
   * @returns {string} 机器人ID
   */
  extractSenderId(sender) {
    if (!sender) return null;
    
    // 飞书格式
    if (sender.sender_id && sender.sender_id.open_id) {
      return sender.sender_id.open_id;
    }
    
    // 简化格式
    return sender.open_id || sender.id || null;
  }

  /**
   * 签名事件
   * @param {Object} event - 事件对象
   * @param {string} secret - 密钥
   * @returns {string} 签名字符串
   */
  signEvent(event, secret) {
    if (!secret) {
      return '';
    }

    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${JSON.stringify(event)}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const signature = hmac.digest('hex');
    
    return `sha256=${signature}&t=${timestamp}`;
  }

  /**
   * HTTP POST请求（简化版，实际项目建议使用axios等库）
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @param {Object} options - 请求选项
   * @returns {Object} 响应对象
   */
  async httpPost(url, data, options = {}) {
    try {
      const response = await axios.post(url, data, {
        timeout: options.timeout || this.timeout,
        headers: options.headers || {}
      });
      
      return {
        status: response.status,
        data: response.data
      };
    } catch (error) {
      console.error(`[RelayEngine] POST ${url} failed:`, error.message);
      throw error;
    }
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalRelayed: 0,
      successCount: 0,
      failureCount: 0,
      loopDetected: 0
    };
  }
}

module.exports = RelayEngine;
