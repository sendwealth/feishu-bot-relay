/**
 * 集成测试 - 端到端消息中转流程
 */

const { FeishuBotRelay } = require('../../src/index');
const axios = require('axios');

describe('FeishuBotRelay Integration Tests', () => {
  let relay;
  const PORT = 3001;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // 创建并启动服务
    relay = new FeishuBotRelay({ port: PORT });
    
    // 注册测试机器人
    relay.registerBot({
      botId: 'cli_test_a',
      openId: 'ou_test_a',
      name: 'Test Bot A',
      appId: 'cli_test_a',
      appSecret: 'secret_a',
      webhookUrl: `${BASE_URL}/test/webhook/a`,
      permissions: {
        canRelayTo: ['*'],
        canBeRelayedBy: ['*']
      },
      status: 'active'
    });

    relay.registerBot({
      botId: 'cli_test_b',
      openId: 'ou_test_b',
      name: 'Test Bot B',
      appId: 'cli_test_b',
      appSecret: 'secret_b',
      webhookUrl: `${BASE_URL}/test/webhook/b`,
      permissions: {
        canRelayTo: ['*'],
        canBeRelayedBy: ['*']
      },
      status: 'active'
    });

    await relay.start();
  });

  afterAll(async () => {
    await relay.stop();
  });

  test('健康检查应该返回正常状态', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('ok');
    expect(response.data.bots).toBeDefined();
    expect(response.data.bots.total).toBe(2);
  });

  test('应该返回机器人列表', async () => {
    const response = await axios.get(`${BASE_URL}/api/bots`);
    
    expect(response.status).toBe(200);
    expect(response.data.bots).toHaveLength(2);
    expect(response.data.bots[0].name).toBeDefined();
  });

  test('应该通过API注册新机器人', async () => {
    const newBot = {
      botId: 'cli_test_c',
      openId: 'ou_test_c',
      name: 'Test Bot C',
      appId: 'cli_test_c',
      appSecret: 'secret_c',
      webhookUrl: 'https://example.com/webhook',
      permissions: {
        canRelayTo: ['*'],
        canBeRelayedBy: ['*']
      },
      status: 'active'
    };

    const response = await axios.post(`${BASE_URL}/api/bots`, newBot);
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);

    // 验证机器人已注册
    const botResponse = await axios.get(`${BASE_URL}/api/bots/cli_test_c`);
    expect(botResponse.data.bot.botId).toBe('cli_test_c');
  });

  test('应该处理飞书消息事件并触发中转', async () => {
    // Mock webhook endpoint
    let receivedEvent = null;
    
    relay.app.post('/test/webhook/b', (req, res) => {
      receivedEvent = req.body;
      res.json({ success: true });
    });

    const feishuEvent = {
      schema: "2.0",
      header: {
        event_id: "ev_integration_001",
        event_type: "im.message.receive_v1",
        tenant_key: "tenant_test",
        create_time: Date.now()
      },
      event: {
        sender: {
          sender_id: {
            open_id: "cli_test_a",
            type: "app"
          },
          sender_type: "app"
        },
        message: {
          message_id: "om_integration_001",
          chat_id: "oc_test_group",
          content: '<at user_id="cli_test_b">Test Bot B</at> 你好',
          mentions: [
            { id: "cli_test_b", name: "Test Bot B", type: "bot" }
          ],
          message_type: "text",
          create_time: Date.now()
        }
      }
    };

    const response = await axios.post(`${BASE_URL}/webhook/feishu/cli_test_a`, feishuEvent);
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.result.relayed.relayed).toHaveLength(1);
    expect(response.data.result.relayed.relayed[0].botId).toBe('cli_test_b');
  });

  test('应该拒绝不存在的机器人', async () => {
    const response = await axios.get(`${BASE_URL}/api/bots/non_existent`);
    
    expect(response.status).toBe(404);
    expect(response.data.error).toBe('Bot not found');
  });

  test('应该删除机器人', async () => {
    // 先注册一个临时机器人
    await axios.post(`${BASE_URL}/api/bots`, {
      botId: 'cli_temp',
      name: 'Temp Bot',
      webhookUrl: 'https://example.com/webhook'
    });

    // 删除机器人
    const response = await axios.delete(`${BASE_URL}/api/bots/cli_temp`);
    
    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);

    // 验证已删除
    const checkResponse = await axios.get(`${BASE_URL}/api/bots/cli_temp`);
    expect(checkResponse.status).toBe(404);
  });

  test('测试接口应该正确解析和中转消息', async () => {
    const testMessage = {
      message_id: "om_test",
      chat_id: "oc_test",
      content: '<at user_id="cli_test_b">Test Bot B</at> 测试消息',
      mentions: [
        { id: "cli_test_b", name: "Test Bot B", type: "bot" }
      ],
      message_type: "text",
      create_time: Date.now()
    };

    const response = await axios.post(`${BASE_URL}/api/test/relay`, {
      message: testMessage
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.parsed.botMentions).toHaveLength(1);
  });
});
