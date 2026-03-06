/**
 * 快速启动示例
 */

const { FeishuBotRelay } = require('../src/index');

// 创建中转服务实例
const relay = new FeishuBotRelay({
  port: 3000,
  maxRelayCount: 3
});

// 注册示例机器人
relay.registerBot({
  botId: 'cli_bot_a',
  openId: 'ou_bot_a',
  name: 'Bot A',
  appId: 'cli_bot_a',
  appSecret: 'secret_a',
  webhookUrl: 'https://bot-a.example.com/webhook',
  permissions: {
    canRelayTo: ['*'],
    canBeRelayedBy: ['*']
  },
  status: 'active'
});

relay.registerBot({
  botId: 'cli_bot_b',
  openId: 'ou_bot_b',
  name: 'Bot B',
  appId: 'cli_bot_b',
  appSecret: 'secret_b',
  webhookUrl: 'https://bot-b.example.com/webhook',
  permissions: {
    canRelayTo: ['*'],
    canBeRelayedBy: ['*']
  },
  status: 'active'
});

relay.registerBot({
  botId: 'cli_bot_c',
  openId: 'ou_bot_c',
  name: 'Bot C',
  appId: 'cli_bot_c',
  appSecret: 'secret_c',
  webhookUrl: 'https://bot-c.example.com/webhook',
  permissions: {
    canRelayTo: ['cli_bot_b'],
    canBeRelayedBy: ['cli_bot_a']
  },
  status: 'active'
});

// 启动服务
relay.start().then(() => {
  console.log('\n✅ Service started successfully!');
  console.log('\n📋 Registered bots:');
  console.log('  - Bot A (cli_bot_a)');
  console.log('  - Bot B (cli_bot_b)');
  console.log('  - Bot C (cli_bot_c)');
  console.log('\n🔧 Test endpoints:');
  console.log('  - POST http://localhost:3000/webhook/feishu/:botId');
  console.log('  - POST http://localhost:3000/api/test/relay');
  console.log('  - GET  http://localhost:3000/api/bots');
  console.log('\n💡 Press Ctrl+C to stop\n');
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await relay.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await relay.stop();
  process.exit(0);
});
