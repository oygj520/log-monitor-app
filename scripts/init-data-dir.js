/**
 * 初始化数据目录脚本
 * 创建 E 盘所需的所有目录和默认配置文件
 */

const fs = require('fs');
const path = require('path');

const APP_PATH = 'E:\\LogMonitor';
const DATA_PATH = path.join(APP_PATH, 'data');
const CACHE_PATH = path.join(DATA_PATH, 'cache');
const BACKUPS_PATH = path.join(DATA_PATH, 'backups');
const CONFIG_PATH = path.join(DATA_PATH, 'config.json');

// 默认配置
const DEFAULT_CONFIG = {
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  settings: {
    dataPath: DATA_PATH,
    autoStart: false,
    minimizeToTray: true,
    notificationEnabled: true,
    logRetentionDays: 30,
    refreshInterval: 5,
    theme: 'light',
    language: 'zh-CN'
  },
  monitors: [],
  alerts: {
    email: {
      enabled: false,
      recipients: [],
      smtpServer: '',
      smtpPort: 587,
      username: '',
      password: ''
    },
    webhook: {
      enabled: false,
      url: '',
      method: 'POST',
      headers: {}
    },
    sound: {
      enabled: true,
      file: ''
    }
  }
};

function initialize() {
  console.log('开始初始化数据目录...\n');

  // 创建目录
  const directories = [APP_PATH, DATA_PATH, CACHE_PATH, BACKUPS_PATH];
  
  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✓ 创建目录：${dir}`);
    } else {
      console.log(`✓ 目录已存在：${dir}`);
    }
  }

  // 创建默认配置文件
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log(`✓ 创建默认配置文件：${CONFIG_PATH}`);
  } else {
    console.log(`✓ 配置文件已存在：${CONFIG_PATH}`);
  }

  console.log('\n✅ 数据目录初始化完成！');
  console.log('\n目录结构:');
  console.log(`  ${APP_PATH}\\`);
  console.log(`  └── data\\`);
  console.log(`      ├── config.json    (配置文件)`);
  console.log(`      ├── logs.db        (SQLite 数据库)`);
  console.log(`      ├── cache\\        (缓存文件)`);
  console.log(`      └── backups\\      (备份文件)`);
}

// 运行初始化
initialize();
