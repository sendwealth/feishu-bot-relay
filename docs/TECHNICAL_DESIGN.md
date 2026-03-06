# 飞书机器人消息中转系统 - 技术方案设计

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         飞书平台                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Bot A   │  │ Bot B   │  │ Bot C   │  │ Bot D   │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
        └────────────┴────────────┴────────────┘
                           │
                    Webhook Events
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │         消息中转服务 (Relay Service)       │
        │                                          │
        │  ┌─────────────────────────────────────┐ │
        │  │   Event Listener (事件监听器)        │ │
        │  │   - 监听所有注册机器人的消息          │ │
        │  └──────────────┬──────────────────────┘ │
        │                 │                        │
        │                 ▼                        │
        │  ┌─────────────────────────────────────┐ │
        │  │   Message Parser (消息解析器)        │ │
        │  │   - 解析@提及                        │ │
        │  │   - 提取目标机器人                   │ │
        │  └──────────────┬──────────────────────┘ │
        │                 │                        │
        │                 ▼                        │
        │  ┌─────────────────────────────────────┐ │
        │  │   Message Queue (消息队列)           │ │
        │  │   - Redis / RabbitMQ                │ │
        │  └──────────────┬──────────────────────┘ │
        │                 │                        │
        │                 ▼                        │
        │  ┌─────────────────────────────────────┐ │
        │  │   Relay Engine (中转引擎)            │ │
        │  │   - 构造虚拟消息事件                  │ │
        │  │   - 调用目标机器人                   │ │
        │  └─────────────────────────────────────┘ │
        └──────────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │         Bot Handler Service              │
        │   (各机器人的业务逻辑处理服务)             │
        └──────────────────────────────────────────┘
```

### 1.2 核心组件

#### 1.2.1 Event Listener（事件监听器）
**职责：**
- 监听所有注册机器人的消息事件
- 通过飞书开放平台的 Event Subscription 接收消息
- 支持多种事件类型（消息、@提及、回复等）

**技术实现：**
```javascript
// 示例代码结构
class EventListener {
  constructor(config) {
    this.bots = config.bots; // 注册的机器人列表
    this.eventQueue = new MessageQueue();
  }

  // 处理飞书回调
  async handleFeishuEvent(event) {
    // 验证事件来源
    if (!this.validateEvent(event)) {
      return;
    }

    // 放入消息队列
    await this.eventQueue.publish('message:received', event);
  }
}
```

#### 1.2.2 Message Parser（消息解析器）
**职责：**
- 解析消息内容，提取@提及
- 识别@的目标是机器人还是用户
- 提取消息上下文信息

**技术实现：**
```javascript
class MessageParser {
  parse(message) {
    const mentions = this.extractMentions(message.content);
    const botMentions = mentions.filter(m => m.type === 'bot');
    
    return {
      messageId: message.message_id,
      chatId: message.chat_id,
      sender: message.sender,
      content: message.content,
      mentions: botMentions,
      timestamp: message.create_time
    };
  }

  extractMentions(content) {
    // 使用正则或飞书提供的富文本解析
    // 提取 <at user_id="xxx">名字</at> 格式的提及
    const regex = /<at user_id="([^"]+)">([^<]+)<\/at>/g;
    const mentions = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      mentions.push({
        id: match[1],
        name: match[2],
        type: this.getIdType(match[1]) // 'bot' or 'user'
      });
    }
    
    return mentions;
  }
}
```

#### 1.2.3 Relay Engine（中转引擎）
**职责：**
- 根据解析结果，确定目标机器人
- 构造虚拟消息事件
- 调用目标机器人的处理接口

**技术实现：**
```javascript
class RelayEngine {
  constructor(config) {
    this.botRegistry = new BotRegistry();
    this.httpClient = new HttpClient();
  }

