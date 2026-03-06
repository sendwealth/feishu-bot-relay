/**
 * Webhook服务器 - 接收飞书消息回调
 */

const express = require('express');

class WebhookServer {
  constructor(config = {}) {
    this.port = config.port || 3000;
    this.messageParser = config.messageParser;
    this.relayEngine = config.relayEngine;
    this.botRegistry = config.botRegistry;
    
    this.app = express();
    this.server = null;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    // 解析JSON请求体
    this.app.use(express.json());
    
    // 日志中间件
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // 错误处理中间件
    this.app.use((err, req, res, next) => {
      console.error('[WebhookServer] Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    });
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      const stats = this.botRegistry.getStats();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        bots: {
          total: stats.total,
          active: stats.active,
          inactive: stats.inactive
        }
      });
    });

    // 飞书事件回调（通用）
    this.app.post('/webhook/feishu', async (req, res) => {
      try {
        const result = await this.handleFeishuEvent(req.body);
        res.json({ success: true, data: result });
      } catch (error) {
        console.error('[WebhookServer] Handle event error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 飞书事件回调（指定机器人）
    this.app.post('/webhook/feishu/:botId', async (req, res) => {
      try {
        const { botId } = req.params;
        const result = await this.handleFeishuEvent(req.body, botId);
        res.json({ success: true, data: result });
      } catch (error) {
        console.error('[WebhookServer] Handle event error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // 接收虚拟消息事件（用于机器人间的中转）
    this.app.post('/relay', async (req, res) => {
      try {
        const result = await this.handleRelayEvent(req.body);
        res.json({ success: true, data: result });
      } catch (error) {
        console.error('[WebhookServer] Handle relay error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取机器人列表
    this.app.get('/api/bots', (req, res) => {
      const bots = this.botRegistry.getAll();
      res.json({
        bots: bots.map(b => ({
          botId: b.botId,
          name: b.name,
          status: b.status,
          createdAt: b.createdAt
        }))
      });
    });

    // API: 注册机器人
    this.app.post('/api/bots', (req, res) => {
      try {
        const bot = this.botRegistry.register(req.body);
        res.json({
          success: true,
          bot: {
            botId: bot.botId,
            name: bot.name,
            status: bot.status
          }
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取单个机器人
    this.app.get('/api/bots/:botId', (req, res) => {
      const bot = this.botRegistry.get(req.params.botId);
      if (!bot) {
        return res.status(404).json({
          error: 'Bot not found'
        });
      }
      res.json({
        bot: {
          botId: bot.botId,
          openId: bot.openId,
          name: bot.name,
          appId: bot.appId,
          webhookUrl: bot.webhookUrl,
          permissions: bot.permissions,
          status: bot.status,
          createdAt: bot.createdAt,
          updatedAt: bot.updatedAt
        }
      });
    });

    // API: 删除机器人
    this.app.delete('/api/bots/:botId', (req, res) => {
      const deleted = this.botRegistry.delete(req.params.botId);
      if (!deleted) {
        return res.status(404).json({
          error: 'Bot not found'
        });
      }
      res.json({
        success: true
      });
    });

    // API: 测试消息解析和中转
    this.app.post('/api/test/relay', async (req, res) => {
      try {
        const { message } = req.body;
        
        // 解析消息
        const parsed = this.messageParser.parse(message);
        
        // 检查机器人提及
        const hasMentions = this.messageParser.hasBotMentions(parsed);
        
        res.json({
          success: true,
          parsed: {
            botMentions: parsed.botMentions || [],
            hasBotMentions: hasMentions,
            content: parsed.content
          }
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          error: error.message
        });
      }
    });

    // API: 获取统计信息
    this.app.get('/api/stats', (req, res) => {
      res.json({
        success: true,
        data: {
          bots: this.botRegistry.count(),
          relay: this.relayEngine.getStats()
        }
      });
    });
  }

  /**
   * 处理飞书事件
   * @param {Object} event - 飞书事件对象
   * @param {string} botId - 可选的机器人ID
   * @returns {Object} 处理结果
   */
  async handleFeishuEvent(event, botId = null) {
    console.log('[WebhookServer] Received Feishu event:', event.header?.event_type);

    // 处理飞书URL验证
    if (event.type === 'url_verification') {
      return { challenge: event.challenge };
    }

    // 只处理消息事件
    if (event.header?.event_type !== 'im.message.receive_v1') {
      return { skipped: true, reason: 'Not a message event' };
    }

    // 解析消息
    const parsedMessage = this.messageParser.parseFeishuEvent(event);

    // 检查是否包含机器人@提及
    if (!this.messageParser.hasBotMentions(parsedMessage)) {
      return { skipped: true, reason: 'No bot mentions' };
    }

    // 中转消息
    const relayResult = await this.relayEngine.relay(parsedMessage);

    return {
      processed: true,
      relayed: relayResult.relayed.length,
      failed: relayResult.failed.length,
      details: relayResult
    };
  }

  /**
   * 处理中转事件
   * @param {Object} body - 请求体
   * @returns {Object} 处理结果
   */
  async handleRelayEvent(body) {
    const { event, signature } = body;

    if (!event || event.type !== 'virtual.message.receive_v1') {
      throw new Error('Invalid relay event format');
    }

    console.log('[WebhookServer] Received relay event');

    // 解析虚拟消息
    const parsedMessage = this.messageParser.parse(event.event.message);
    parsedMessage.sender = event.event.sender;
    parsedMessage._rawEvent = event;

    // 检查是否还需要继续中转
    if (this.messageParser.hasBotMentions(parsedMessage)) {
      const relayResult = await this.relayEngine.relay(parsedMessage);
      return {
        processed: true,
        relayed: relayResult.relayed.length,
        details: relayResult
      };
    }

    return {
      processed: true,
      relayed: 0,
      reason: 'No further bot mentions'
    };
  }

  /**
   * 启动服务器
   * @returns {Promise}
   */
  start() {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[WebhookServer] Server started on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  /**
   * 停止服务器
   * @returns {Promise}
   */
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[WebhookServer] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = WebhookServer;
