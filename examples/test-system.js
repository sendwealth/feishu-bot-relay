#!/usr/bin/env node

/**
 * 系统测试脚本 - 演示消息中转功能
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testSystem() {
  console.log('🧪 Testing Feishu Bot Relay System\n');

  try {
    // 测试1: 健康检查
    console.log('1️⃣ Testing health check...');
    const health = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', health.data);
    console.log();

    // 测试2: 获取机器人列表
    console.log('2️⃣ Getting bot list...');
    const bots = await axios.get(`${BASE_URL}/api/bots`);
    console.log(`✅ Found ${bots.data.bots.length} bots:`);
    bots.data.bots.forEach(bot => {
      console.log(`   - ${bot.name} (${bot.botId}) - ${bot.status}`);
    });
    console.log();

    // 测试3: 模拟飞书消息事件
    console.log('3️⃣ Simulating Feishu message event...');
    const mockEvent = {
      schema: "2.0",
      header: {
        event_id: "ev_test_001",
        event_type: "im.message.receive_v1",
        tenant_key: "tenant_abc123",
        create_time: Date.now()
      },
      event: {
        sender: {
          sender_id: {
            open_id: "cli_bot_a",
            type: "app"
          },
          sender_type: "app",
          tenant_key: "tenant_abc123"
        },
        message: {
          message_id: "om_test_001",
          root_id: "",
          parent_id: "",
          create_time: Date.now(),
          chat_id: "oc_group_001",
          content: '<at user_id="cli_bot_b">Bot B</at> 你好，请帮我处理这个请求',
          mentions: [
            {
              id: "cli_bot_b",
              name: "Bot B",
              type: "bot"
            }
          ],
          message_type: "text"
        }
      }
    };

    const result = await axios.post(`${BASE_URL}/webhook/feishu/cli_bot_a`, mockEvent);
    console.log('✅ Message processed:', JSON.stringify(result.data, null, 2));
    console.log();

    // 测试4: 测试中转接口
    console.log('4️⃣ Testing relay API...');
    const relayTest = await axios.post(`${BASE_URL}/api/test/relay`, {
      message: mockEvent.event.message
    });
    console.log('✅ Relay test result:', JSON.stringify(relayTest.data, null, 2));
    console.log();

    console.log('🎉 All tests passed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.log('\n💡 Make sure the service is running:');
    console.log('   node examples/quick-start.js\n');
    process.exit(1);
  }
}

// 运行测试
testSystem();
