// Mock Feishu message events and test data

const mockFeishuEvents = {
  // Simple text message with @mention
  simpleMessage: {
    schema: "2.0",
    header: {
      event_id: "ev_test_001",
      event_type: "im.message.receive_v1",
      tenant_key: "tenant_abc123",
      create_time: 1709877600000
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
        message_id: "om_001",
        root_id: "",
        parent_id: "",
        create_time: 1709877600000,
        chat_id: "oc_group_001",
        content: '<at user_id="cli_bot_b">Bot B</at> 请帮我分析这个数据',
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
  },

  // Multiple @mentions
  multipleMentions: {
    schema: "2.0",
    header: {
      event_id: "ev_test_002",
      event_type: "im.message.receive_v1",
      tenant_key: "tenant_abc123",
      create_time: 1709877601000
    },
    event: {
      sender: {
        sender_id: {
          open_id: "cli_bot_a",
          type: "app"
        },
        sender_type: "app"
      },
      message: {
        message_id: "om_002",
        chat_id: "oc_group_001",
        content: '<at user_id="cli_bot_b">Bot B</at> <at user_id="cli_bot_c">Bot C</at> 协作处理',
        mentions: [
          { id: "cli_bot_b", name: "Bot B", type: "bot" },
          { id: "cli_bot_c", name: "Bot C", type: "bot" }
        ],
        message_type: "text"
      }
    }
  },

  // Message with user mention (should be filtered)
  userMention: {
    schema: "2.0",
    header: {
      event_id: "ev_test_003",
      event_type: "im.message.receive_v1",
      tenant_key: "tenant_abc123"
    },
    event: {
      sender: {
        sender_id: {
          open_id: "cli_bot_a",
          type: "app"
        },
        sender_type: "app"
      },
      message: {
        message_id: "om_003",
        chat_id: "oc_group_001",
        content: '<at user_id="ou_user_001">User</at> 你好',
        mentions: [
          { id: "ou_user_001", name: "User", type: "user" }
        ],
        message_type: "text"
      }
    }
  },

  // Virtual relay message (relay chain depth 1)
  virtualRelayMessage: {
    schema: "openclaw.relay.v1",
    type: "virtual.message.receive_v1",
    event: {
      sender: {
        sender_id: {
          open_id: "cli_bot_a",
          type: "app"
        },
        sender_type: "app"
      },
      message: {
        message_id: "virtual_001",
        root_id: "om_original",
        parent_id: "om_original",
        create_time: 1709877602000,
        chat_id: "oc_group_001",
        content: '<at user_id="cli_bot_c">Bot C</at> 处理这个',
        mentions: [
          { id: "cli_bot_c", name: "Bot C", type: "bot" }
        ],
        message_type: "text",
        relay_context: {
          original_message_id: "om_original",
          relay_chain: ["cli_bot_a"],
          relay_count: 1
        }
      },
      relay_context: {
        original_message_id: "om_original",
        relay_chain: ["cli_bot_a"],
        relay_count: 1
      }
    }
  },

  // Deep relay chain (should trigger loop detection)
  deepRelayChain: {
    schema: "openclaw.relay.v1",
    type: "virtual.message.receive_v1",
    event: {
      sender: {
        sender_id: {
          open_id: "cli_bot_c",
          type: "app"
        },
        sender_type: "app"
      },
      message: {
        message_id: "virtual_003",
        chat_id: "oc_group_001",
        content: "Forwarding",
        message_type: "text"
      },
      relay_context: {
        original_message_id: "om_original",
        relay_chain: ["cli_bot_a", "cli_bot_b", "cli_bot_c"],
        relay_count: 3
      }
    }
  },

  // Circular relay (should be detected and blocked)
  circularRelay: {
    schema: "openclaw.relay.v1",
    type: "virtual.message.receive_v1",
    event: {
      sender: {
        sender_id: {
          open_id: "cli_bot_a",
          type: "app"
        },
        sender_type: "app"
      },
      message: {
        message_id: "virtual_004",
        chat_id: "oc_group_001",
        content: "Circular",
        message_type: "text"
      },
      relay_context: {
        original_message_id: "om_original",
        relay_chain: ["cli_bot_a", "cli_bot_b", "cli_bot_a"],
        relay_count: 3
      }
    }
  }
};

const mockBots = {
  botA: {
    botId: "cli_bot_a",
    openId: "ou_bot_a",
    name: "Bot A",
    appId: "cli_bot_a",
    appSecret: "secret_a",
    webhookUrl: "https://bot-a.example.com/webhook",
    permissions: {
      canRelayTo: ["*"],
      canBeRelayedBy: ["*"]
    },
    status: "active"
  },

  botB: {
    botId: "cli_bot_b",
    openId: "ou_bot_b",
    name: "Bot B",
    appId: "cli_bot_b",
    appSecret: "secret_b",
    webhookUrl: "https://bot-b.example.com/webhook",
    permissions: {
      canRelayTo: ["cli_bot_c"],
      canBeRelayedBy: ["cli_bot_a"]
    },
    status: "active"
  },

  botC: {
    botId: "cli_bot_c",
    openId: "ou_bot_c",
    name: "Bot C",
    appId: "cli_bot_c",
    appSecret: "secret_c",
    webhookUrl: "https://bot-c.example.com/webhook",
    permissions: {
      canRelayTo: [],
      canBeRelayedBy: ["cli_bot_a", "cli_bot_b"]
    },
    status: "active"
  },

  botInactive: {
    botId: "cli_bot_inactive",
    openId: "ou_bot_inactive",
    name: "Inactive Bot",
    appId: "cli_bot_inactive",
    appSecret: "secret_inactive",
    webhookUrl: "https://inactive.example.com/webhook",
    permissions: {
      canRelayTo: ["*"],
      canBeRelayedBy: ["*"]
    },
    status: "inactive"
  }
};

module.exports = {
  mockFeishuEvents,
  mockBots
};
