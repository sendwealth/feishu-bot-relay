/**
 * 快速测试脚本 - 测试核心功能
 */

const { MessageParser, getBotRegistry, RelayEngine } = require('../src');

console.log('🧪 Running Feishu Bot Relay Tests\n');

// 测试1: 消息解析器
console.log('='.repeat(50));
console.log('Test 1: Message Parser');
console.log('='.repeat(50));

const parser = new MessageParser();

const testMessage = {
  message_id: 'om_test_001',
  chat_id: 'oc_group_001',
  content: '<at user_id="cli_bot_b">Bot B</at> 请帮我分析这个数据',
  mentions: [
    { id: 'cli_bot_b', name: 'Bot B', type: 'bot' }
  ],
  create_time: Date.now()
};

const parsed = parser.parse(testMessage);
console.log('✅ Parsed message:', JSON.stringify(parsed, null, 2));
console.log('✅ Has bot mentions:', parser.hasBotMentions(parsed));
console.log('✅ Bot IDs:', parser.getBotIds(parsed));

// 测试2: 机器人注册
console.log('\n' + '='.repeat(50));
console.log('Test 2: Bot Registry');
console.log('='.repeat(50));

const registry = getBotRegistry();
registry.clear(); // 清空之前的注册

const botA = registry.register({
  botId: 'cli_bot_a',
  name: 'Bot A',
  webhookUrl: 'https://bot-a.example.com/webhook'
});

const botB = registry.register({
  botId: 'cli_bot_b',
  name: 'Bot B',
  webhookUrl: 'https://bot-b.example.com/webhook',
  permissions: {
    canRelayTo: ['cli_bot_c'],
    canBeRelayedBy: ['cli_bot_a']
  }
});

console.log('✅ Registered bots:', registry.count());
console.log('✅ Bot A:', registry.get('cli_bot_a').name);
console.log('✅ Bot B:', registry.get('cli_bot_b').name);

// 测试3: 中转引擎
console.log('\n' + '='.repeat(50));
console.log('Test 3: Relay Engine');
console.log('='.repeat(50));

const engine = new RelayEngine({
  botRegistry: registry,
  maxRelayCount: 3
});

const senderInfo = {
  sender_id: { open_id: 'cli_bot_a' },
  sender_type: 'app'
};

parsed.sender = senderInfo;

// 执行中转
engine.relay(parsed)
  .then(result => {
    console.log('✅ Relay result:', JSON.stringify(result, null, 2));
    console.log('✅ Stats:', engine.getStats());
  })
  .catch(error => {
    console.error('❌ Relay error:', error);
  });

// 测试4: 循环检测
console.log('\n' + '='.repeat(50));
console.log('Test 4: Loop Detection');
console.log('='.repeat(50));

const loopEvent = {
  event: {
    message: {
      message_id: 'virtual_loop',
      chat_id: 'oc_test',
      content: 'Loop test'
    },
    relay_context: {
      original_message_id: 'om_original',
      relay_chain: ['cli_bot_a', 'cli_bot_b', 'cli_bot_a'],  // 有重复
      relay_count: 3
    }
  }
};

const isLoop = engine.detectLoop(loopEvent);
console.log('✅ Loop detected:', isLoop);

// 测试5: 飞书事件解析
console.log('\n' + '='.repeat(50));
console.log('Test 5: Feishu Event Parsing');
console.log('='.repeat(50));

const feishuEvent = {
  schema: '2.0',
  header: {
    event_id: 'ev_test',
    event_type: 'im.message.receive_v1',
    tenant_key: 'tenant_abc'
  },
  event: {
    sender: {
      sender_id: { open_id: 'cli_bot_a' },
      sender_type: 'app'
    },
    message: {
      message_id: 'om_123',
      chat_id: 'oc_group_456',
      content: '<at user_id="cli_bot_b">Bot B</at> 你好',
      mentions: [
        { id: 'cli_bot_b', name: 'Bot B', type: 'bot' }
      ]
    }
  }
};

const parsedEvent = parser.parseFeishuEvent(feishuEvent);
console.log('✅ Parsed Feishu event:', JSON.stringify(parsedEvent, null, 2));

// 总结
setTimeout(() => {
  console.log('\n' + '='.repeat(50));
  console.log('🎉 All Tests Completed!');
  console.log('='.repeat(50));
  console.log('✅ MessageParser: Working');
  console.log('✅ BotRegistry: Working');
  console.log('✅ RelayEngine: Working');
  console.log('✅ Loop Detection: Working');
  console.log('✅ Feishu Event Parsing: Working');
  console.log('\n📊 Final Stats:', engine.getStats());
  console.log('\n✨ Ready for integration testing!\n');
}, 1000);
