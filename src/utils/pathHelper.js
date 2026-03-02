/**
 * 路径工具函数
 * 处理跨平台路径相关操作
 */

/**
 * 标准化路径分隔符
 * @param {string} path - 原始路径
 * @returns {string} 标准化后的路径
 */
export function normalizePath(path) {
  if (!path) return '';
  
  // Windows 路径统一使用反斜杠
  if (process.platform === 'win32') {
    return path.replace(/\//g, '\\');
  }
  
  // Linux/Mac 路径统一使用正斜杠
  return path.replace(/\\/g, '/');
}

/**
 * 获取文件名
 * @param {string} filePath - 完整文件路径
 * @returns {string} 文件名
 */
export function getFileName(filePath) {
  if (!filePath) return '';
  
  const normalized = normalizePath(filePath);
  const separator = process.platform === 'win32' ? '\\' : '/';
  const parts = normalized.split(separator);
  return parts[parts.length - 1];
}

/**
 * 获取文件扩展名
 * @param {string} filePath - 文件路径
 * @returns {string} 扩展名（不含点）
 */
export function getFileExtension(filePath) {
  const fileName = getFileName(filePath);
  const lastDotIndex = fileName.lastIndexOf('.');
  
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return '';
  }
  
  return fileName.substring(lastDotIndex + 1).toLowerCase();
}

/**
 * 判断是否为日志文件
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isLogFile(filePath) {
  const ext = getFileExtension(filePath);
  const logExtensions = ['log', 'txt', 'json', 'out', 'err'];
  return logExtensions.includes(ext);
}

/**
 * 获取目录路径
 * @param {string} filePath - 文件路径
 * @returns {string} 目录路径
 */
export function getDirectory(filePath) {
  if (!filePath) return '';
  
  const normalized = normalizePath(filePath);
  const separator = process.platform === 'win32' ? '\\' : '/';
  const parts = normalized.split(separator);
  parts.pop();
  return parts.join(separator);
}

/**
 * 拼接路径
 * @param  {...string} parts - 路径片段
 * @returns {string} 拼接后的路径
 */
export function joinPath(...parts) {
  const separator = process.platform === 'win32' ? '\\' : '/';
  return parts
    .filter(p => p)
    .map(p => normalizePath(p))
    .join(separator);
}

/**
 * 判断路径是否为绝对路径
 * @param {string} filePath - 文件路径
 * @returns {boolean}
 */
export function isAbsolutePath(filePath) {
  if (!filePath) return false;
  
  if (process.platform === 'win32') {
    // Windows: E:\path 或 \\server\share
    return /^[a-zA-Z]:\\/.test(filePath) || /^\\\\/.test(filePath);
  }
  
  // Linux/Mac: /path
  return filePath.startsWith('/');
}

/**
 * 格式化路径显示（缩短长路径）
 * @param {string} filePath - 文件路径
 * @param {number} maxLength - 最大长度
 * @returns {string} 格式化后的路径
 */
export function formatPathDisplay(filePath, maxLength = 50) {
  if (!filePath || filePath.length <= maxLength) {
    return filePath;
  }
  
  const normalized = normalizePath(filePath);
  const separator = process.platform === 'win32' ? '\\' : '/';
  const parts = normalized.split(separator);
  
  if (parts.length <= 2) {
    return filePath.substring(0, maxLength - 3) + '...';
  }
  
  const fileName = parts[parts.length - 1];
  const dirName = parts[parts.length - 2];
  
  return `...${separator}${dirName}${separator}${fileName}`;
}

export default {
  normalizePath,
  getFileName,
  getFileExtension,
  isLogFile,
  getDirectory,
  joinPath,
  isAbsolutePath,
  formatPathDisplay
};
