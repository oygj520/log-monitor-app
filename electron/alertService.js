const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class AlertService {
  constructor(databaseService) {
    this.databaseService = databaseService;
    this.alertRules = new Map(); // 存储告警规则
    this.errorFrequencyCache = new Map(); // 错误频率缓存 { monitorId: { count, windowStart } }
    this.notificationHandlers = []; // 通知处理器列表
  }

  /**
   * 初始化告警服务
   */
  async initialize() {
    console.log('[告警服务] 初始化告警服务');
    // 从数据库加载告警规则
    await this.loadAlertRules();
  }

  /**
   * 加载告警规则
   */
  async loadAlertRules() {
    try {
      const configs = this.databaseService.getMonitorConfigs();
      for (const config of configs) {
        this.alertRules.set(config.id, {
          monitorId: config.id,
          keywords: config.customKeywords || [],
          alertLevels: config.alertKeywords || ['ERROR', 'FATAL', 'CRITICAL'],
          errorThreshold: config.errorThreshold || 10, // 错误频率阈值
          errorWindow: config.errorWindow || 60, // 错误频率时间窗口（秒）
          enabled: config.status === 'running'
        });
      }
      console.log(`[告警服务] 加载了 ${this.alertRules.size} 条告警规则`);
    } catch (error) {
      console.error('[告警服务] 加载告警规则失败:', error);
    }
  }

  /**
   * 更新告警规则
   */
  updateAlertRule(monitorId, rule) {
    this.alertRules.set(monitorId, {
      monitorId,
      ...rule
    });
    console.log(`[告警服务] 更新告警规则：${monitorId}`);
  }

  /**
   * 移除告警规则
   */
  removeAlertRule(monitorId) {
    this.alertRules.delete(monitorId);
    this.errorFrequencyCache.delete(monitorId);
    console.log(`[告警服务] 移除告警规则：${monitorId}`);
  }

  /**
   * 检查日志并触发告警
   */
  async checkLogs(logs, monitorConfig) {
    const rule = this.alertRules.get(monitorConfig.id);
    if (!rule || !rule.enabled) {
      return;
    }

    const alerts = [];

    for (const log of logs) {
      // 1. 检查日志级别告警
      if (rule.alertLevels.includes(log.level)) {
        const alert = await this.createAlert({
          monitorId: monitorConfig.id,
          type: 'level',
          level: log.level,
          message: `[级别告警] ${log.source}: ${log.message}`,
          logId: log.id,
          data: log
        });
        alerts.push(alert);
      }

      // 2. 检查关键字告警
      if (rule.keywords && rule.keywords.length > 0) {
        for (const keyword of rule.keywords) {
          if (log.message && log.message.includes(keyword)) {
            const alert = await this.createAlert({
              monitorId: monitorConfig.id,
              type: 'keyword',
              level: log.level,
              message: `[关键字告警] "${keyword}" 在 ${log.source}: ${log.message}`,
              logId: log.id,
              keyword,
              data: log
            });
            alerts.push(alert);
          }
        }
      }
    }

    // 3. 检查错误频率告警
    const errorAlert = await this.checkErrorFrequency(logs, monitorConfig.id, rule);
    if (errorAlert) {
      alerts.push(errorAlert);
    }

    // 4. 发送所有告警通知
    for (const alert of alerts) {
      await this.sendNotification(alert);
    }

    return alerts;
  }

  /**
   * 检查错误频率
   */
  async checkErrorFrequency(logs, monitorId, rule) {
    const errorLogs = logs.filter(log => 
      ['ERROR', 'FATAL', 'CRITICAL'].includes(log.level)
    );

    if (errorLogs.length === 0) {
      return null;
    }

    const now = Date.now();
    const windowMs = rule.errorWindow * 1000;
    
    let cache = this.errorFrequencyCache.get(monitorId);
    
    // 初始化或重置缓存
    if (!cache || (now - cache.windowStart) > windowMs) {
      cache = {
        count: 0,
        windowStart: now
      };
      this.errorFrequencyCache.set(monitorId, cache);
    }

    // 累加错误计数
    cache.count += errorLogs.length;

    // 检查是否超过阈值
    if (cache.count >= rule.errorThreshold) {
      const alert = await this.createAlert({
        monitorId,
        type: 'frequency',
        level: 'CRITICAL',
        message: `[频率告警] ${rule.errorWindow}秒内发生${cache.count}次错误，超过阈值${rule.errorThreshold}`,
        data: {
          errorCount: cache.count,
          threshold: rule.errorThreshold,
          window: rule.errorWindow,
          recentErrors: errorLogs.slice(-5) // 最近 5 条错误
        }
      });

      // 重置计数器
      cache.count = 0;
      cache.windowStart = now;

      return alert;
    }

    return null;
  }

  /**
   * 创建告警记录
   */
  async createAlert(alertData) {
    const alert = {
      id: uuidv4(),
      monitorId: alertData.monitorId,
      type: alertData.type,
      level: alertData.level || 'WARNING',
      message: alertData.message,
      logId: alertData.logId || null,
      data: alertData.data || null,
      status: 'new', // new, acknowledged, resolved
      createdAt: new Date().toISOString()
    };

    // 保存到数据库
    this.databaseService.saveAlert({
      id: alert.id,
      monitorId: alert.monitorId,
      type: alert.type,
      level: alert.level,
      message: alert.message,
      logId: alert.logId
    });

    console.log(`[告警服务] 创建告警：${alert.id} [${alert.type}] ${alert.message}`);
    return alert;
  }

  /**
   * 注册通知处理器
   */
  registerNotificationHandler(handler) {
    this.notificationHandlers.push(handler);
    console.log('[告警服务] 注册通知处理器');
  }

  /**
   * 发送告警通知
   */
  async sendNotification(alert) {
    // 1. 发送到前端（Electron 窗口）
    this.sendToFrontend(alert);

    // 2. 调用自定义通知处理器
    for (const handler of this.notificationHandlers) {
      try {
        await handler(alert);
      } catch (error) {
        console.error('[告警服务] 通知处理器执行失败:', error);
      }
    }

    // 3. 系统通知（Windows 通知）
    if (process.platform === 'win32') {
      this.sendWindowsNotification(alert);
    }
  }

  /**
   * 发送到前端
   */
  sendToFrontend(alert) {
    try {
      const { BrowserWindow } = require('electron');
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send('alert', {
          id: alert.id,
          monitorId: alert.monitorId,
          type: alert.type,
          level: alert.level,
          message: alert.message,
          data: alert.data,
          createdAt: alert.createdAt
        });
      }
    } catch (error) {
      console.error('[告警服务] 发送告警到前端失败:', error);
    }
  }

  /**
   * 发送 Windows 系统通知
   */
  sendWindowsNotification(alert) {
    try {
      const { exec } = require('child_process');
      
      // 使用 PowerShell 发送通知
      const script = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        
        $template = @"
        <toast>
          <visual>
            <binding template="ToastText02">
              <text id="1">${alert.level} - ${alert.type}</text>
              <text id="2">${alert.message.substring(0, 100)}</text>
            </binding>
          </visual>
        </toast>
"@
        
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml($template)
        $toast = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("LogMonitor")
        $toast.Show([Windows.UI.Notifications.ToastNotification]::new($xml))
      `;

      exec(`powershell -Command "${script}"`, (error) => {
        if (error) {
          console.error('[告警服务] Windows 通知发送失败:', error);
        }
      });
    } catch (error) {
      console.error('[告警服务] Windows 通知异常:', error);
    }
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(options = {}) {
    return this.databaseService.getAlerts(options);
  }

  /**
   * 获取告警统计
   */
  getAlertStatistics(startDate, endDate) {
    try {
      const alerts = this.getAlertHistory({ 
        page: 1, 
        pageSize: 10000 
      });

      const filteredAlerts = alerts.filter(alert => {
        const alertDate = new Date(alert.createdAt);
        return (!startDate || alertDate >= new Date(startDate)) &&
               (!endDate || alertDate <= new Date(endDate));
      });

      const stats = {
        total: filteredAlerts.length,
        byType: {},
        byLevel: {},
        byMonitor: {},
        trend: []
      };

      // 按类型统计
      for (const alert of filteredAlerts) {
        stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
        stats.byLevel[alert.level] = (stats.byLevel[alert.level] || 0) + 1;
        stats.byMonitor[alert.monitorId] = (stats.byMonitor[alert.monitorId] || 0) + 1;
      }

      // 按天统计趋势
      const dailyCount = {};
      for (const alert of filteredAlerts) {
        const day = alert.createdAt.split('T')[0];
        dailyCount[day] = (dailyCount[day] || 0) + 1;
      }

      stats.trend = Object.entries(dailyCount)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return stats;
    } catch (error) {
      console.error('[告警服务] 获取告警统计失败:', error);
      return null;
    }
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId) {
    try {
      // 更新告警状态
      const db = this.databaseService.db;
      if (db) {
        db.exec(`
          UPDATE alerts 
          SET message = message || ' [已确认]',
              createdAt = createdAt
          WHERE id = '${alertId}'
        `);
        this.databaseService.saveDatabase();
      }
      console.log(`[告警服务] 告警已确认：${alertId}`);
      return { success: true };
    } catch (error) {
      console.error('[告警服务] 确认告警失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 导出告警规则配置
   */
  exportAlertRules() {
    const rules = {};
    for (const [monitorId, rule] of this.alertRules) {
      rules[monitorId] = rule;
    }
    return JSON.stringify(rules, null, 2);
  }

  /**
   * 导入告警规则配置
   */
  importAlertRules(jsonString) {
    try {
      const rules = JSON.parse(jsonString);
      for (const [monitorId, rule] of Object.entries(rules)) {
        this.alertRules.set(monitorId, rule);
      }
      console.log(`[告警服务] 导入了 ${Object.keys(rules).length} 条告警规则`);
      return { success: true };
    } catch (error) {
      console.error('[告警服务] 导入告警规则失败:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = AlertService;
