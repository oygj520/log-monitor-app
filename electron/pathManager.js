const path = require('path');
const fs = require('fs');
const os = require('os');

class PathManager {
  static appPath = null;
  static dataPath = null;
  static configPath = null;
  static databasePath = null;
  static cachePath = null;

  /**
   * 初始化路径管理器
   * 所有数据存储在 E 盘，避免占用 C 盘
   */
  static initialize() {
    // 程序安装路径（E 盘）
    this.appPath = 'E:\\LogMonitor';
    
    // 用户数据路径
    this.dataPath = path.join(this.appPath, 'data');
    
    // 配置文件路径
    this.configPath = path.join(this.dataPath, 'config.json');
    
    // 数据库路径
    this.databasePath = path.join(this.dataPath, 'logs.db');
    
    // 缓存路径
    this.cachePath = path.join(this.dataPath, 'cache');

    // 确保目录存在
    this.ensureDirectories();
  }

  /**
   * 确保所有必要的目录存在
   */
  static ensureDirectories() {
    const directories = [
      this.appPath,
      this.dataPath,
      this.cachePath,
      path.join(this.dataPath, 'backups')
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * 获取应用安装路径
   */
  static getAppPath() {
    return this.appPath;
  }

  /**
   * 获取数据目录路径
   */
  static getDataPath() {
    return this.dataPath;
  }

  /**
   * 获取配置文件路径
   */
  static getConfigPath() {
    return this.configPath;
  }

  /**
   * 获取数据库文件路径
   */
  static getDatabasePath() {
    return this.databasePath;
  }

  /**
   * 获取缓存目录路径
   */
  static getCachePath() {
    return this.cachePath;
  }

  /**
   * 检查 E 盘是否可用
   */
  static checkEDriveAvailable() {
    try {
      const drives = this.getAvailableDrives();
      return drives.includes('E:');
    } catch (error) {
      console.error('检查 E 盘失败:', error);
      return false;
    }
  }

  /**
   * 获取可用的驱动器列表
   */
  static getAvailableDrives() {
    const platform = os.platform();
    
    if (platform === 'win32') {
      // Windows 系统
      const drives = [];
      for (let i = 65; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':';
        try {
          fs.accessSync(drive, fs.constants.F_OK);
          drives.push(drive);
        } catch (e) {
          // 驱动器不存在
        }
      }
      return drives;
    } else if (platform === 'linux') {
      // Linux 系统，使用 /mnt 或 /media
      return ['/mnt', '/media', '/data'];
    }
    
    return [];
  }

  /**
   * 获取跨平台的数据路径
   * Linux 系统使用用户目录下的 .logmonitor
   */
  static getCrossPlatformDataPath() {
    const platform = os.platform();
    
    if (platform === 'win32') {
      return this.dataPath;
    } else if (platform === 'linux') {
      const homeDir = os.homedir();
      const linuxDataPath = path.join(homeDir, '.logmonitor', 'data');
      this.ensureLinuxDirectories(linuxDataPath);
      return linuxDataPath;
    }
    
    return this.dataPath;
  }

  /**
   * 确保 Linux 目录存在
   */
  static ensureLinuxDirectories(basePath) {
    const directories = [
      basePath,
      path.join(basePath, 'cache'),
      path.join(basePath, 'backups')
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }
}

module.exports = PathManager;
