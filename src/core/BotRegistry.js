/**
 * 机器人注册中心 - 管理所有注册的机器人
 * MVP版本使用内存存储
 */

class BotRegistry {
  constructor() {
    // 使用Map存储机器人信息（内存存储）
    this.bots = new Map();
    
    // 名称到ID的映射（快速查找）
    this.nameToId = new Map();
  }

  /**
   * 注册新机器人
   * @param {Object} bot - 机器人配置
   * @returns {Object} 注册的机器人信息
   */
  register(bot) {
    // 验证必填字段
    if (!bot.botId) {
      throw new Error('botId is required');
    }
    if (!bot.webhookUrl) {
      throw new Error('webhookUrl is required');
    }

    // 设置默认值
    const botConfig = {
      botId: bot.botId,
      openId: bot.openId || bot.botId,
      name: bot.name || bot.botId,
      appId: bot.appId || bot.botId,
      appSecret: bot.appSecret || '',
      webhookUrl: bot.webhookUrl,
      permissions: {
        canRelayTo: bot.permissions?.canRelayTo || ['*'],  // 默认可以@所有机器人
        canBeRelayedBy: bot.permissions?.canBeRelayedBy || ['*'],  // 默认可以被所有机器人@
        ...bot.permissions
      },
      status: bot.status || 'active',
      createdAt: bot.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 存储到Map
    this.bots.set(botConfig.botId, botConfig);
    this.nameToId.set(botConfig.name, botConfig.botId);

    console.log(`[BotRegistry] Bot registered: ${botConfig.botId} (${botConfig.name})`);
    
    return botConfig;
  }

  /**
   * 获取机器人信息
   * @param {string} botId - 机器人ID
   * @returns {Object|null} 机器人信息
   */
  get(botId) {
    return this.bots.get(botId) || null;
  }

  /**
   * 通过名称获取机器人
   * @param {string} name - 机器人名称
   * @returns {Object|null} 机器人信息
   */
  getByName(name) {
    const botId = this.nameToId.get(name);
    return botId ? this.bots.get(botId) : null;
  }

  /**
   * 获取所有机器人列表
   * @param {Object} filter - 过滤条件
   * @returns {Array} 机器人列表
   */
  getAll(filter = {}) {
    let bots = Array.from(this.bots.values());

    // 按状态过滤
    if (filter.status) {
      bots = bots.filter(b => b.status === filter.status);
    }

    return bots;
  }

  /**
   * 更新机器人配置
   * @param {string} botId - 机器人ID
   * @param {Object} updates - 更新的字段
   * @returns {Object|null} 更新后的机器人信息
   */
  update(botId, updates) {
    const bot = this.bots.get(botId);
    if (!bot) {
      return null;
    }

    // 合并更新
    const updatedBot = {
      ...bot,
      ...updates,
      permissions: {
        ...bot.permissions,
        ...updates.permissions
      },
      updatedAt: new Date().toISOString()
    };

    // 更新存储
    this.bots.set(botId, updatedBot);
    
    // 如果名称改变了，更新映射
    if (updates.name && updates.name !== bot.name) {
      this.nameToId.delete(bot.name);
      this.nameToId.set(updates.name, botId);
    }

    console.log(`[BotRegistry] Bot updated: ${botId}`);
    
    return updatedBot;
  }

  /**
   * 删除机器人
   * @param {string} botId - 机器人ID
   * @returns {boolean} 是否删除成功
   */
  delete(botId) {
    const bot = this.bots.get(botId);
    if (!bot) {
      return false;
    }

    this.bots.delete(botId);
    this.nameToId.delete(bot.name);
    
    console.log(`[BotRegistry] Bot deleted: ${botId}`);
    
    return true;
  }

  /**
   * 检查机器人是否存在
   * @param {string} botId - 机器人ID
   * @returns {boolean}
   */
  exists(botId) {
    return this.bots.has(botId);
  }

  /**
   * 检查机器人是否激活
   * @param {string} botId - 机器人ID
   * @returns {boolean}
   */
  isActive(botId) {
    const bot = this.bots.get(botId);
    return bot && bot.status === 'active';
  }

  /**
   * 获取机器人总数
   * @returns {number}
   */
  count() {
    return this.bots.size;
  }

  /**
   * 清空所有机器人（用于测试）
   */
  clear() {
    this.bots.clear();
    this.nameToId.clear();
    console.log('[BotRegistry] All bots cleared');
  }

  /**
   * 批量导入机器人
   * @param {Array} bots - 机器人配置数组
   * @returns {number} 成功导入的数量
   */
  import(bots) {
    if (!Array.isArray(bots)) {
      throw new Error('bots must be an array');
    }

    let count = 0;
    for (const bot of bots) {
      try {
        this.register(bot);
        count++;
      } catch (error) {
        console.error(`[BotRegistry] Failed to import bot:`, error.message);
      }
    }

    console.log(`[BotRegistry] Imported ${count}/${bots.length} bots`);
    return count;
  }

  /**
   * 导出所有机器人配置
   * @returns {Array} 机器人配置数组
   */
  export() {
    return Array.from(this.bots.values());
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计数据
   */
  getStats() {
    const bots = Array.from(this.bots.values());
    return {
      total: bots.length,
      active: bots.filter(b => b.status === 'active').length,
      inactive: bots.filter(b => b.status !== 'active').length
    };
  }

  /**
   * 获取所有活跃的机器人
   * @returns {Array} 活跃机器人列表
   */
  getAllActive() {
    return this.getAll({ status: 'active' });
  }

  /**
   * 更新机器人状态
   * @param {string} botId - 机器人ID
   * @param {string} status - 新状态 ('active' | 'inactive')
   * @returns {boolean} 是否更新成功
   */
  updateStatus(botId, status) {
    const bot = this.bots.get(botId);
    if (!bot) {
      return false;
    }
    
    bot.status = status;
    bot.updatedAt = new Date().toISOString();
    this.bots.set(botId, bot);
    
    console.log(`[BotRegistry] Bot status updated: ${botId} -> ${status}`);
    return true;
  }
}

// 单例模式
let instance = null;

function getBotRegistry() {
  if (!instance) {
    instance = new BotRegistry();
  }
  return instance;
}

module.exports = {
  BotRegistry,
  getBotRegistry
};
