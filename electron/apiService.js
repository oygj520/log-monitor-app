/**
 * API Service - 企业级 API 和 Webhook 服务
 * 提供 REST API 接口、Webhook 配置、外部系统集成支持
 */

const http = require('http');
const https = require('https');
const url = require('url');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ApiService {
  constructor(databaseService, configPath) {
    this.databaseService = databaseService;
    this.configPath = configPath;
    this.server = null;
    this.port = 3889; // 默认 API 端口
    this.webhooks = [];
    this.apiKey = null;
    this.config = {
      enabled: false,
      port: 3889,
      apiKey: null,
      webhooks: [],
      rateLimit: 100, // 每分钟请求限制
      corsOrigins: ['*']
    };
  }

  /**
   * 初始化 API 服务
   */
  async initialize() {
    try {
      // 加载配置
      await this.loadConfig();
      
      // 如果没有 API 密钥，生成一个
      if (!this.config.apiKey) {
        this.config.apiKey = this.generateApiKey();
        await this.saveConfig();
      }
      
      this.apiKey = this.config.apiKey;
      this.webhooks = this.config.webhooks || [];
      this.port = this.config.port || 3889;
      
      console.log('[API Service] 初始化完成');
      console.log('[API Service] API 密钥:', this.apiKey?.slice(0, 8) + '...');
      console.log('[API Service] Webhook 数量:', this.webhooks.length);
      
      // 如果启用，启动 HTTP 服务器
      if (this.config.enabled) {
        this.startServer();
      }
    } catch (error) {
      console.error('[API Service] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 生成 API 密钥
   */
  generateApiKey() {
    return 'lm_' + crypto.randomBytes(32).toString('hex');
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(data);
        if (config.api) {
          this.config = { ...this.config, ...config.api };
        }
      }
    } catch (error) {
      console.error('[API Service] 加载配置失败:', error);
    }
  }

  /**
   * 保存配置
   */
  async saveConfig() {
    try {
      let config = {};
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        config = JSON.parse(data);
      }
      config.api = this.config;
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('[API Service] 配置已保存');
    } catch (error) {
      console.error('[API Service] 保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 启动 HTTP 服务器
   */
  startServer() {
    if (this.server) {
      console.log('[API Service] 服务器已在运行');
      return;
    }

    this.server = http.createServer(async (req, res) => {
      await this.handleRequest(req, res);
    });

    this.server.listen(this.port, () => {
      console.log(`[API Service] HTTP 服务器已启动，端口：${this.port}`);
    });

    this.server.on('error', (error) => {
      console.error('[API Service] 服务器错误:', error);
    });
  }

  /**
   * 停止 HTTP 服务器
   */
  stopServer() {
    if (this.server) {
      this.server.close(() => {
        console.log('[API Service] HTTP 服务器已停止');
      });
      this.server = null;
    }
  }

  /**
   * 处理 HTTP 请求
   */
  async handleRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS 处理
    res.setHeader('Access-Control-Allow-Origin', this.config.corsOrigins.includes('*') ? '*' : this.config.corsOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Content-Type', 'application/json');

    // OPTIONS 预检请求
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API 密钥验证（除了健康检查和文档）
    if (!['/health', '/api/docs'].includes(pathname)) {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (!apiKey || apiKey !== this.apiKey) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized', message: 'Invalid or missing API key' }));
        return;
      }
    }

    try {
      // 路由处理
      if (pathname === '/health') {
        await this.handleHealthCheck(res);
      } else if (pathname === '/api/logs') {
        await this.handleLogs(req, res, method);
      } else if (pathname === '/api/statistics') {
        await this.handleStatistics(req, res, method);
      } else if (pathname === '/api/webhooks') {
        await this.handleWebhooks(req, res, method);
      } else if (pathname === '/api/config') {
        await this.handleConfig(req, res, method);
      } else if (pathname === '/api/docs') {
        await this.handleDocs(res);
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found', message: 'Endpoint not found' }));
      }
    } catch (error) {
      console.error('[API Service] 请求处理错误:', error);
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error', message: error.message }));
    }
  }

  /**
   * 健康检查
   */
  async handleHealthCheck(res) {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      services: {
        database: this.databaseService ? 'connected' : 'disconnected',
        api: 'running'
      }
    };
    res.writeHead(200);
    res.end(JSON.stringify(health));
  }

  /**
   * 获取日志
   */
  async handleLogs(req, res, method) {
    if (method !== 'GET') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const query = req.query;
    const options = {
      level: query.level,
      source: query.source,
      limit: parseInt(query.limit) || 100,
      offset: parseInt(query.offset) || 0,
      startTime: query.startTime,
      endTime: query.endTime
    };

    const logs = await this.databaseService.getLogs(options);
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: logs,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: logs.length
      }
    }));
  }

  /**
   * 获取统计信息
   */
  async handleStatistics(req, res, method) {
    if (method !== 'GET') {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    const query = req.query;
    const options = {
      timeRange: query.timeRange || '24h'
    };

    const stats = await this.databaseService.getStatistics(options);
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      data: stats
    }));
  }

  /**
   * Webhook 管理
   */
  async handleWebhooks(req, res, method) {
    if (method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: this.webhooks
      }));
    } else if (method === 'POST') {
      const body = await this.readBody(req);
      const webhook = {
        id: crypto.randomBytes(16).toString('hex'),
        name: body.name || 'Unnamed Webhook',
        url: body.url,
        events: body.events || ['alert', 'error'],
        active: body.active !== false,
        createdAt: new Date().toISOString()
      };
      
      if (!webhook.url) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Bad Request', message: 'URL is required' }));
        return;
      }
      
      this.webhooks.push(webhook);
      this.config.webhooks = this.webhooks;
      await this.saveConfig();
      
      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        data: webhook
      }));
    } else if (method === 'DELETE') {
      const query = req.query;
      const index = this.webhooks.findIndex(w => w.id === query.id);
      
      if (index === -1) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found', message: 'Webhook not found' }));
        return;
      }
      
      this.webhooks.splice(index, 1);
      this.config.webhooks = this.webhooks;
      await this.saveConfig();
      
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    }
  }

  /**
   * 配置管理
   */
  async handleConfig(req, res, method) {
    if (method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          enabled: this.config.enabled,
          port: this.config.port,
          rateLimit: this.config.rateLimit,
          corsOrigins: this.config.corsOrigins,
          webhooksCount: this.webhooks.length
        }
      }));
    } else if (method === 'PUT') {
      const body = await this.readBody(req);
      
      if (body.enabled !== undefined) {
        this.config.enabled = body.enabled;
        if (body.enabled) {
          this.startServer();
        } else {
          this.stopServer();
        }
      }
      if (body.port !== undefined) {
        this.config.port = body.port;
        this.port = body.port;
      }
      if (body.rateLimit !== undefined) {
        this.config.rateLimit = body.rateLimit;
      }
      if (body.corsOrigins !== undefined) {
        this.config.corsOrigins = body.corsOrigins;
      }
      
      await this.saveConfig();
      
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: this.config
      }));
    } else {
      res.writeHead(405);
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    }
  }

  /**
   * API 文档
   */
  async handleDocs(res) {
    const docs = {
      title: 'LogMonitor API 文档',
      version: '1.0.0',
      baseUrl: `http://localhost:${this.port}`,
      authentication: {
        type: 'API Key',
        header: 'X-API-Key',
        description: '在请求头中添加 X-API-Key 或使用 Bearer Token'
      },
      endpoints: [
        {
          path: '/health',
          method: 'GET',
          auth: false,
          description: '健康检查',
          response: { status: 'healthy', timestamp: 'ISO8601', version: '1.0.0' }
        },
        {
          path: '/api/logs',
          method: 'GET',
          auth: true,
          description: '获取日志列表',
          parameters: {
            level: '日志级别 (INFO, ERROR, WARN, etc.)',
            source: '日志来源',
            limit: '返回数量限制 (默认 100)',
            offset: '偏移量 (默认 0)',
            startTime: '开始时间 (ISO8601)',
            endTime: '结束时间 (ISO8601)'
          }
        },
        {
          path: '/api/statistics',
          method: 'GET',
          auth: true,
          description: '获取统计信息',
          parameters: {
            timeRange: '时间范围 (1h, 24h, 7d, 30d)'
          }
        },
        {
          path: '/api/webhooks',
          method: 'GET',
          auth: true,
          description: '获取 Webhook 列表'
        },
        {
          path: '/api/webhooks',
          method: 'POST',
          auth: true,
          description: '创建 Webhook',
          body: { name: 'string', url: 'string', events: 'array', active: 'boolean' }
        },
        {
          path: '/api/webhooks?id={id}',
          method: 'DELETE',
          auth: true,
          description: '删除 Webhook'
        },
        {
          path: '/api/config',
          method: 'GET',
          auth: true,
          description: '获取 API 配置'
        },
        {
          path: '/api/config',
          method: 'PUT',
          auth: true,
          description: '更新 API 配置',
          body: { enabled: 'boolean', port: 'number', rateLimit: 'number', corsOrigins: 'array' }
        }
      ],
      examples: {
        curl: {
          health: 'curl http://localhost:3889/health',
          logs: 'curl -H "X-API-Key: your-api-key" "http://localhost:3889/api/logs?limit=10&level=ERROR"',
          statistics: 'curl -H "X-API-Key: your-api-key" "http://localhost:3889/api/statistics?timeRange=24h"',
          createWebhook: 'curl -X POST -H "X-API-Key: your-api-key" -H "Content-Type: application/json" -d \'{"name":"Alert Webhook","url":"https://example.com/webhook","events":["alert","error"]}\' http://localhost:3889/api/webhooks'
        }
      }
    };
    
    res.writeHead(200);
    res.end(JSON.stringify(docs, null, 2));
  }

  /**
   * 读取请求体
   */
  readBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  }

  /**
   * 触发 Webhook
   */
  async triggerWebhook(event, data) {
    const webhooksToTrigger = this.webhooks.filter(w => 
      w.active && w.events.includes(event)
    );

    if (webhooksToTrigger.length === 0) {
      return;
    }

    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      source: 'LogMonitor'
    };

    for (const webhook of webhooksToTrigger) {
      try {
        await this.sendWebhook(webhook.url, payload);
        console.log(`[API Service] Webhook 触发成功: ${webhook.name}`);
      } catch (error) {
        console.error(`[API Service] Webhook 触发失败: ${webhook.name}`, error);
      }
    }
  }

  /**
   * 发送 Webhook 请求
   */
  sendWebhook(urlString, payload) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(urlString);
      const isHttps = parsedUrl.protocol === 'https:';
      const lib = isHttps ? https : http;

      const data = JSON.stringify(payload);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = lib.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * 获取 API 状态
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      port: this.port,
      apiKey: this.apiKey ? this.apiKey.slice(0, 8) + '...' : null,
      webhooksCount: this.webhooks.length,
      serverRunning: !!this.server
    };
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.webhooks !== undefined) {
      this.webhooks = newConfig.webhooks;
    }
    await this.saveConfig();
    return this.config;
  }
}

module.exports = ApiService;
