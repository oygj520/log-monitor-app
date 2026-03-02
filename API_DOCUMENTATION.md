# LogMonitor API 文档

## 概述

LogMonitor 提供完整的 REST API 接口，支持外部系统集成、Webhook 通知和自动化运维。

## 基础信息

- **默认端口**: 3889
- **认证方式**: API Key (通过 `X-API-Key` 请求头)
- **数据格式**: JSON
- **CORS**: 支持跨域请求（可配置）

## 快速开始

### 1. 获取 API Key

API Key 在首次启动时自动生成，存储在配置文件中。

```bash
# 通过 API 获取配置（需要已知的 API Key）
curl -H "X-API-Key: your-api-key" http://localhost:3889/api/config
```

### 2. 启用 API 服务

在系统设置中启用 API 服务，或通过配置文件：

```json
{
  "api": {
    "enabled": true,
    "port": 3889,
    "rateLimit": 100
  }
}
```

## API 端点

### 健康检查

**GET** `/health`

无需认证，用于检查服务状态。

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2024-03-02T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600.5,
  "services": {
    "database": "connected",
    "api": "running"
  }
}
```

---

### 获取日志

**GET** `/api/logs`

**认证**: 需要 API Key

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| level | string | 否 | 日志级别 (INFO, ERROR, WARN, DEBUG, etc.) |
| source | string | 否 | 日志来源/文件路径 |
| limit | number | 否 | 返回数量限制，默认 100 |
| offset | number | 否 | 偏移量，默认 0 |
| startTime | string | 否 | 开始时间 (ISO8601) |
| endTime | string | 否 | 结束时间 (ISO8601) |

**请求示例**:
```bash
curl -H "X-API-Key: lm_abc123..." \
  "http://localhost:3889/api/logs?level=ERROR&limit=50"
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "log_001",
      "level": "ERROR",
      "message": "Connection timeout",
      "source": "/var/log/app.log",
      "timestamp": "2024-03-02T12:00:00.000Z",
      "stackTrace": "..."
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1234
  }
}
```

---

### 获取统计信息

**GET** `/api/statistics`

**认证**: 需要 API Key

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timeRange | string | 否 | 时间范围 (1h, 24h, 7d, 30d)，默认 24h |

**请求示例**:
```bash
curl -H "X-API-Key: lm_abc123..." \
  "http://localhost:3889/api/statistics?timeRange=7d"
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "byLevel": [
      { "level": "INFO", "count": 10000 },
      { "level": "ERROR", "count": 150 },
      { "level": "WARN", "count": 500 }
    ],
    "timeTrend": [
      { "hour": "2024-03-02T12:00:00", "count": 100 }
    ],
    "bySource": [
      { "source": "/var/log/app.log", "count": 5000 }
    ],
    "topErrors": [
      { "message": "Connection timeout", "count": 50 }
    ]
  }
}
```

---

### Webhook 管理

#### 获取 Webhook 列表

**GET** `/api/webhooks`

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "wh_abc123",
      "name": "Alert Webhook",
      "url": "https://example.com/webhook",
      "events": ["alert", "error"],
      "active": true,
      "createdAt": "2024-03-02T12:00:00.000Z"
    }
  ]
}
```

#### 创建 Webhook

**POST** `/api/webhooks`

**请求体**:
```json
{
  "name": "Alert Webhook",
  "url": "https://example.com/webhook",
  "events": ["alert", "error"],
  "active": true
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "wh_abc123",
    "name": "Alert Webhook",
    "url": "https://example.com/webhook",
    "events": ["alert", "error"],
    "active": true,
    "createdAt": "2024-03-02T12:00:00.000Z"
  }
}
```

#### 删除 Webhook

**DELETE** `/api/webhooks?id={webhookId}`

**响应示例**:
```json
{
  "success": true
}
```

---

### 配置管理

#### 获取 API 配置

**GET** `/api/config`

**响应示例**:
```json
{
  "success": true,
  "data": {
    "enabled": true,
    "port": 3889,
    "rateLimit": 100,
    "corsOrigins": ["*"],
    "webhooksCount": 2
  }
}
```

#### 更新 API 配置

**PUT** `/api/config`

**请求体**:
```json
{
  "enabled": true,
  "port": 3889,
  "rateLimit": 200,
  "corsOrigins": ["https://example.com"]
}
```

---

## Webhook 事件

系统会在以下事件发生时触发 Webhook：

