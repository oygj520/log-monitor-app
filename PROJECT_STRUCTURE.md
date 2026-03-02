# 项目结构文档

## 目录结构

```
log-monitor-app/
│
├── electron/                          # Electron 主进程代码
│   ├── main.js                        # 主进程入口，窗口创建，IPC 通信
│   ├── preload.js                     # 预加载脚本，暴露安全 API
│   ├── pathManager.js                 # 路径管理器，E 盘存储管理
│   ├── logMonitorService.js           # 日志监控服务，chokidar 文件监听
│   └── databaseService.js             # 数据库服务，SQLite 操作
│
├── src/                               # React 前端代码
│   ├── components/                    # 可复用组件（待扩展）
│   ├── pages/                         # 页面组件
│   │   ├── Dashboard.js               # 仪表盘页面，统计图表
│   │   ├── LogViewer.js               # 日志查看页面，过滤搜索
│   │   ├── MonitorConfig.js           # 监控配置页面，CRUD 操作
│   │   └── Settings.js                # 系统设置页面
│   ├── utils/                         # 工具函数
│   │   ├── pathHelper.js              # 路径处理工具
│   │   └── logParser.js               # 日志解析工具
│   ├── services/                      # API 服务
│   │   └── configService.js           # 配置管理服务
│   ├── config/                        # 前端配置（待扩展）
│   ├── App.js                         # 应用根组件
│   ├── index.js                       # React 入口
│   └── index.css                      # 全局样式
│
├── public/                            # 静态资源
│   └── index.html                     # HTML 模板
│
├── config/                            # 配置模板
│   └── default.config.json            # 默认配置文件模板
│
├── scripts/                           # 工具脚本
│   └── init-data-dir.js               # 数据目录初始化脚本
│
├── build/                             # React 构建输出（npm run build 生成）
│
├── dist/                              # Electron 打包输出（npm run electron:build 生成）
│
├── package.json                       # 项目配置和依赖
├── .gitignore                         # Git 忽略规则
├── README.md                          # 项目说明文档
└── PROJECT_STRUCTURE.md               # 本文件
```

## 文件说明

### Electron 主进程

| 文件 | 说明 | 关键功能 |
|------|------|----------|
| main.js | 主进程入口 | 创建窗口、IPC 通信、应用生命周期 |
| preload.js | 预加载脚本 | 安全暴露 Electron API 给渲染进程 |
| pathManager.js | 路径管理器 | E 盘路径管理、跨平台兼容 |
| logMonitorService.js | 日志监控服务 | chokidar 文件监听、日志解析、告警检测 |
| databaseService.js | 数据库服务 | SQLite 数据库操作、日志存储、统计查询 |

### React 前端

| 文件 | 说明 | 关键功能 |
|------|------|----------|
| App.js | 根组件 | 路由导航、全局状态 |
| Dashboard.js | 仪表盘 | 统计卡片、图表展示、监控状态 |
| LogViewer.js | 日志查看 | 日志列表、过滤搜索、分页 |
| MonitorConfig.js | 监控配置 | 监控 CRUD、文件选择、告警设置 |
| Settings.js | 系统设置 | 应用设置、数据管理、关于信息 |

### 工具服务

| 文件 | 说明 | 关键功能 |
|------|------|----------|
| pathHelper.js | 路径工具 | 路径标准化、格式化、跨平台兼容 |
| logParser.js | 日志解析 | 多格式日志解析、自动识别 |
| configService.js | 配置服务 | 配置加载保存、验证、导入导出 |

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                     React 前端                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  Dashboard  │ │  LogViewer  │ │MonitorConfig│        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
│                        ↓ IPC                            │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                   Electron 主进程                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   chokidar  │ │  SQLite DB  │ │  File System│        │
│  │  文件监听   │ │  日志存储   │ │  配置管理   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│                      E 盘存储                            │
│  E:\LogMonitor\                                         │
│  └── data\                                              │
│      ├── config.json    (配置)                          │
│      ├── logs.db        (数据库)                        │
│      ├── cache\         (缓存)                          │
│      └── backups\       (备份)                          │
└─────────────────────────────────────────────────────────┘
```

## 数据流

1. **日志监控流程**
   ```
   文件系统 → chokidar 监听 → logMonitorService 解析 → databaseService 存储 → React 前端展示
   ```

2. **配置管理流程**
   ```
   React 前端 → IPC 通信 → main.js → 文件系统读写 → E:\LogMonitor\data\config.json
   ```

3. **查询统计流程**
   ```
   React 前端 → IPC 通信 → databaseService 查询 → SQLite → 返回结果 → ECharts 图表
   ```

## 扩展点

### 待实现功能
- [ ] 系统托盘图标和菜单
- [ ] 邮件告警通知
- [ ] Webhook 告警通知
- [ ] 日志自动清理（按保留天数）
- [ ] 配置备份和恢复
- [ ] 多语言支持
- [ ] 主题切换（深色/浅色）

### 组件扩展
- `src/components/` - 添加可复用 UI 组件
- `src/services/` - 添加更多 API 服务
- `electron/` - 添加更多主进程服务

## 构建和部署

### 开发
```bash
npm install
npm start
```

### 生产构建
```bash
npm run build
npm run electron:build
```

### 输出位置
- Windows: `dist/LogMonitor Setup x.x.x.exe`
- Linux: `dist/LogMonitor-x.x.x.AppImage`, `dist/log-monitor-app_x.x.x_amd64.deb`

## 注意事项

1. **所有数据存储在 E 盘**，避免占用 C 盘
2. **Linux 系统**会自动使用用户目录 `~/.logmonitor/data`
3. **配置文件**首次启动时自动创建
4. **数据库**使用 SQLite，无需额外安装
