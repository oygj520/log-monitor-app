# LogMonitor 开发手册

## 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [项目结构](#项目结构)
4. [开发环境搭建](#开发环境搭建)
5. [核心模块说明](#核心模块说明)
6. [日志解析器](#日志解析器)
7. [IPC 通信](#ipc-通信)
8. [数据库设计](#数据库设计)
9. [构建和发布](#构建和发布)
10. [常见问题](#常见问题)

---

## 项目概述

LogMonitor 是一款基于 Electron + React 的跨平台日志监控桌面应用。

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                     Electron 主进程                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  文件监控   │  │  日志解析   │  │  IPC 通信    │     │
│  │   Module    │  │   Module    │  │   Module    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────────┐
│                   React 渲染进程                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   仪表盘    │  │  日志查看   │  │  监控配置   │     │
│  │  Dashboard  │  │  LogViewer  │  │   Config    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

---

## 技术栈

### 前端
- **React** 18.x - UI 框架
- **TypeScript** 4.x - 类型系统
- **Ant Design** 5.x - UI 组件库
- **ECharts** 5.x - 图表库
- **React Router** 6.x - 路由管理

### 后端（Electron 主进程）
- **Electron** 28.x - 桌面应用框架
- **Node.js** 18.x - 运行环境
- **better-sqlite3** - 本地数据库
- **chokidar** - 文件监控

### 构建工具
- **Vite** 5.x - 前端构建
- **electron-builder** - 应用打包

---

## 项目结构

```
log-monitor-app/
├── electron/                  # Electron 主进程
│   ├── main.js               # 主进程入口
│   ├── preload.js            # 预加载脚本
│   ├── pathManager.js        # 路径管理
│   ├── fileMonitor.js        # 文件监控模块
│   ├── logParser.js          # 日志解析器
│   └── database.js           # 数据库操作
├── src/                      # React 渲染进程
│   ├── App.tsx               # 应用入口
│   ├── components/           # 组件目录
│   │   ├── Dashboard/        # 仪表盘
│   │   ├── LogViewer/        # 日志查看器
│   │   ├── MonitorConfig/    # 监控配置
│   │   └── Settings/         # 设置页面
│   ├── services/             # 服务层
│   ├── utils/                # 工具函数
│   └── styles/               # 样式文件
├── scripts/                  # 构建脚本
├── public/                   # 静态资源
├── package.json              # 项目配置
└── vite.config.js            # Vite 配置
```

---

## 开发环境搭建

### 1. 安装依赖

```bash
cd E:\openclaw-projects\log-monitor-app
npm install
```

### 2. 初始化数据目录

```bash
node scripts/init-data-dir.js
```

### 3. 启动开发环境

```bash
npm start
```

这会同时启动：
- Vite 开发服务器（端口 3000）
- Electron 应用窗口

### 4. 热重载

修改代码后自动重载：
- React 组件：自动热更新
- Electron 主进程：需重启应用

---

## 核心模块说明

### 文件监控模块 (fileMonitor.js)

负责监控日志文件变化：

```javascript
// 核心功能
- 使用 chokidar 监听文件变化
- 支持多文件同时监控
- 增量读取新增内容
- 防抖处理避免频繁触发
```

### 日志解析模块 (logParser.js)

负责解析日志内容：

```javascript
// 核心功能
- 自动识别 7+ 种日志格式
- 提取时间戳、级别、消息
- 堆栈跟踪识别
- 正则表达式匹配
```

### IPC 通信模块

负责主进程和渲染进程通信：

```javascript
// 主要通道
- 'monitor:start' - 启动监控
- 'monitor:stop' - 停止监控
- 'log:fetch' - 获取日志
- 'log:realtime' - 实时日志推送
```

---

## 日志解析器

### 解析器架构

日志解析器位于 `electron/logParser.js`，采用策略模式支持多种日志格式。

### 解析流程

```
原始日志行
    ↓
格式匹配（正则表达式）
    ↓
提取字段（时间戳、级别、消息）
    ↓
堆栈识别（多行关联）
    ↓
标准化输出（JSON 格式）
```

### 支持的日志格式

#### 1. 括号格式
```javascript
const BRACKET_FORMAT = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] (.+)$/;
// 匹配：[2024-01-01 12:00:00] [ERROR] 数据库连接失败
```

#### 2. ISO 格式
```javascript
const ISO_FORMAT = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z?) (\w+) (.+)$/;
// 匹配：2024-01-01T12:00:00.000Z ERROR 数据库连接失败
```

#### 3. 简单格式
```javascript
const SIMPLE_FORMAT = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (\w+) (.+)$/;
// 匹配：2024-01-01 12:00:00 ERROR 数据库连接失败
```

#### 4. JSON 格式
```javascript
// 直接解析 JSON 对象，提取 timestamp、level、message 字段
```

#### 5. Apache 格式
```javascript
const APACHE_FORMAT = /^(\S+) \S+ \S+ \[([^\]]+)\] "([^"]+)" (\d+) (\d+)$/;
// 匹配：127.0.0.1 - - [01/Jan/2024:12:00:00 +0800] "GET /api HTTP/1.1" 200 1234
```

#### 6. Syslog 格式
```javascript
const SYSLOG_FORMAT = /^(\w{3}\s+\d{1,2} \d{2}:\d{2}:\d{2}) (\S+) (\S+)\[(\d+)\]: (.+)$/;
// 匹配：Jan  1 12:00:00 server01 nginx[1234]: Connection timeout
```

---

## 错误模式识别正则表达式

### 堆栈跟踪识别逻辑（v1.0.1 更新）

日志解析器会自动识别堆栈跟踪信息，并将其标记为 ERROR 级别。

#### Java 异常识别

```javascript
// Java 异常关键字
const JAVA_EXCEPTION_PATTERN = /(java\.(lang|io|util|net|sql|nio)\.\w+Exception)|(java\.lang\.Error)|(javax\.servlet\.ServletException)/i;

// Java 堆栈行
const JAVA_STACK_LINE = /^\s+at\s+[\w.$<>]+\([^)]+\)/;

// 完整 Java 堆栈匹配
const JAVA_FULL_STACK = /java\.\w+Exception:.*(?:\n\s+at [\w.$<>]+\([^)]+\))+/s;
```

**示例匹配：**
```
java.lang.NullPointerException
    at com.example.MyClass.myMethod(MyClass.java:42)
    at com.example.Main.main(Main.java:10)
```

#### Python 异常识别

```javascript
// Python Traceback 关键字
const PYTHON_TRACEBACK_PATTERN = /Traceback \(most recent call last\):/i;

// Python 错误类型
const PYTHON_ERROR_PATTERN = /(\w+Error|\w+Exception):\s*.+/i;

// Python 堆栈行
const PYTHON_STACK_LINE = /^\s+File\s+"[^"]+",\s+line\s+\d+/;
```

**示例匹配：**
```
Traceback (most recent call last):
  File "main.py", line 10, in <module>
    raise ValueError("Invalid value")
ValueError: Invalid value
```

#### 通用错误模式

```javascript
// 常见错误关键字
const COMMON_ERROR_PATTERNS = [
  /Exception/i,
  /Error:/i,
  /Failed to/i,
  /Cannot/i,
  /Unable to/i,
  /Timeout/i,
  /Connection refused/i,
  /Out of memory/i,
  /Stack overflow/i,
  /NullPointer/i,
  /Segmentation fault/i
];

// 堆栈跟踪起始行
const STACK_TRACE_START = [
  /Traceback \(most recent call last\):/i,
  /Exception in thread/i,
  /at [\w.$<>]+\(/,
  /File "[^"]+", line \d+/
];
```

### 堆栈识别逻辑实现

```javascript
function identifyStackTrace(lines) {
  const result = [];
  let currentEntry = null;
  let stackLines = [];
  
  for (const line of lines) {
    // 检查是否为新的错误条目
    if (isErrorLine(line)) {
      // 保存之前的条目
      if (currentEntry) {
        currentEntry.stack = stackLines.join('\n');
        result.push(currentEntry);
      }
      
      // 创建新条目
      currentEntry = parseLine(line);
      currentEntry.level = 'ERROR'; // 堆栈自动标记为 ERROR
      stackLines = [];
    } 
    // 检查是否为堆栈行
    else if (isStackTraceLine(line) && currentEntry) {
      stackLines.push(line);
    }
  }
  
  // 处理最后一个条目
  if (currentEntry) {
    currentEntry.stack = stackLines.join('\n');
    result.push(currentEntry);
  }
  
  return result;
}
```

### 正则表达式性能优化

```javascript
// 预编译正则表达式（避免重复编译）
const COMPILED_PATTERNS = {
  BRACKET: /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] (.+)$/,
  ISO: /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z?) (\w+) (.+)$/,
  SIMPLE: /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (\w+) (.+)$/,
  JAVA_EXCEPTION: /(java\.(lang|io|util|net|sql|nio)\.\w+Exception)/i,
  PYTHON_TRACEBACK: /Traceback \(most recent call last\):/i
};

// 使用测试方法快速匹配
function quickMatch(pattern, text) {
  return COMPILED_PATTERNS[pattern].test(text);
}
```

---

## IPC 通信

### 主进程到渲染进程

```javascript
// 实时日志推送
mainWindow.webContents.send('log:new', logEntry);

// 监控状态更新
mainWindow.webContents.send('monitor:status', { id, status });

// 告警通知
mainWindow.webContents.send('alert:trigger', alertData);
```

### 渲染进程到主进程

```javascript
// 通过 preload.js 暴露的 API
const { ipcRenderer } = require('electron');

// 启动监控
ipcRenderer.invoke('monitor:start', config);

// 获取日志
ipcRenderer.invoke('log:fetch', { page, limit });

// 停止监控
ipcRenderer.invoke('monitor:stop', id);
```

### 实时日志增量读取（v1.0.1 更新）

```javascript
// 主进程：增量读取
async function readNewLines(filePath, lastPosition) {
  const stats = fs.statSync(filePath);
  const newSize = stats.size;
  
  if (newSize > lastPosition) {
    const buffer = Buffer.alloc(newSize - lastPosition);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, newSize - lastPosition, lastPosition);
    fs.closeSync(fd);
    
    return {
      content: buffer.toString('utf8'),
      newPosition: newSize
    };
  }
  
  return { content: '', newPosition: lastPosition };
}

// 渲染进程：接收实时日志
ipcRenderer.on('log:realtime', (event, logs) => {
  // 增量更新日志列表，不影响当前浏览位置
  updateLogList(logs);
});
```

---

## 数据库设计

### SQLite 表结构

#### monitors 表
```sql
CREATE TABLE monitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  paths TEXT NOT NULL,  -- JSON 数组
  alertLevel TEXT NOT NULL,
  keywords TEXT,  -- JSON 数组
  status TEXT DEFAULT 'stopped',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### logs 表
```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitorId INTEGER NOT NULL,
  timestamp DATETIME NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  sourceFile TEXT NOT NULL,
  rawContent TEXT,
  stackTrace TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (monitorId) REFERENCES monitors(id)
);

-- 索引优化
CREATE INDEX idx_logs_monitorId ON logs(monitorId);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_level ON logs(level);
```

#### alerts 表
```sql
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitorId INTEGER NOT NULL,
  logId INTEGER,
  triggerReason TEXT NOT NULL,
  triggeredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (monitorId) REFERENCES monitors(id),
  FOREIGN KEY (logId) REFERENCES logs(id)
);
```

---

## 构建和发布

### 开发构建

```bash
# 安装依赖
npm install

# 启动开发环境
npm start
```

### 生产构建

```bash
# 构建 React 应用
npm run build

# 打包 Windows 版本
npm run electron:build:win

# 打包 Linux 版本
npm run electron:build:linux
```

### 发布流程

1. 更新版本号（`package.json`）
2. 更新 CHANGELOG.md
3. 构建生产版本
4. 测试安装包
5. 发布到 GitHub Releases

---

## 常见问题

### Q1: 如何添加新的日志格式支持？

**A**: 在 `electron/logParser.js` 中添加新的正则表达式和解析逻辑：

```javascript
// 1. 定义正则表达式
const NEW_FORMAT = /your-pattern-here/;

// 2. 添加解析函数
function parseNewFormat(line) {
  const match = line.match(NEW_FORMAT);
  if (match) {
    return {
      timestamp: match[1],
      level: match[2],
      message: match[3]
    };
  }
  return null;
}

// 3. 在主解析函数中调用
function parseLine(line) {
  return parseNewFormat(line) || parseBracketFormat(line) || ...;
}
```

### Q2: 如何调试 IPC 通信？

**A**: 在主进程和渲染进程中添加日志：

```javascript
// 主进程
console.log('[Main] Sending log:', logEntry);
mainWindow.webContents.send('log:new', logEntry);

// 渲染进程
console.log('[Renderer] Received log:', logEntry);
```

### Q3: 日志解析性能优化？

**A**: 
1. 预编译正则表达式
2. 使用 Worker 线程处理大量日志
3. 限制单次解析的日志行数
4. 使用数据库索引加速查询

### Q4: 如何处理大日志文件？

**A**: 
1. 使用流式读取（`fs.createReadStream`）
2. 增量读取新增内容
3. 分页加载历史日志
4. 定期清理旧日志数据

### Q5: 如何添加新的告警通知方式？

**A**: 
1. 在 `electron/alertManager.js` 中添加新的通知类
2. 实现 `send(notification)` 方法
3. 在配置中添加新的通知选项
4. 在渲染进程中添加配置 UI

---

## 代码规范

### TypeScript 配置

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### ESLint 规则

```javascript
// .eslintrc.js
module.exports = {
  extends: ['react-app', 'prettier'],
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-unused-vars': 'warn'
  }
};
```

### 提交规范

```
feat: 新增 XXX 功能
fix: 修复 XXX 问题
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
test: 添加测试
chore: 构建/工具链相关
```

---

## 测试

### 单元测试

```bash
# 运行测试
npm test

# 生成覆盖率报告
npm run test:coverage
```

### 端到端测试

```bash
# 运行 E2E 测试
npm run test:e2e
```

---

## 性能优化建议

1. **日志解析**：使用 Worker 线程避免阻塞主进程
2. **数据库查询**：添加合适的索引，使用分页
3. **UI 渲染**：虚拟列表优化大数据量渲染
4. **文件监控**：防抖处理，避免频繁触发
5. **内存管理**：定期清理缓存，限制日志保留量

---

**最后更新**: 2026-03-02  
**版本**: 1.0.1  
**维护团队**: OpenClaw Team
