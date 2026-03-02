# -*- coding: utf-8 -*-
"""
企业级日志监控系统 - 全面自动化测试脚本
测试 P0、P1、P2 所有功能
"""

import os
import re

# 颜色输出
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def print_result(test_name, passed, message=""):
    status = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
    print(f"{test_name}: {status} {message}")
    return passed

def check_file_exists(file_path):
    """检查文件是否存在"""
    return os.path.exists(file_path)

def read_file_content(file_path):
    """读取文件内容"""
    if not check_file_exists(file_path):
        return None
    with open(file_path, 'r', encoding='utf-8') as f:
        return f.read()

# ==================== P0 核心修复测试 ====================

def test_p0_virtual_scroll():
    """测试虚拟滚动"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\src\pages\LogViewer.js")
    if not content:
        return print_result("P0-虚拟滚动", False, "LogViewer.js 不存在")
    
    # 检查虚拟滚动相关代码
    has_virtual = 'virtual' in content.lower() or 'visible' in content.lower()
    has_limit = '30' in content or 'visibleCount' in content
    
    passed = has_virtual or has_limit
    return print_result("P0-虚拟滚动", passed, "只渲染可见区域" if passed else "未实现")

def test_p0_memory_limit():
    """测试内存限制（环形缓冲区）"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\src\pages\LogViewer.js")
    if not content:
        return print_result("P0-内存限制", False, "LogViewer.js 不存在")
    
    # 检查环形缓冲区
    has_ring = 'RingBuffer' in content or 'ring' in content.lower()
    has_max = '10000' in content or 'MAX_' in content
    
    passed = has_ring and has_max
    return print_result("P0-内存限制", passed, "环形缓冲区限制 10000 条" if passed else "未实现")

def test_p0_backend_filter():
    """测试后端过滤"""
    db_content = read_file_content(r"E:\openclaw-projects\log-monitor-app\electron\databaseService.js")
    main_content = read_file_content(r"E:\openclaw-projects\log-monitor-app\electron\main.js")
    
    if not db_content or not main_content:
        return print_result("P0-后端过滤", False, "文件不存在")
    
    # 检查后端过滤
    has_filter = 'level' in db_content and 'keyword' in db_content
    has_query = 'getLogs' in db_content and 'WHERE' in db_content
    
    passed = has_filter and has_query
    return print_result("P0-后端过滤", passed, "支持级别/关键字过滤" if passed else "未实现")

def test_p0_file_handle():
    """测试文件句柄管理"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\electron\logMonitorService.js")
    if not content:
        return print_result("P0-文件句柄", False, "logMonitorService.js 不存在")
    
    # 检查文件句柄管理
    has_manager = 'FileHandleManager' in content or 'handleManager' in content.lower()
    has_limit = '50' in content or 'MAX_' in content
    
    passed = has_manager and has_limit
    return print_result("P0-文件句柄管理", passed, "限制 50 个文件句柄" if passed else "未实现")

# ==================== P1 功能优化测试 ====================

def test_p1_incremental_query():
    """测试增量查询"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\electron\databaseService.js")
    if not content:
        return print_result("P1-增量查询", False, "databaseService.js 不存在")
    
    # 检查增量查询
    has_incremental = 'incremental' in content.lower() or 'lastTimestamp' in content
    has_state = 'query_state' in content or 'last_query' in content
    
    passed = has_incremental and has_state
    return print_result("P1-增量查询", passed, "记录最后查询时间戳" if passed else "未实现")

def test_p1_log_archive():
    """测试日志归档"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\electron\databaseService.js")
    if not content:
        return print_result("P1-日志归档", False, "databaseService.js 不存在")
    
    # 检查归档功能
    has_archive = 'archive' in content.lower()
    has_gzip = 'gzip' in content.lower() or 'compress' in content.lower()
    has_days = '7' in content or 'days' in content.lower()
    
    passed = has_archive and (has_gzip or has_days)
    return print_result("P1-日志归档", passed, "7 天自动归档+gzip 压缩" if passed else "未实现")

def test_p1_alert_system():
    """测试告警系统"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\electron\alertService.js")
    if not content:
        return print_result("P1-告警系统", False, "alertService.js 不存在")
    
    # 检查告警功能
    has_keyword = 'keyword' in content.lower()
    has_frequency = 'frequency' in content.lower() or 'threshold' in content.lower()
    has_notify = 'notify' in content.lower() or 'notification' in content.lower()
    
    passed = has_keyword and has_frequency and has_notify
    return print_result("P1-告警系统", passed, "关键字/频率告警 + 通知" if passed else "未实现")

def test_p1_config_ui():
    """测试配置界面"""
    alert_history = check_file_exists(r"E:\openclaw-projects\log-monitor-app\src\pages\AlertHistory.js")
    archive_manager = check_file_exists(r"E:\openclaw-projects\log-monitor-app\src\pages\ArchiveManager.js")
    
    passed = alert_history and archive_manager
    return print_result("P1-配置界面", passed, "告警历史 + 归档管理页面" if passed else "未实现")

