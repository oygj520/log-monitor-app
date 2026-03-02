/**
 * API 服务测试脚本
 * 用于验证 API 端点功能
 */

const http = require('http');

const BASE_URL = 'http://localhost:3889';
let API_KEY = null;

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

// HTTP 请求封装
function request(method, path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

async function runTests() {
  log(colors.blue, '\n========================================');
  log(colors.blue, '  LogMonitor API 测试');
  log(colors.blue, '========================================\n');

  // 测试 1: 健康检查
  log(colors.yellow, '测试 1: 健康检查 GET /health');
  try {
    const res = await request('GET', '/health');
    if (res.statusCode === 200 && res.data.status === 'healthy') {
      log(colors.green, '✓ 健康检查通过');
      console.log('  状态:', res.data.status);
      console.log('  版本:', res.data.version);
      console.log('  运行时间:', res.data.uptime.toFixed(2), '秒');
    } else {
      log(colors.red, '✗ 健康检查失败');
    }
  } catch (error) {
    log(colors.red, '✗ 健康检查错误:', error.message);
    log(colors.yellow, '  提示：请确保应用已启动且 API 服务已启用');
    return;
  }

  // 获取 API Key（从配置）
  log(colors.yellow, '\n测试 2: 获取 API 配置 GET /api/config');
  try {
    // 注意：实际使用时需要从配置文件或用户输入获取 API Key
    log(colors.yellow, '  提示：需要使用有效的 API Key 进行后续测试');
    log(colors.yellow, '  API Key 存储在项目配置文件中');
  } catch (error) {
    log(colors.red, '✗ 错误:', error.message);
  }

  // 测试 3: 获取日志（需要 API Key）
  log(colors.yellow, '\n测试 3: 获取日志 GET /api/logs');
  log(colors.blue, '  示例: curl -H "X-API-Key: YOUR_KEY" http://localhost:3889/api/logs');

  // 测试 4: 获取统计（需要 API Key）
  log(colors.yellow, '\n测试 4: 获取统计 GET /api/statistics');
  log(colors.blue, '  示例: curl -H "X-API-Key: YOUR_KEY" "http://localhost:3889/api/statistics?timeRange=24h"');

  // 测试 5: Webhook 管理（需要 API Key）
  log(colors.yellow, '\n测试 5: Webhook 管理');
  log(colors.blue, '  创建: curl -X POST -H "X-API-Key: YOUR_KEY" -H "Content-Type: application/json"');
  log(colors.blue, '        -d \'{"name":"Test","url":"https://example.com/webhook","events":["alert"]}\'');
  log(colors.blue, '        http://localhost:3889/api/webhooks');

  // 测试 6: API 文档
  log(colors.yellow, '\n测试 6: API 文档 GET /api/docs');
  try {
    const res = await request('GET', '/api/docs');
    if (res.statusCode === 200) {
      log(colors.green, '✓ API 文档可访问');
      console.log('  文档标题:', res.data.title);
      console.log('  API 版本:', res.data.version);
      console.log('  端点数量:', res.data.endpoints.length);
    }
  } catch (error) {
    log(colors.red, '✗ 错误:', error.message);
  }

  log(colors.blue, '\n========================================');
  log(colors.blue, '  测试完成');
  log(colors.blue, '========================================\n');

  log(colors.yellow, '完整 API 文档请查看: API_DOCUMENTATION.md');
  log(colors.yellow, '企业级功能说明请查看: ENTERPRISE_FEATURES.md\n');
}

// 运行测试
runTests().catch(console.error);