  async relay(parsedMessage) {
    const { mentions, sender, chatId, content } = parsedMessage;
    
    // 防止循环
    if (await this.detectLoop(parsedMessage)) {
      console.warn('Loop detected, skipping relay');
      return;
    }

    // 为每个被@的机器人构造虚拟事件
    for (const mention of mentions) {
      const targetBot = this.botRegistry.get(mention.id);
      if (!targetBot) continue;

      // 检查权限
      if (!this.checkPermission(sender.botId, mention.id)) {
        continue;
      }

      // 构造虚拟消息事件
      const virtualEvent = {
        type: 'virtual.message.receive_v1',
        event: {
          sender: {
            sender_id: {
              open_id: sender.botId,
              type: 'app'
            },
            sender_type: 'app'
          },
          message: {
            message_id: `virtual_${Date.now()}_${Math.random()}`,
            root_id: parsedMessage.messageId,
            parent_id: parsedMessage.messageId,
            create_time: Date.now(),
            chat_id: chatId,
            content: content,
            mentions: [{
              id: mention.id,
              name: mention.name,
              type: 'bot'
            }],
            message_type: 'text'
          }
        }
      };

      // 调用目标机器人的webhook
      await this.sendToBot(targetBot, virtualEvent);
    }
  }

  async sendToBot(bot, event) {
    try {
      const response = await this.httpClient.post(bot.webhookUrl, {
        event: event,
        signature: this.signEvent(event, bot.secret)
      });
      
      // 记录日志
      await this.logRelay(bot.id, event, response);
    } catch (error) {
      console.error(`Failed to relay to bot ${bot.id}:`, error);
      // 重试逻辑
    }
  }
}
```

#### 1.2.4 Bot Registry（机器人注册中心）
**职责：**
- 管理所有注册的机器人信息
- 提供机器人的增删改查接口
- 缓存机器人信息，提高查询效率

**数据结构：**
```javascript
// MongoDB Schema
const BotSchema = {
  botId: String,           // 机器人ID (cli_xxx)
  openId: String,          // 机器人Open ID (ou_xxx)
  name: String,            // 机器人名称
  appId: String,           // 应用ID
  appSecret: String,       // 应用密钥（加密存储）
  webhookUrl: String,      // 消息处理回调地址
  permissions: {
    canRelayTo: [String],  // 可以@哪些机器人
    canBeRelayedBy: [String] // 可以被哪些机器人@
  },
  status: String,          // active, inactive
  createdAt: Date,
  updatedAt: Date
};
```

---

## 2. 数据流设计

### 2.1 消息中转流程

```
1. Bot A 在群聊中发送消息："@Bot B 请帮我分析这个数据"
   │
   ├─> 2. 飞书平台推送事件到 Event Listener
   │      └─> Event: im.message.receive_v1
   │
   ├─> 3. Event Listener 验证事件，放入消息队列
   │      └─> Queue: message:received
   │
   ├─> 4. Message Parser 从队列消费消息
   │      ├─> 解析消息内容
   │      ├─> 提取@提及：Bot B
   │      └─> 返回解析结果
   │
   ├─> 5. Relay Engine 处理解析结果
   │      ├─> 检查权限：Bot A 是否可以@ Bot B
   │      ├─> 检测循环：防止无限转发
   │      ├─> 构造虚拟消息事件
   │      └─> 调用 Bot B 的 Webhook
   │
   └─> 6. Bot B 收到虚拟消息事件
          ├─> 正常处理消息
          └─> 回复："好的，我来帮你分析..."
```

### 2.2 虚拟消息事件格式

```json
{
  "schema": "openclaw.relay.v1",
  "type": "virtual.message.receive_v1",
  "event": {
    "sender": {
      "sender_id": {
        "open_id": "cli_aabbccdd",
        "type": "app"
      },
      "sender_type": "app",
      "tenant_key": "xxxxxx"
    },
    "message": {
      "message_id": "virtual_1709877600000_0.123",
      "root_id": "om_abc123",
      "parent_id": "om_abc123",
      "create_time": 1709877600000,
      "chat_id": "oc_xxxx",
      "content": "<at user_id=\"cli_bbccdd\">Bot B</at> 请帮我分析这个数据",
      "mentions": [
        {
          "id": "cli_bbccdd",
          "name": "Bot B",
          "type": "bot"
        }
      ],
      "message_type": "text"
    },
    "relay_context": {
      "original_message_id": "om_abc123",
      "relay_chain": ["cli_aabbccdd"],
      "relay_count": 1
    }
  },
  "signature": "sha256=xxxxxx"
}
```

---

## 3. 关键技术实现

### 3.1 循环检测算法

```javascript
class LoopDetector {
  constructor(maxRelayCount = 3) {
    this.maxRelayCount = maxRelayCount;
  }