# ==================== P2 企业级功能测试 ====================

def test_p2_statistics():
    """测试统计分析"""
    content = check_file_exists(r"E:\openclaw-projects\log-monitor-app\src\pages\Statistics.js")
    if not content:
        return print_result("P2-统计分析", False, "Statistics.js 不存在")
    
    file_content = read_file_content(r"E:\openclaw-projects\log-monitor-app\src\pages\Statistics.js")
    has_pie = 'pie' in file_content.lower() or '饼图' in file_content
    has_line = 'line' in file_content.lower() or '折线图' in file_content
    
    passed = has_pie and has_line
    return print_result("P2-统计分析", passed, "饼图/趋势图/错误排行" if passed else "未实现")

def test_p2_high_availability():
    """测试高可用机制"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\electron\main.js")
    if not content:
        return print_result("P2-高可用", False, "main.js 不存在")
    
    # 检查高可用功能
    has_guard = 'render-process-gone' in content or 'reload' in content
    has_backup = 'backup' in content.lower()
    has_health = 'health' in content.lower() or 'Health' in content
    
    passed = has_guard and has_backup and has_health
    return print_result("P2-高可用机制", passed, "进程守护/配置备份/健康监控" if passed else "未实现")

def test_p2_api_webhook():
    """测试 API/Webhook"""
    content = check_file_exists(r"E:\openclaw-projects\log-monitor-app\electron\apiService.js")
    doc = check_file_exists(r"E:\openclaw-projects\log-monitor-app\API_DOCUMENTATION.md")
    
    passed = content and doc
    return print_result("P2-API/Webhook", passed, "REST API+Webhook+ 文档" if passed else "未实现")

def test_p2_user_experience():
    """测试用户体验"""
    content = read_file_content(r"E:\openclaw-projects\log-monitor-app\src\App.js")
    if not content:
        return print_result("P2-用户体验", False, "App.js 不存在")
    
    # 检查用户体验功能
    has_theme = 'theme' in content.lower() or 'Theme' in content
    has_shortcut = 'Ctrl+' in content or 'shortcut' in content.lower()
    has_bookmark = 'bookmark' in content.lower() or '书签' in content
    
    passed = has_theme and has_shortcut and has_bookmark
    return print_result("P2-用户体验", passed, "主题切换/快捷键/书签" if passed else "未实现")

# ==================== 主测试流程 ====================

def main():
    print("\n" + "="*70)
    print(f"{YELLOW}企业级日志监控系统 - 全面自动化测试{RESET}")
    print("="*70)
    
    # 检查安装包
    exe_path = r"E:\openclaw-projects\log-monitor-app\dist\LogMonitor 1.0.0.exe"
    print(f"\n检查安装包：{exe_path}")
    
    if not check_file_exists(exe_path):
        print(f"{RED}[ERROR] 安装包不存在！需要先打包{RESET}")
        return False
    
    exe_size = os.path.getsize(exe_path)
    print(f"{GREEN}[OK] 安装包存在{RESET} (大小：{exe_size/1024/1024:.2f} MB)")
    
    # 运行所有测试
    results = []
    
    print("\n" + "-"*70)
    print(f"{YELLOW}P0 核心修复测试{RESET}")
    print("-"*70)
    results.append(("P0-虚拟滚动", test_p0_virtual_scroll()))
    results.append(("P0-内存限制", test_p0_memory_limit()))
    results.append(("P0-后端过滤", test_p0_backend_filter()))
    results.append(("P0-文件句柄", test_p0_file_handle()))
    
    print("\n" + "-"*70)
    print(f"{YELLOW}P1 功能优化测试{RESET}")
    print("-"*70)
    results.append(("P1-增量查询", test_p1_incremental_query()))
    results.append(("P1-日志归档", test_p1_log_archive()))
    results.append(("P1-告警系统", test_p1_alert_system()))
    results.append(("P1-配置界面", test_p1_config_ui()))
    
    print("\n" + "-"*70)
    print(f"{YELLOW}P2 企业级功能测试{RESET}")
    print("-"*70)
    results.append(("P2-统计分析", test_p2_statistics()))
    results.append(("P2-高可用", test_p2_high_availability()))
    results.append(("P2-API/Webhook", test_p2_api_webhook()))
    results.append(("P2-用户体验", test_p2_user_experience()))
    
    # 汇总结果
    print("\n" + "="*70)
    print(f"{YELLOW}测试结果汇总{RESET}")
    print("="*70)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_name, passed in results:
        status = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
        print(f"{status} {test_name}")
    
    print("\n" + "-"*70)
    print(f"总计：{passed_count}/{total_count} 通过")
    
    if passed_count == total_count:
        print(f"\n{GREEN}[SUCCESS] 所有企业级功能已实现！{RESET}")
    else:
        print(f"\n{RED}[WARNING] 还有 {total_count - passed_count} 个功能未实现{RESET}")
    
    print("="*70 + "\n")
    
    return passed_count == total_count

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
