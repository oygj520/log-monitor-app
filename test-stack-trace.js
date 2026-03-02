/**
 * 堆栈识别功能测试脚本
 * 验证 logMonitorService.js 中的 parseLogLine 方法是否正确识别堆栈报错
 */

const fs = require('fs');
const path = require('path');

// 模拟数据库服务
const mockDatabaseService = {
  saveLogs: async (logs) => {
    console.log(`[数据库] 保存 ${logs.length} 条日志`);
    return logs;
  }
};

// 导入并实例化 LogMonitorService
const LogMonitorService = require('./electron/logMonitorService.js');
const monitorService = new LogMonitorService(mockDatabaseService);

// 测试用例
const testCases = [
  {
    line: '2026-03-02 15:00:00 INFO 正常日志消息',
    expectedLevel: 'INFO',
    description: '正常日志'
  },
  {
    line: '2026-03-02 15:00:01 java.lang.RuntimeException: 模拟异常：权限不足',
    expectedLevel: 'ERROR',
    description: 'java.lang.RuntimeException: xxx'
  },
  {
    line: '2026-03-02 15:00:02   at com.example.Test.method(Test.java:123)',
    expectedLevel: 'ERROR',
    description: 'at com.example...'
  },
  {
    line: '2026-03-02 15:00:04 Caused by: java.lang.NullPointerException',
    expectedLevel: 'ERROR',
    description: 'Caused by: xxx'
  },
  {
    line: '2026-03-02 15:00:05 Traceback (most recent call last):',
    expectedLevel: 'ERROR',
    description: 'Traceback (most recent call last)'
  },
  {
    line: '2026-03-02 15:00:06   File "test.py", line 10, in <module>',
    expectedLevel: 'ERROR',
    description: 'File "xxx", line xxx'
  },
  {
    line: '2026-03-02 15:00:07 Exception in thread "main" java.lang.Error',
    expectedLevel: 'ERROR',
    description: 'Exception in thread'
  }
];

// 执行测试
console.log('='.repeat(60));
console.log('堆栈识别功能测试');
console.log('='.repeat(60));
console.log('');

let passed = 0;
let failed = 0;
const results = [];

for (const testCase of testCases) {
  const result = monitorService.parseLogLine(testCase.line, 'test.log');
  const actualLevel = result.level;
  const isPassed = actualLevel === testCase.expectedLevel;
  
  if (isPassed) {
    passed++;
  } else {
    failed++;
  }
  
  results.push({
    ...testCase,
    actualLevel,
    passed: isPassed
  });
  
  const status = isPassed ? '✓ 通过' : '✗ 失败';
  console.log(`${status} | ${testCase.description}`);
  console.log(`  输入：${testCase.line}`);
  console.log(`  期望级别：${testCase.expectedLevel}, 实际级别：${actualLevel}`);
  console.log('');
}

// 输出测试报告
console.log('='.repeat(60));
console.log('测试报告');
console.log('='.repeat(60));
console.log(`总测试数：${testCases.length}`);
console.log(`通过：${passed}`);
console.log(`失败：${failed}`);
console.log(`通过率：${((passed / testCases.length) * 100).toFixed(1)}%`);
console.log('');

// 详细结果
console.log('详细验证结果:');
console.log('-'.repeat(60));
results.forEach((result, index) => {
  const status = result.passed ? '✓' : '✗';
  console.log(`${index + 1}. ${status} ${result.description}`);
  console.log(`   期望：${result.expectedLevel}, 实际：${result.actualLevel}`);
});
console.log('');

// 生成测试报告文件
const report = {
  testTime: new Date().toISOString(),
  totalTests: testCases.length,
  passed,
  failed,
  passRate: ((passed / testCases.length) * 100).toFixed(1) + '%',
  results: results.map(r => ({
    description: r.description,
    expected: r.expectedLevel,
    actual: r.actualLevel,
    passed: r.passed
  }))
};

const reportPath = path.join(__dirname, 'test-stack-trace-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`测试报告已保存到：${reportPath}`);
console.log('');

// 返回结果
process.exit(failed > 0 ? 1 : 0);
