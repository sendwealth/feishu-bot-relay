/**
 * RelayEngine 单元测试
 */

const RelayEngine = require('../../src/core/RelayEngine');
const BotRegistry = require('../../src/core/BotRegistry');
const { mockFeishuEvents, mockBots } = require('../fixtures/test-data');

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn()
}));

const axios = require('axios');

describe('RelayEngine', () => {
  let engine;
  let registry;

  beforeEach(() => {
    registry = new BotRegistry();
    
    // 注册测试机器人
    registry.register(mockBots.botA);
    registry.register(mockBots.botB);
    registry.register(mockBots.botC);

    engine = new RelayEngine(registry, {
      maxRelayCount: 3,
      logger: console
    });

    // Mock axios
    axios.post.mockClear();
    axios.post.mockResolvedValue({ data: { success: true } });
  });

  describe('relay()', () => {
    test('应该成功中转消息给被@的机器人', async () => {
      const message = mockFeishuEvents.simpleMessage.event.message;
      const parsed = {
        ...message,
        botMentions: [{ id: 'cli_bot_b', name: 'Bot B', type: 'bot' }],
        sender: { botId: 'cli_bot_a' }
      };

      const result = await engine.relay(parsed);

      expect(result.success).toBe(true);
      expect(result.relayed).toHaveLength(1);
      expect(result.relayed[0].botId).toBe('cli_bot_b');
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    test('应该跳过没有@提及的消息', async () => {
      const parsed = {
        botMentions: [],
        sender: { botId: 'cli_bot_a' }
      };

      const result = await engine.relay(parsed);

      expect(result.relayed).toHaveLength(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('应该跳过不存在的机器人', async () => {
      const parsed = {
        botMentions: [{ id: 'cli_non_existent', name: 'Ghost', type: 'bot' }],
        sender: { botId: 'cli_bot_a' }
      };

      const result = await engine.relay(parsed);

      expect(result.relayed).toHaveLength(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('应该跳过非活跃的机器人', async () => {
      registry.updateStatus('cli_bot_b', 'inactive');
      
      const parsed = {
        botMentions: [{ id: 'cli_bot_b', name: 'Bot B', type: 'bot' }],
        sender: { botId: 'cli_bot_a' }
      };

      const result = await engine.relay(parsed);

      expect(result.relayed).toHaveLength(0);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('应该中转给多个机器人', async () => {
      const message = mockFeishuEvents.multipleMentions.event.message;
      const parsed = {
        ...message,
        botMentions: [
          { id: 'cli_bot_b', name: 'Bot B', type: 'bot' },
          { id: 'cli_bot_c', name: 'Bot C', type: 'bot' }
        ],
        sender: { botId: 'cli_bot_a' }
      };

      const result = await engine.relay(parsed);

      expect(result.relayed).toHaveLength(2);
      expect(axios.post).toHaveBeenCalledTimes(2);
    });
  });

  describe('checkPermission()', () => {
    test('应该允许有权限的中转', () => {
      const hasPermission = engine.checkPermission('cli_bot_a', 'cli_bot_b');
      expect(hasPermission).toBe(true);
    });

    test('应该拒绝无权限的中转', () => {
      // Bot C只能relay to Bot B
      const hasPermission = engine.checkPermission('cli_bot_c', 'cli_bot_a');
      expect(hasPermission).toBe(false);
    });

    test('应该拒绝不存在的机器人', () => {
      const hasPermission = engine.checkPermission('cli_bot_a', 'cli_non_existent');
      expect(hasPermission).toBe(false);
    });
  });

  describe('detectLoop()', () => {
    test('应该检测到深层中转', () => {
      const event = mockFeishuEvents.deepRelayChain;
      const isLoop = engine.detectLoop(event);
      expect(isLoop).toBe(true);
    });

    test('应该检测到循环中转', () => {
      const event = mockFeishuEvents.circularRelay;
      const isLoop = engine.detectLoop(event);
      expect(isLoop).toBe(true);
    });

    test('应该允许正常的首次中转', () => {
      const event = mockFeishuEvents.virtualRelayMessage;
      const isLoop = engine.detectLoop(event);
      expect(isLoop).toBe(false);
    });

    test('应该允许非relay消息', () => {
      const event = mockFeishuEvents.simpleMessage;
      const isLoop = engine.detectLoop(event);
      expect(isLoop).toBe(false);
    });
  });

  describe('createVirtualEvent()', () => {
    test('应该构造正确的虚拟事件', () => {
      const parsed = {
        messageId: 'om_001',
        chatId: 'oc_001',
        content: 'test message',
        sender: { botId: 'cli_bot_a' },
        timestamp: 1709877600000
      };

      const mention = { id: 'cli_bot_b', name: 'Bot B', type: 'bot' };

      const event = engine.createVirtualEvent(parsed, mention);

      expect(event.schema).toBe('openclaw.relay.v1');
      expect(event.type).toBe('virtual.message.receive_v1');
      expect(event.event.message.root_id).toBe('om_001');
      expect(event.event.message.mentions).toContain(mention);
      expect(event.event.relay_context.relay_chain).toContain('cli_bot_a');
      expect(event.event.relay_context.relay_count).toBe(1);
    });

    test('应该正确传递relay context', () => {
      const parsed = {
        messageId: 'om_002',
        chatId: 'oc_001',
        content: 'test',
        sender: { botId: 'cli_bot_b' },
        timestamp: 1709877600000,
        relayContext: {
          original_message_id: 'om_001',
          relay_chain: ['cli_bot_a'],
          relay_count: 1
        }
      };

      const mention = { id: 'cli_bot_c', name: 'Bot C', type: 'bot' };
      const event = engine.createVirtualEvent(parsed, mention);

      expect(event.event.relay_context.relay_chain).toEqual(['cli_bot_a', 'cli_bot_b']);
      expect(event.event.relay_context.relay_count).toBe(2);
      expect(event.event.relay_context.original_message_id).toBe('om_001');
    });
  });

  describe('signEvent()', () => {
    test('应该生成签名', () => {
      const event = { test: 'data' };
      const secret = 'test_secret';
      
      const signature = engine.signEvent(event, secret);

      expect(signature).toMatch(/^sha256=[a-f0-9]+&t=\d+$/);
    });

    test('相同事件和密钥应生成相同签名', () => {
      const event = { test: 'data' };
      const secret = 'test_secret';
      
      const sig1 = engine.signEvent(event, secret);
      const sig2 = engine.signEvent(event, secret);

      expect(sig1).toBe(sig2);
    });
  });
});