  detect(event) {
    const { relay_context } = event;
    
    // 检查转发次数
    if (relay_context.relay_count >= this.maxRelayCount) {
      return true;
    }

    // 检查转发链中是否有重复
    const chain = relay_context.relay_chain;
    const unique = new Set(chain);
    if (unique.size !== chain.length) {
      return true;
    }

    return false;
  }
}
```

### 3.2 权限控制

```javascript
class PermissionManager {
  constructor(botRegistry) {
    this.registry = botRegistry;
  }

  canRelay(fromBotId, toBotId) {
    const fromBot = this.registry.get(fromBotId);
    const toBot = this.registry.get(toBotId);

    // 检查发送方是否有权限
    if (fromBot.permissions.canRelayTo.length > 0) {
      if (!fromBot.permissions.canRelayTo.includes(toBotId)) {
        return false;
      }
    }

    // 检查接收方是否允许
    if (toBot.permissions.canBeRelayedBy.length > 0) {
      if (!toBot.permissions.canBeRelayedBy.includes(fromBotId)) {
        return false;
      }
    }

    return true;
  }
}
```

### 3.3 消息签名验证

```javascript
const crypto = require('crypto');

class SignatureUtil {
  static sign(event, secret) {
    const timestamp = Date.now();
    const stringToSign = `${timestamp}\n${JSON.stringify(event)}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const signature = hmac.digest('hex');
    
    return `sha256=${signature}&t=${timestamp}`;
  }

  static verify(event, signature, secret) {
    const match = signature.match(/sha256=([^&]+)&t=(\d+)/);
    if (!match) return false;

    const [, expectedSig, timestamp] = match;
    const stringToSign = `${timestamp}\n${JSON.stringify(event)}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(stringToSign);
    const actualSig = hmac.digest('hex');

    return expectedSig === actualSig;
  }
}
```

---

## 4. 部署架构

### 4.1 生产环境部署

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                          │
│                   (Nginx / ALB)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│ Relay   │    │ Relay   │    │ Relay   │
│ Service │    │ Service │    │ Service │
│   #1    │    │   #2    │    │   #3    │
└────┬────┘    └────┬────┘    └────┬────┘
     │               │               │
     └───────────────┼───────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │  Redis  │ │ MongoDB │ │ RabbitMQ│
    │ (Cache) │ │  (DB)   │ │  (MQ)   │
    └─────────┘ └─────────┘ └─────────┘
```

### 4.2 Docker Compose 配置

```yaml
version: '3.8'

services:
  relay-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/relay
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - mongo
      - redis
      - rabbitmq
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure

  mongo:
    image: mongo:6.0
    volumes:
      - mongo-data:/data/db

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "15672:15672"
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq

volumes:
  mongo-data:
  redis-data:
  rabbitmq-data:
```

---

## 5. API 设计

### 5.1 管理接口

#### 注册机器人
```http
POST /api/v1/bots
Content-Type: application/json

{
  "botId": "cli_aabbccdd",
  "openId": "ou_xxxx",
  "name": "Data Bot",
  "appId": "cli_aabbccdd",
  "appSecret": "xxxxxx",
  "webhookUrl": "https://example.com/bot/webhook",
  "permissions": {
    "canRelayTo": ["*"],
    "canBeRelayedBy": ["*"]
  }
}
```

#### 查询机器人列表
```http
GET /api/v1/bots
```

#### 更新机器人配置
```http
PUT /api/v1/bots/:botId
```

#### 删除机器人
```http
DELETE /api/v1/bots/:botId
```

### 5.2 Webhook 接口

#### 飞书事件回调
```http
POST /webhook/feishu/:botId
Content-Type: application/json
X-Lark-Signature: xxxxxx
X-Lark-Timestamp: 1709877600
X-Lark-Nonce: abc123

{
  "schema": "2.0",
  "header": {
    "event_id": "xxxxx",
    "event_type": "im.message.receive_v1",
    "tenant_key": "xxxxx"
  },
  "event": {
    // 消息事件内容
  }
}
```

---

## 6. 监控与告警

### 6.1 监控指标

