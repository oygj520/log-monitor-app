/**
 * 日志解析工具
 * 支持多种常见日志格式的自动识别和解析
 */

/**
 * 检测堆栈跟踪关键字
 */
function isStackTrace(line) {
  const stackTracePatterns = [
    /java\.lang\./,
    /at [\w\.]+\(/,
    /Caused by:/,
    /Exception in thread/,
    /Traceback \(most recent call last\)/,
    /File "[^"]+", line \d+/
  ];
  
  return stackTracePatterns.some(pattern => pattern.test(line));
}

/**
 * 解析单行日志
 * @param {string} line - 日志行
 * @param {string} source - 来源文件名
 * @returns {object|null} 解析后的日志对象
 */
export function parseLogLine(line, source = 'unknown') {
  if (!line || !line.trim()) {
    return null;
  }

  const trimmedLine = line.trim();
  
  // 尝试各种日志格式
  const parsers = [
    parseBracketFormat,      // [2024-01-01 12:00:00] [ERROR] message
    parseISOFormat,          // 2024-01-01T12:00:00.000Z ERROR message
    parseSimpleFormat,       // 2024-01-01 12:00:00 ERROR message
    parseJSONFormat,         // JSON 格式
    parseApacheFormat,       // Apache 访问日志
    parseNginxFormat,        // Nginx 访问日志
    parseSyslogFormat        // Syslog 格式
  ];

  let result = null;
  for (const parser of parsers) {
    result = parser(trimmedLine, source);
    if (result) {
      break;
    }
  }

  // 如果所有格式都不匹配，返回原始日志
  if (!result) {
    result = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: trimmedLine,
      source,
      raw: trimmedLine
    };
  }

  // 检测堆栈跟踪，自动识别为 ERROR 级别
  if (isStackTrace(trimmedLine)) {
    result.level = 'ERROR';
  }

  return result;
}

/**
 * 解析括号格式：[2024-01-01 12:00:00] [ERROR] message
 */
function parseBracketFormat(line, source) {
  const match = line.match(/^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\]\s+\[(\w+)\]\s+(.*)$/);
  if (match) {
    return {
      timestamp: match[1],
      level: normalizeLevel(match[2]),
      message: match[3],
      source,
      raw: line
    };
  }
  return null;
}

/**
 * 解析 ISO 格式：2024-01-01T12:00:00.000Z ERROR message
 */
function parseISOFormat(line, source) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\s+(\w+)\s+(.*)$/);
  if (match) {
    return {
      timestamp: match[1],
      level: normalizeLevel(match[2]),
      message: match[3],
      source,
      raw: line
    };
  }
  return null;
}

/**
 * 解析简单格式：2024-01-01 12:00:00 ERROR message
 */
function parseSimpleFormat(line, source) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+(\w+)\s+(.*)$/);
  if (match) {
    return {
      timestamp: match[1],
      level: normalizeLevel(match[2]),
      message: match[3],
      source,
      raw: line
    };
  }
  return null;
}

/**
 * 解析 JSON 格式
 */
function parseJSONFormat(line, source) {
  try {
    const jsonLog = JSON.parse(line);
    
    // 检查是否是日志对象
    if (jsonLog.timestamp || jsonLog.time || jsonLog.date || jsonLog["@timestamp"]) {
      return {
        timestamp: jsonLog.timestamp || jsonLog.time || jsonLog.date || jsonLog["@timestamp"],
        level: normalizeLevel(jsonLog.level || jsonLog.severity || jsonLog.loglevel || 'INFO'),
        message: jsonLog.message || jsonLog.msg || jsonLog.text || line,
        source,
        raw: line,
        extra: jsonLog // 保留额外字段
      };
    }
  } catch (e) {
    // 不是 JSON 格式
  }
  return null;
}

/**
 * 解析 Apache 访问日志格式
 * 127.0.0.1 - - [01/Jan/2024:12:00:00 +0800] "GET /path HTTP/1.1" 200 1234
 */