| 事件 | 说明 | 触发条件 |
|------|------|----------|
| `alert` | 告警触发 | 监控规则匹配 |
| `error` | 错误日志 | 检测到 ERROR 级别日志 |
| `critical` | 严重错误 | 检测到 FATAL/CRITICAL 级别日志 |

**Webhook Payload**:
```json
{
  "event": "alert",
  "data": {
    "level": "ERROR",
    "message": "Connection timeout",
    "source": "/var/log/app.log",
    "timestamp": "2024-03-02T12:00:00.000Z"
  },
  "timestamp": "2024-03-02T12:00:00.000Z",
  "source": "LogMonitor"
}
```

---

## 认证

所有 API 端点（除了 `/health`）都需要 API Key 认证。

### 方式一：X-API-Key 请求头

```bash
curl -H "X-API-Key: lm_your_api_key_here" \
  http://localhost:3889/api/logs
```

### 方式二：Bearer Token

```bash
curl -H "Authorization: Bearer lm_your_api_key_here" \
  http://localhost:3889/api/logs
```

---

## 错误处理

**错误响应格式**:
```json
{
  "error": "Error Type",
  "message": "Human readable message"
}
```

**常见错误码**:
| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未授权（API Key 无效或缺失） |
| 404 | 资源不存在 |
| 405 | 方法不允许 |
| 500 | 服务器内部错误 |

---

## 使用示例

### Python 示例

```python
import requests

API_KEY = 'lm_your_api_key_here'
BASE_URL = 'http://localhost:3889'

headers = {'X-API-Key': API_KEY}

# 获取错误日志
response = requests.get(
    f'{BASE_URL}/api/logs',
    headers=headers,
    params={'level': 'ERROR', 'limit': 10}
)
logs = response.json()

# 获取统计信息
response = requests.get(
    f'{BASE_URL}/api/statistics',
    headers=headers,
    params={'timeRange': '24h'}
)
stats = response.json()

# 创建 Webhook
response = requests.post(
    f'{BASE_URL}/api/webhooks',
    headers=headers,
    json={
        'name': 'Slack Alert',
        'url': 'https://hooks.slack.com/xxx',
        'events': ['alert', 'error']
    }
)
```

### Node.js 示例

```javascript
const axios = require('axios');

const API_KEY = 'lm_your_api_key_here';
const BASE_URL = 'http://localhost:3889';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'X-API-Key': API_KEY }
});

// 获取错误日志
const logs = await api.get('/api/logs', {
  params: { level: 'ERROR', limit: 10 }
});

// 获取统计
const stats = await api.get('/api/statistics', {
  params: { timeRange: '24h' }
});

// 创建 Webhook
const webhook = await api.post('/api/webhooks', {
  name: 'Slack Alert',
  url: 'https://hooks.slack.com/xxx',
  events: ['alert', 'error']
});
```

### cURL 示例

```bash
# 健康检查
curl http://localhost:3889/health

# 获取日志
curl -H "X-API-Key: lm_key" \
  "http://localhost:3889/api/logs?level=ERROR"

# 获取统计
curl -H "X-API-Key: lm_key" \
  "http://localhost:3889/api/statistics?timeRange=7d"

# 创建 Webhook
curl -X POST \
  -H "X-API-Key: lm_key" \
  -H "Content-Type: application/json" \
  -d '{"name":"Alert","url":"https://example.com/webhook","events":["alert"]}' \
  http://localhost:3889/api/webhooks
```

---

## 安全建议

1. **保护 API Key**: 不要将 API Key 提交到版本控制系统
2. **限制 CORS**: 在生产环境中配置允许的域名
3. **使用 HTTPS**: 在 production 环境使用反向代理启用 HTTPS
4. **定期轮换**: 定期更换 API Key
5. **速率限制**: 配置合适的 rateLimit 防止滥用

---

## 高可用特性

### 进程守护
- 渲染进程崩溃自动恢复
- 数据库断线自动重连
- 服务健康状态实时监控

### 配置备份
- 每小时自动备份配置
- 保留 7 天备份历史
- 手动备份支持

### 健康监控
- 每 30 秒检查服务状态
- 实时健康状态推送
- 多服务状态指示

---

## 技术支持

如有问题，请查看:
- 项目文档：`README.md`
- 快速开始：`QUICK_START.md`
- 用户指南：`USER_GUIDE.md`