```javascript
// Prometheus 指标
const metrics = {
  // 消息处理计数
  messagesReceived: new Counter({
    name: 'relay_messages_received_total',
    help: 'Total messages received',
    labelNames: ['bot_id']
  }),

  // 中转计数
  messagesRelayed: new Counter({
    name: 'relay_messages_relayed_total',
    help: 'Total messages relayed',
    labelNames: ['from_bot', 'to_bot']
  }),

  // 处理延迟
  relayLatency: new Histogram({
    name: 'relay_latency_seconds',
    help: 'Message relay latency',
    buckets: [0.1, 0.3, 0.5, 1, 2, 5]
  }),

  // 错误计数
  errors: new Counter({
    name: 'relay_errors_total',
    help: 'Total errors',
    labelNames: ['type', 'bot_id']
  })
};
```

### 6.2 日志规范

```javascript
// 结构化日志
{
  "timestamp": "2024-03-06T10:44:35.000Z",
  "level": "info",
  "service": "relay-service",
  "event": "message_relayed",
  "data": {
    "messageId": "om_abc123",
    "fromBot": "cli_aabbccdd",
    "toBot": "cli_bbccdd",
    "chatId": "oc_xxxx",
    "latency": 123
  }
}
```

---

## 7. 安全设计

### 7.1 安全措施

1. **消息签名验证**
   - 所有中转消息都需要签名
   - 使用 HMAC-SHA256 算法
   - 防止消息伪造

2. **权限控制**
   - 机器人级别的权限控制
   - 支持白名单/黑名单

3. **数据加密**
   - 敏感信息（App Secret）加密存储
   - HTTPS 传输

4. **防重放攻击**
   - 消息时间戳验证
   - 消息 ID 去重

5. **限流保护**
   - API 限流
   - 消息队列限流

---

## 8. 扩展性设计

### 8.1 插件系统

```javascript
// 插件接口
interface RelayPlugin {
  name: string;
  version: string;
  
  // 在消息解析前执行
  beforeParse?(message: any): Promise<any>;
  
  // 在消息解析后执行
  afterParse?(parsed: ParsedMessage): Promise<ParsedMessage>;
  
  // 在中转前执行
  beforeRelay?(event: VirtualEvent): Promise<VirtualEvent>;
  
  // 在中转后执行
  afterRelay?(result: RelayResult): Promise<void>;
}

// 插件示例：消息过滤
class MessageFilterPlugin implements RelayPlugin {
  name = 'message-filter';
  version = '1.0.0';

  async beforeRelay(event) {
    // 过滤敏感词
    event.event.message.content = this.filterSensitiveWords(
      event.event.message.content
    );
    return event;
  }
}
```

---

## 9. 测试策略

### 9.1 单元测试
- Message Parser 测试
- Loop Detector 测试
- Permission Manager 测试
- Signature Util 测试

### 9.2 集成测试
- 端到端消息中转流程测试
- 多机器人协同测试
- 权限控制测试

### 9.3 性能测试
- 并发消息处理测试
- 压力测试
- 延迟测试

---

## 10. 上线计划

### 10.1 阶段一：开发与测试（2周）
- 核心功能开发
- 单元测试与集成测试
- 本地环境测试

### 10.2 阶段二：灰度发布（1周）
- 选择2-3个机器人接入
- 监控系统稳定性
- 收集反馈

### 10.3 阶段三：正式发布（1周）
- 全量开放
- 监控与优化
- 文档完善

---

## 11. 技术选型

| 组件 | 技术选型 | 理由 |
|------|---------|------|
| 后端框架 | Node.js + Express | 与OpenClaw技术栈一致，生态丰富 |
| 数据库 | MongoDB | 灵活的Schema，适合存储机器人配置 |
| 消息队列 | RabbitMQ | 可靠性高，支持消息持久化 |
| 缓存 | Redis | 高性能，支持分布式锁 |
| 监控 | Prometheus + Grafana | 开源，功能强大 |
| 日志 | ELK Stack | Elasticsearch + Logstash + Kibana |
| 部署 | Docker + Kubernetes | 容器化，易于扩展 |

---

## 12. 参考资料

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [飞书事件订阅](https://open.feishu.cn/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM)
- [RabbitMQ最佳实践](https://www.rabbitmq.com/best-practices.html)
- [Node.js性能优化](https://nodejs.org/en/docs/guides/)
