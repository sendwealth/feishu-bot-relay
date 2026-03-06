/**
 * BotRegistry 单元测试
 */

const { BotRegistry } = require('../../src/core/BotRegistry');
const { mockBots } = require('../fixtures/test-data');

describe('BotRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new BotRegistry();
  });

  describe('register()', () => {
    test('应该成功注册机器人', () => {
      const result = registry.register(mockBots.botA);
      expect(result).toMatchObject(mockBots.botA);
      expect(registry.exists(mockBots.botA.botId)).toBe(true);
    });

    test('应该拒绝无效的机器人配置', () => {
      expect(() => registry.register(null)).toThrow();
      expect(() => registry.register({})).toThrow('botId is required');
    });

    test('应该更新已存在的机器人', () => {
      registry.register(mockBots.botA);
      const updatedBot = { ...mockBots.botA, name: 'Updated Bot A' };
      registry.register(updatedBot);
      
      const bot = registry.get(mockBots.botA.botId);
      expect(bot.name).toBe('Updated Bot A');
    });
  });

  describe('unregister()', () => {
    test('应该成功注销机器人', () => {
      registry.register(mockBots.botA);
      const result = registry.unregister(mockBots.botA.botId);
      expect(result).toBe(true);
      expect(registry.exists(mockBots.botA.botId)).toBe(false);
    });

    test('应该返回false如果机器人不存在', () => {
      const result = registry.unregister('non_existent_bot');
      expect(result).toBe(false);
    });
  });

  describe('get()', () => {
    test('应该返回机器人信息', () => {
      registry.register(mockBots.botA);
      const bot = registry.get(mockBots.botA.botId);
      expect(bot).toMatchObject(mockBots.botA);
    });

    test('应该返回null如果机器人不存在', () => {
      const bot = registry.get('non_existent_bot');
      expect(bot).toBeNull();
    });
  });

  describe('getByName()', () => {
    test('应该通过名称获取机器人', () => {
      registry.register(mockBots.botA);
      const bot = registry.getByName('Bot A');
      expect(bot.botId).toBe(mockBots.botA.botId);
    });

    test('应该返回null如果名称不存在', () => {
      const bot = registry.getByName('Non Existent');
      expect(bot).toBeNull();
    });
  });

  describe('getAllActive()', () => {
    test('应该返回所有活跃的机器人', () => {
      registry.register(mockBots.botA);
      registry.register(mockBots.botB);
      registry.register(mockBots.botInactive);
      
      const activeBots = registry.getAllActive();
      expect(activeBots).toHaveLength(2);
      expect(activeBots.find(b => b.botId === mockBots.botInactive.botId)).toBeUndefined();
    });
  });

  describe('updateStatus()', () => {
    test('应该更新机器人状态', () => {
      registry.register(mockBots.botA);
      const result = registry.updateStatus(mockBots.botA.botId, 'inactive');
      expect(result).toBe(true);
      
      const bot = registry.get(mockBots.botA.botId);
      expect(bot.status).toBe('inactive');
    });

    test('应该返回false如果机器人不存在', () => {
      const result = registry.updateStatus('non_existent', 'inactive');
      expect(result).toBe(false);
    });
  });

  describe('getStats()', () => {
    test('应该返回正确的统计信息', () => {
      registry.register(mockBots.botA);
      registry.register(mockBots.botB);
      registry.register(mockBots.botInactive);
      
      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.inactive).toBe(1);
    });
  });
});
