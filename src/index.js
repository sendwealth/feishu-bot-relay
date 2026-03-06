/**
 * 飞书机器人消息中转系统 - 主入口
 */

require('dotenv').config();

const MessageParser = require('./core/MessageParser');
const { getBotRegistry } = require('./core/BotRegistry');
const RelayEngine = require('./core/RelayEngine');
const WebhookServer = require('./core/WebhookServer');

class FeishuBotRelay {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3000,
      maxRelayCount: config.maxRelayCount || parseInt(process.env.MAX_RELAY_COUNT) || 3,
      ...config
    };

    // 初始化核心组件
    this.messageParser = new MessageParser();
    this.botRegistry = getBotRegistry();
    this.relayEngine = new RelayEngine({
      botRegistry: this.botRegistry,
      maxRelayCount: this.config.maxRelayCount
    });
    this.webhookServer = new WebhookServer({
      port: this.config.port,
      messageParser: this.messageParser,
      relayEngine: this.relayEngine,
      botRegistry: this.botRegistry
    });
  }

  /**
   * 启动系统
   */
  async start() {
    try {
      // 加载机器人配置（如果有）
      if (this.config.bots) {
        this.botRegistry.import(this.config.bots);
      }

      // 启动Webhook服务器
      await this.webhookServer.start();
      
      console.log('=================================');
      console.log('Feishu Bot Relay System Started');
      console.log('=================================');
      console.log(`Port: ${this.config.port}`);
      console.log(`Registered Bots: ${this.botRegistry.count()}`);
      console.log(`Max Relay Count: ${this.config.maxRelayCount}`);
      console.log('=================================');
      
    } catch (error) {
      console.error('[FeishuBotRelay] Failed to start:', error);
      throw error;
    }
  }

  /**
   * 停止系统
   */
  async stop() {
    await this.webhookServer.stop();
    console.log('[FeishuBotRelay] System stopped');
  }

  /**
   * 注册机器人
   */
  registerBot(bot) {
    return this.botRegistry.register(bot);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      bots: this.botRegistry.count(),
      relay: this.relayEngine.getStats()
    };
  }
}

// 导出类和组件
module.exports = {
  FeishuBotRelay,
  MessageParser,
  BotRegistry: require('./core/BotRegistry').BotRegistry,
  RelayEngine,
  WebhookServer,
  getBotRegistry
};
