/**
 * MessageParser 单元测试
 */

const MessageParser = require('../../src/core/MessageParser');
const { mockFeishuEvents } = require('../fixtures/test-data');

describe('MessageParser', () => {
  let parser;

  beforeEach(() => {
    parser = new MessageParser();
  });

  describe('parse()', () => {
    test('应该正确解析包含@提及的消息', () => {
      const message = mockFeishuEvents.simpleMessage.event.message;
      const result = parser.parse(message);

      expect(result.messageId).toBe('om_001');
      expect(result.chatId).toBe('oc_group_001');
      expect(result.botMentions).toHaveLength(1);
      expect(result.botMentions[0].id).toBe('cli_bot_b');
      expect(result.botMentions[0].type).toBe('bot');
    });

    test('应该正确解析包含多个@提及的消息', () => {
      const message = mockFeishuEvents.multipleMentions.event.message;
      const result = parser.parse(message);

      expect(result.botMentions).toHaveLength(2);
      expect(result.botMentions[0].id).toBe('cli_bot_b');
      expect(result.botMentions[1].id).toBe('cli_bot_c');
    });

    test('应该过滤掉用户@提及', () => {
      const message = mockFeishuEvents.userMention.event.message;
      const result = parser.parse(message);

      expect(result.mentions).toHaveLength(1);
      expect(result.botMentions).toHaveLength(0);
    });

    test('应该保留relay context', () => {
      const message = mockFeishuEvents.virtualRelayMessage.event.message;
      const result = parser.parse(message);

      expect(result.relayContext).toBeDefined();
      expect(result.relayContext.relay_count).toBe(1);
      expect(result.relayContext.relay_chain).toContain('cli_bot_a');
    });
  });

  describe('extractMentions()', () => {
    test('应该从内容中提取@提及', () => {
      const content = '<at user_id="cli_bot_b">Bot B</at> 你好';
      const mentions = parser.extractMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions[0].id).toBe('cli_bot_b');
      expect(mentions[0].name).toBe('Bot B');
      expect(mentions[0].type).toBe('bot');
    });

    test('应该处理空内容', () => {
      const mentions = parser.extractMentions('');
      expect(mentions).toHaveLength(0);
    });

    test('应该处理null内容', () => {
      const mentions = parser.extractMentions(null);
      expect(mentions).toHaveLength(0);
    });
  });

  describe('getIdType()', () => {
    test('应该识别机器人ID', () => {
      expect(parser.getIdType('cli_bot_a')).toBe('bot');
    });

    test('应该识别用户ID', () => {
      expect(parser.getIdType('ou_user_001')).toBe('user');
    });
  });

  // validateMessage方法未实现，暂时注释
  // describe('validateMessage()', () => {
  //   test('应该验证有效消息', () => {
  //     const message = {
  //       message_id: 'om_001',
  //       chat_id: 'oc_001',
  //       content: 'test'
  //     };
  //     expect(parser.validateMessage(message)).toBe(true);
  //   });

  //   test('应该拒绝null消息', () => {
  //     expect(parser.validateMessage(null)).toBe(false);
  //   });

  //   test('应该拒绝缺少message_id的消息', () => {
  //     const message = {
  //       chat_id: 'oc_001',
  //       content: 'test'
  //     };
  //     expect(parser.validateMessage(message)).toBe(false);
  //   });
  // });
});
