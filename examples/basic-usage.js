/**
 * 使用示例 - 快速开始
 */

const { FeishuBotRelay } = require('../src');

// 创建中转系统实例
const relay = new FeishuBotRelay({
  port: 3000,
  maxRelayCount: 3,
  // 预注册一些机器人（可选，也可以通过API动态注册）
  bots: [
    {
      botId: 'cli_bot_a',
      name: 'Bot A',
      webhookUrl: 'https://bot-a.example.com/webhook',
      permissions: {
        canRelayTo: ['*'],
        canBeRelayedBy: ['*']
      }
    },
    {
      botId: 'cli_bot_b',
      name: 'Bot B',
      webhookUrl: 'https://bot-b.example.com/webhook',
      permissions: {
        canRelayTo: ['cli_bot_c'],
        canBeRelayedBy: ['cli_bot_a']
      }
    },
    {
      botId: 'cli_bot_c',
      name: 'Bot C',
      webhookUrl: 'https://bot-c.example.com/webhook'
    }
  ]
});

// 启动系统
relay.start()
  .then(() => {
    console.log('\n✅ System started successfully!');
    console.log('\n📡 Webhook endpoints:');
    console.log('  - POST http://localhost:3000/webhook/feishu');
    console.log('  - POST http://localhost:3000/webhook/feishu/:botId');
    console.log('  - POST http://localhost:3000/relay');
    console.log('\n📊 Management API:');
    console.log('  - GET  http://localhost:3000/health');
    console.log('  - GET  http://localhost:3000/api/bots');
    console.log('  - POST http://localhost:3000/api/bots');
    console.log('  - GET  http://localhost:3000/api/stats');
    console.log('\n💡 Try: curl http://localhost:3000/health\n');
  })
  .catch(error => {
    console.error('❌ Failed to start:', error);
    process.exit(1);
  });

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  await relay.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  await relay.stop();
  process.exit(0);
});
