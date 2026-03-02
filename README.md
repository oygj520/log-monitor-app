# LogMonitor - 日志监控桌面应用

跨平台日志监控工具，基于 Electron + React 构建，支持 Windows/Linux。

## 功能特性

- 📊 **实时监控** - 同时监控多个日志文件
- 🔍 **智能解析** - 自动识别常见日志格式
- 🎯 **过滤搜索** - 按级别、关键字、时间筛选
- ⚠️ **告警通知** - ERROR/关键字触发告警
- 📈 **统计分析** - ECharts 可视化图表
- ⚙️ **配置管理** - 可视化配置界面

## 技术栈

- **桌面框架**: Electron 28 + React 18
- **日志监控**: chokidar
- **数据存储**: SQLite (better-sqlite3)
- **图表库**: ECharts + echarts-for-react
- **UI 组件**: Ant Design 风格
- **打包工具**: electron-builder

## 项目结构

```
log-monitor-app/
├── electron/                 # Electron 主进程
│   ├── main.js              # 主进程入口
│   ├── preload.js           # 预加载脚本
│   ├── pathManager.js       # 路径管理器
│   ├── logMonitorService.js # 日志监控服务
│   └── databaseService.js   # 数据库服务
├── src/                      # React 前端
│   ├── components/          # 可复用组件
│   ├── pages/               # 页面组件
│   │   ├── Dashboard.js     # 仪表盘
│   │   ├── LogViewer.js     # 日志查看
│   │   ├── MonitorConfig.js # 监控配置
│   │   └── Settings.js      # 系统设置
│   ├── utils/               # 工具函数
│   ├── services/            # API 服务
│   ├── config/              # 配置文件
│   ├── App.js               # 应用入口
│   ├── index.js             # React 入口
│   └── index.css            # 全局样式
├── public/                   # 静态资源
├── config/                   # 配置模板
│   └── default.config.json  # 默认配置
├── package.json             # 项目配置
└── README.md                # 项目说明
```

## 存储路径

所有数据存储在 E 盘，避免占用 C 盘：

- **程序安装**: `E:\LogMonitor\`
- **用户数据**: `E:\LogMonitor\data\`
  - 配置文件：`data/config.json`
  - 数据库：`data/logs.db`
  - 缓存文件：`data/cache/`
  - 备份文件：`data/backups/`

## 安装开发

### 环境要求

- Node.js >= 18.x
- npm >= 9.x

### 安装依赖

```bash
cd E:\openclaw-projects\log-monitor-app
npm install
```

### 开发模式

```bash
npm start
```

### 构建生产版本

```bash
# 构建 React 前端
npm run build

# 打包 Windows 版本
npm run electron:build:win

# 打包 Linux 版本
npm run electron:build:linux

# 打包所有平台
npm run electron:build
```

## 使用说明

### 1. 配置监控任务

1. 打开应用，进入"监控配置"页面
2. 点击"新建监控"按钮
3. 填写监控名称
4. 添加要监控的日志文件路径（可多选）
5. 设置告警级别（ERROR、FATAL 等）
6. 可选：添加自定义关键字
7. 保存配置

### 2. 启动监控

1. 在监控配置列表中找到刚创建的监控
2. 点击"启动"按钮
3. 监控状态变为"运行中"

### 3. 查看日志

1. 进入"日志查看"页面
2. 使用过滤器筛选日志
3. 支持按级别、关键字、时间范围搜索

### 4. 查看统计

1. 进入"仪表盘"页面
2. 查看日志级别分布饼图
3. 查看日志时间趋势折线图
4. 查看监控状态和告警信息

## 配置文件

配置文件位于 `E:\LogMonitor\data\config.json`

### 配置结构

```json
{
  "settings": {
    "dataPath": "E:\\LogMonitor\\data",
    "autoStart": false,
    "minimizeToTray": true,
    "notificationEnabled": true,
    "logRetentionDays": 30,
    "refreshInterval": 5
  },
  "monitors": [
    {
      "id": "monitor-id",
      "name": "监控名称",
      "paths": ["路径 1", "路径 2"],
      "alertKeywords": ["ERROR", "FATAL"],
      "customKeywords": ["关键字"],
      "status": "stopped"
    }
  ]
}
```

## 日志格式支持

自动识别以下常见格式：

1. `[2024-01-01 12:00:00] [ERROR] 消息内容`
2. `2024-01-01T12:00:00.000Z ERROR 消息内容`
3. `2024-01-01 12:00:00 ERROR 消息内容`
4. JSON 格式日志

## 开发团队

OpenClaw Team

## 许可证

MIT License
