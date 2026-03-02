# 快速开始指南

## 环境准备

### 必需软件
- **Node.js** >= 18.x ([下载](https://nodejs.org/))
- **npm** >= 9.x (随 Node.js 安装)

### 验证安装
```bash
node --version  # 应显示 v18.x 或更高
npm --version   # 应显示 v9.x 或更高
```

## 安装步骤

### 1. 安装依赖
```bash
cd E:\openclaw-projects\log-monitor-app
npm install
```

预计耗时：2-5 分钟（取决于网络速度）

### 2. 初始化数据目录
```bash
node scripts/init-data-dir.js
```

这会在 E 盘创建以下目录：
- `E:\LogMonitor\` - 应用主目录
- `E:\LogMonitor\data\` - 数据目录
- `E:\LogMonitor\data\cache\` - 缓存目录
- `E:\LogMonitor\data\backups\` - 备份目录

### 3. 启动开发环境
```bash
npm start
```

这会同时启动：
- React 开发服务器（http://localhost:3000）
- Electron 应用窗口

## 使用指南

### 第一步：配置监控任务

1. 应用启动后，点击顶部导航的 **"监控配置"**
2. 点击 **"新建监控"** 按钮
3. 填写监控信息：
   - **监控名称**：例如 "应用日志监控"
   - **监控路径**：点击 "选择文件" 或 "选择文件夹" 添加日志文件
   - **告警级别**：选择需要告警的日志级别（默认 ERROR/FATAL/CRITICAL）
   - **自定义关键字**：可选，添加需要告警的关键字
4. 点击 **"创建监控"** 保存

### 第二步：启动监控

1. 在监控配置列表中找到刚创建的监控
2. 点击 **"启动"** 按钮
3. 状态变为 "运行中" 表示监控已启动

### 第三步：查看日志

1. 点击顶部导航的 **"日志查看"**
2. 使用过滤器筛选日志：
   - 按级别过滤（ERROR/WARN/INFO/DEBUG）
   - 按关键字搜索
   - 按时间范围筛选
3. 查看实时日志列表

### 第四步：查看统计

1. 点击顶部导航的 **"仪表盘"**
2. 查看统计数据：
   - 总日志数
   - 运行中监控数
   - 今日告警数
   - 错误率
3. 查看图表：
   - 日志级别分布（饼图）
   - 日志时间趋势（折线图）

## 打包发布

### Windows 版本
```bash
npm run build
npm run electron:build:win
```

输出：`dist/LogMonitor Setup x.x.x.exe`

### Linux 版本
```bash
npm run build
npm run electron:build:linux
```

输出：
- `dist/LogMonitor-x.x.x.AppImage`
- `dist/log-monitor-app_x.x.x_amd64.deb`

## 常见问题

### Q: 启动时提示 "找不到模块"
**A**: 运行 `npm install` 重新安装依赖

### Q: 开发服务器启动失败
**A**: 检查端口 3000 是否被占用，或重启电脑

### Q: E 盘不存在怎么办
**A**: 修改 `electron/pathManager.js` 中的路径配置

### Q: 日志没有被监控到
**A**: 
1. 检查文件路径是否正确
2. 确保监控状态为 "运行中"
3. 检查日志文件格式是否被支持

### Q: 如何查看支持的日志格式
**A**: 支持以下格式：
- `[2024-01-01 12:00:00] [ERROR] 消息`
- `2024-01-01T12:00:00.000Z ERROR 消息`
- `2024-01-01 12:00:00 ERROR 消息`
- JSON 格式日志

## 下一步

- 查看 [README.md](README.md) 了解详细功能
- 查看 [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) 了解项目结构
- 查看配置文件 `E:\LogMonitor\data\config.json` 自定义设置

## 技术支持

如有问题，请联系 OpenClaw Team。
