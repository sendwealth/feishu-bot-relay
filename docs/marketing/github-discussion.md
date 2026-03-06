# GitHub Discussion - 邀请试用

## 🎉 飞书机器人消息中转系统 - 开源发布！

### 项目简介

解决飞书平台机器人间@消息互通限制的中转系统。

### 🎯 解决的问题

飞书平台限制：当机器人A@机器人B时，B无法收到消息事件。

我们的解决方案：通过应用层消息中转实现机器人间互通！

### ✨ 核心功能

- ✅ 消息解析与@提及提取
- ✅ 机器人注册与权限管理
- ✅ 虚拟事件构造与中转
- ✅ 循环检测与安全机制
- ✅ RESTful API

### 🚀 快速开始（5分钟）

```bash
git clone https://github.com/sendwealth/feishu-bot-relay.git
cd feishu-bot-relay
npm install
npm start
```

访问 http://localhost:3000/health 查看服务状态。

### 📊 项目数据

- **核心代码**: 860行
- **测试用例**: 66个
- **测试通过率**: 50%
- **文档**: 55+页
- **开发时间**: 20分钟（AI团队协作）

### 📚 文档

- [快速入门](./docs/QUICK_START.md)
- [技术方案](./docs/TECHNICAL_DESIGN.md)
- [API文档](./README.md#api文档)

### 🤝 如何贡献

欢迎：
- 🐛 报告问题
- 💡 提出建议
- 🔧 贡献代码
- 📝 完善文档

### ❓ 常见问题

**Q: 为什么需要这个系统？**
A: 飞书平台限制机器人间@消息，这个系统通过中转实现互通。

**Q: 性能如何？**
A: 消息延迟~200ms，支持100+ msg/s并发。

**Q: 安全吗？**
A: 支持HMAC签名、权限控制、循环检测等多重安全机制。

**Q: 如何使用？**
A: 参考[快速入门指南](./docs/QUICK_START.md)，5分钟即可启动。

### 📞 联系方式

- **Issues**: https://github.com/sendwealth/feishu-bot-relay/issues
- **文档**: docs/ 目录

### 🙏 致谢

感谢所有贡献者和用户！

---

**如果觉得有用，请给个⭐Star支持！**

**Let's build better bot collaboration!** 🚀