function parseApacheFormat(line, source) {
  const match = line.match(/^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]+)"\s+(\d+)\s+(\d+)/);
  if (match) {
    const ip = match[1];
    const timestamp = match[2];
    const request = match[3];
    const status = parseInt(match[4]);
    const size = match[5];

    let level = 'INFO';
    if (status >= 500) level = 'ERROR';
    else if (status >= 400) level = 'WARN';

    return {
      timestamp: parseApacheTimestamp(timestamp),
      level,
      message: `${request} - ${status}`,
      source,
      raw: line,
      extra: { ip, status, size, request }
    };
  }
  return null;
}

/**
 * 解析 Nginx 访问日志格式
 */
function parseNginxFormat(line, source) {
  // 类似 Apache，可以扩展更复杂的解析
  return parseApacheFormat(line, source);
}

/**
 * 解析 Syslog 格式
 * Jan  1 12:00:00 hostname process[1234]: message
 */
function parseSyslogFormat(line, source) {
  const match = line.match(/^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[\d+\])?:\s+(.*)$/);
  if (match) {
    return {
      timestamp: match[1],
      level: 'INFO',
      message: match[4],
      source,
      raw: line,
      extra: {
        hostname: match[2],
        process: match[3]
      }
    };
  }
  return null;
}

/**
 * 标准化日志级别
 */
function normalizeLevel(level) {
  if (!level) return 'INFO';
  
  const upperLevel = level.toUpperCase();
  
  const levelMap = {
    'TRACE': 'DEBUG',
    'DEBUG': 'DEBUG',
    'INFO': 'INFO',
    'INFORMATION': 'INFO',
    'WARN': 'WARN',
    'WARNING': 'WARN',
    'ERROR': 'ERROR',
    'ERR': 'ERROR',
    'FATAL': 'FATAL',
    'CRITICAL': 'FATAL',
    'CRIT': 'FATAL',
    'EMERG': 'FATAL',
    'EMERGENCY': 'FATAL'
  };

  return levelMap[upperLevel] || 'INFO';
}

/**
 * 解析 Apache 时间戳
 */
function parseApacheTimestamp(timestamp) {
  // 01/Jan/2024:12:00:00 +0800
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };

  const match = timestamp.match(/(\d{1,2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const day = parseInt(match[1]);
    const month = months[match[2]];
    const year = parseInt(match[3]);
    const hour = parseInt(match[4]);
    const minute = parseInt(match[5]);
    const second = parseInt(match[6]);

    const date = new Date(year, month, day, hour, minute, second);
    return date.toISOString();
  }

  return timestamp;
}

/**
 * 批量解析日志行
 */
export function parseLogLines(lines, source) {
  const logs = [];
  
  for (const line of lines) {
    const parsed = parseLogLine(line, source);
    if (parsed) {
      logs.push(parsed);
    }
  }

  return logs;
}

/**
 * 检测日志格式
 */
export function detectLogFormat(sampleLines) {
  if (!sampleLines || sampleLines.length === 0) {
    return 'unknown';
  }

  const formatCounts = {
    bracket: 0,
    iso: 0,
    simple: 0,
    json: 0,
    apache: 0,
    syslog: 0,
    unknown: 0
  };

  for (const line of sampleLines.slice(0, 10)) {
    if (!line.trim()) continue;

    if (/^\[.*\]\s+\[.*\]/.test(line)) {
      formatCounts.bracket++;
    } else if (/^\d{4}-\d{2}-\d{2}T/.test(line)) {
      formatCounts.iso++;
    } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(line)) {
      formatCounts.simple++;
    } else if (line.trim().startsWith('{')) {
      try {
        JSON.parse(line);
        formatCounts.json++;
      } catch (e) {
        formatCounts.unknown++;
      }
    } else if (/^\S+\s+\S+\s+\S+\s+\[.*\]/.test(line)) {
      formatCounts.apache++;
    } else if (/^\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/.test(line)) {
      formatCounts.syslog++;
    } else {
      formatCounts.unknown++;
    }
  }

  // 找出最多的格式
  const maxFormat = Object.entries(formatCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return maxFormat[1] > 0 ? maxFormat[0] : 'unknown';
}

export default {
  parseLogLine,
  parseLogLines,
  detectLogFormat,
  normalizeLevel
};
