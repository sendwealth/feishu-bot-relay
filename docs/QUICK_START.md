# 快速入门指南

本指南将帮助你在5分钟内启动并运行飞书机器人消息中转系统。

## 🎯 目标

完成本指南后，你将：
- ✅ 启动一个本地中转服务
- ✅ 注册2个测试机器人
- ✅ 测试机器人间的消息中转

## 📋 前置要求

- Node.js 18+ 已安装
- 终端/命令行工具

## 🚀 步骤1: 安装和启动（2分钟）

```bash
# 进入项目目录
cd ~/clawd/projects/feishu-bot-relay

# 安装依赖（如果还没安装）
npm install

# 启动服务
npm start
```

你会看到类似输出：

```
🚀 Feishu Bot Relay Service running on port 3000
📡 Health check: http://localhost:3000/health
🤖 Bot management: http://localhost:3000/api/bots

✅ Service started successfully!

📋 Registered bots:
  - Bot A (cli_bot_a)
  - Bot B (cli_bot_b)
  - Bot C (cli_bot_c)
```

## 🧪 步骤2: 验证服务（1分钟）

打开新终端窗口，运行测试：

```bash
# 运行系统测试
node examples/test-system.js
```

你应该看到：

```
🧪 Testing Feishu Bot Relay System

1️⃣ Testing health check...
✅ Health check passed

2️⃣ Getting bot list...
✅ Found 3 bots:
   - Bot A (cli_bot_a) - active
   - Bot B (cli_bot_b) - active
   - Bot C (cli_bot_c) - active

3️⃣ Simulating Feishu message event...
✅ Message processed

4️⃣ Testing relay API...
✅ Relay test result

🎉 All tests passed!
```

## 📡 步骤3: 测试API接口（2分钟）

### 检查健康状态

```bash
curl http://localhost:3000/health
```

返回：
```json
{
  "status": "ok",
  "timestamp": "2026-03-06T03:04:05.678Z",
  "bots": {
    "total": 3,
    "active": 3,
    "inactive": 0
  }
}
```

### 获取机器人列表

```bash
curl http://localhost:3000/api/bots
```

### 注册新机器人

```bash
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -d '{
    "botId": "cli_my_bot",
    "name": "My Custom Bot",
    "webhookUrl": "https://my-bot.example.com/webhook",
    "appSecret": "my_secret",
    "permissions": {
      "canRelayTo": ["*"],
      "canBeRelayedBy": ["*"]
    },
    "status": "active"
  }'
```

### 测试消息中转

```bash
curl -X POST http://localhost:3000/api/test/relay \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": "om_test_001",
      "chat_id": "oc_test_group",
      "content": "<at user_id=\"cli_bot_b\">Bot B</at> 你好，请帮我处理这个请求",
      "mentions": [
        { "id": "cli_bot_b", "name": "Bot B", "type": "bot" }
      ],
      "message_type": "text",
      "create_time": '$(date +%s000)'
    }
  }'
```

## 🎓 下一步

恭喜！你已经成功运行了飞书机器人消息中转系统。

### 继续学习：

1. **阅读完整文档**
   - [README.md](../README.md) - 完整使用指南
   - [PRD.md](../docs/PRD.md) - 产品需求
   - [TECHNICAL_DESIGN.md](../docs/TECHNICAL_DESIGN.md) - 技术方案

2. **接入真实机器人**
   - 在飞书开放平台创建机器人应用
   - 配置事件订阅URL
   - 注册到中转服务

3. **自定义配置**
   - 修改权限控制
   - 调整循环检测参数
   - 添加自定义插件

4. **部署到生产环境**
   - 使用Docker部署
   - 配置HTTPS
   - 设置监控告警

## 🐛 常见问题

### Q: 端口3000被占用怎么办？

修改环境变量：
```bash
PORT=3001 npm start
```

或在 `.env` 文件中设置：
```
PORT=3001
```

### Q: 如何停止服务？

在运行服务的终端按 `Ctrl+C`

### Q: 测试失败怎么办？

确保：
1. 服务正在运行
2. 端口没有被防火墙阻止
3. Node.js版本 >= 18

### Q: 如何查看日志？

服务日志会直接输出到终端。你可以重定向到文件：

```bash
npm start > logs/relay.log 2>&1
```

## 📞 获取帮助

- 查看文档：`docs/` 目录
- 提交问题：GitHub Issues
- 查看示例：`examples/` 目录

---

**🎉 开始构建你的机器人协作系统吧！**
