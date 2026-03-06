/**
 * 消息解析器 - 解析飞书消息中的@提及
 */

class MessageParser {
  /**
   * 解析飞书消息，提取机器人@提及
   * @param {Object} message - 飞书消息对象
   * @returns {Object} 解析结果
   */
  parse(message) {
    const result = {
      messageId: message.message_id || message.id,
      chatId: message.chat_id,
      sender: message.sender,
      content: message.content,
      mentions: [],
      botMentions: [],
      timestamp: message.create_time || Date.now()
    };

    // 提取所有@提及
    result.mentions = this.extractMentions(message.content);

    // 过滤出机器人提及
    result.botMentions = result.mentions.filter(m => m.type === 'bot');

    return result;
  }

  /**
   * 从消息内容中提取@提及
   * @param {string} content - 消息内容（富文本格式）
   * @returns {Array} 提及列表
   */
  extractMentions(content) {
    if (!content) return [];

    const mentions = [];

    // 方法1: 使用正则表达式提取飞书富文本格式的@提及
    // 格式: <at user_id="cli_xxx">Bot Name</at>
    const atRegex = /<at\s+user_id="([^"]+)"[^>]*>([^<]+)<\/at>/g;
    let match;

    while ((match = atRegex.exec(content)) !== null) {
      mentions.push({
        id: match[1],
        name: match[2],
        type: this.getIdType(match[1])
      });
    }

    // 方法2: 如果消息中有mentions字段，直接使用（飞书官方格式）
    // 注意: 这个逻辑会在外部调用时处理

    return mentions;
  }

  /**
   * 根据ID判断类型（机器人或用户）
   * @param {string} id - ID字符串
   * @returns {string} 'bot' 或 'user'
   */
  getIdType(id) {
    // 飞书机器人ID通常以 cli_ 开头
    // 用户ID通常以 ou_ 开头
    if (id.startsWith('cli_') || id.startsWith('app_')) {
      return 'bot';
    }
    return 'user';
  }

  /**
   * 从飞书事件对象中解析消息
   * @param {Object} event - 飞书事件对象
   * @returns {Object} 解析结果
   */
  parseFeishuEvent(event) {
    if (!event || !event.event) {
      throw new Error('Invalid Feishu event format');
    }

    const messageEvent = event.event;
    const message = messageEvent.message || messageEvent;

    const result = this.parse(message);
    
    // 添加发送者信息
    result.sender = messageEvent.sender || {
      sender_id: { open_id: 'unknown' },
      sender_type: 'unknown'
    };

    // 如果消息中已有mentions字段，使用官方数据
    if (message.mentions && Array.isArray(message.mentions)) {
      result.botMentions = message.mentions.filter(m => {
        // 判断是否为机器人
        return m.type === 'bot' || 
               m.id.startsWith('cli_') || 
               m.id.startsWith('app_');
      });
    }

    // 保留原始事件引用（用于调试）
    result._rawEvent = event;

    return result;
  }

  /**
   * 检查消息是否包含机器人@提及
   * @param {Object} parsedMessage - 解析后的消息
   * @returns {boolean}
   */
  hasBotMentions(parsedMessage) {
    return parsedMessage.botMentions && parsedMessage.botMentions.length > 0;
  }

  /**
   * 获取所有被@的机器人ID列表
   * @param {Object} parsedMessage - 解析后的消息
   * @returns {Array<string>} 机器人ID列表
   */
  getBotIds(parsedMessage) {
    return parsedMessage.botMentions.map(m => m.id);
  }
}

module.exports = MessageParser;
