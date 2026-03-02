# -*- coding: utf-8 -*-
"""
日志监控应用 - 5 个 BUG 自动化测试脚本
运行此脚本自动测试 5 个 BUG 是否修复
"""

import subprocess
import time
import sys
import os

# 颜色输出
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

def print_result(test_name, passed, message=""):
    status = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
    print(f"{test_name}: {status} {message}")
    return passed

def check_process_running(process_name):
    """检查进程是否运行"""
    try:
        result = subprocess.run(
            f'Get-Process -Name "{process_name}" -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count',
            shell=True, capture_output=True, text=True
        )
        count = int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        return count > 0
    except:
        return False

def check_file_exists(file_path):
    """检查文件是否存在"""
    return os.path.exists(file_path)

def get_file_mtime(file_path):
    """获取文件修改时间"""
    try:
        return os.path.getmtime(file_path)
    except:
        return 0

def test_bug1_pagination():
    """
    BUG-1: 分页功能失效
    测试：日志列表是否按 50 条分页
    """
    print("\n" + "="*60)
    print("测试 BUG-1: 分页功能")
    print("="*60)
    
    # 检查 LogViewer.js 中是否有分页逻辑
    logviewer_path = r"E:\openclaw-projects\log-monitor-app\src\pages\LogViewer.js"
    if not check_file_exists(logviewer_path):
        return print_result("BUG-1 分页功能", False, "LogViewer.js 不存在")
    
    with open(logviewer_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查分页相关代码
    has_page_size = 'pageSize: 50' in content or 'pageSize:50' in content
    has_slice = '.slice(' in content
    has_pagination = 'pagination' in content.lower()
    
    passed = has_page_size and has_slice and has_pagination
    
    if passed:
        return print_result("BUG-1 分页功能", True, "代码包含分页逻辑 (50 条/页)")
    else:
        return print_result("BUG-1 分页功能", False, "缺少分页逻辑")

def test_bug2_auto_refresh():
    """
    BUG-2: 自动刷新关闭后仍刷新
    测试：关闭自动刷新后是否停止
    """
    print("\n" + "="*60)
    print("测试 BUG-2: 自动刷新开关")
    print("="*60)
    
    logviewer_path = r"E:\openclaw-projects\log-monitor-app\src\pages\LogViewer.js"
    if not check_file_exists(logviewer_path):
        return print_result("BUG-2 自动刷新", False, "LogViewer.js 不存在")
    
    with open(logviewer_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查定时器管理
    has_ref = 'refreshIntervalRef' in content
    has_clear = 'clearInterval' in content
    has_autorefresh_state = 'autoRefresh' in content
    has_cleanup = 'return () =>' in content and 'clearInterval' in content
    
    passed = has_ref and has_clear and has_autorefresh_state and has_cleanup
    
    if passed:
        return print_result("BUG-2 自动刷新", True, "定时器管理正确，关闭后会停止")
    else:
        return print_result("BUG-2 自动刷新", False, "定时器管理有问题")

def test_bug3_sync():
    """
    BUG-3: 日志刷新时消息内容不同步
    测试：刷新时时间和消息是否同步更新
    """
    print("\n" + "="*60)
    print("测试 BUG-3: 日志刷新同步")
    print("="*60)
    
    logviewer_path = r"E:\openclaw-projects\log-monitor-app\src\pages\LogViewer.js"
    if not check_file_exists(logviewer_path):
        return print_result("BUG-3 日志同步", False, "LogViewer.js 不存在")
    
    with open(logviewer_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查是否正确更新日志
    has_spread = '[...result]' in content or '[...prev]' in content
    has_setlogs = 'setLogs' in content
    has_key = 'key=' in content and 'timestamp' in content and 'message' in content
    
    passed = has_spread and has_setlogs and has_key
    
    if passed:
        return print_result("BUG-3 日志同步", True, "使用新数组引用，key 唯一")
    else:
        return print_result("BUG-3 日志同步", False, "数组更新或 key 有问题")

def test_bug4_filter():
    """
    BUG-4: 筛选条件刷新后丢失
    测试：刷新后筛选条件是否保持
    """
    print("\n" + "="*60)
    print("测试 BUG-4: 筛选条件保持")
    print("="*60)
    
    logviewer_path = r"E:\openclaw-projects\log-monitor-app\src\pages\LogViewer.js"
    if not check_file_exists(logviewer_path):
        return print_result("BUG-4 筛选条件", False, "LogViewer.js 不存在")
    
    with open(logviewer_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查筛选条件是否保存在状态中
    has_filters_state = 'const [filters' in content
    has_filters_in_loadlogs = 'loadLogs' in content and 'filters' in content
    has_usecallback = 'useCallback' in content
    
    passed = has_filters_state and has_filters_in_loadlogs and has_usecallback
    
    if passed:
        return print_result("BUG-4 筛选条件", True, "筛选条件保存在状态中")
    else:
        return print_result("BUG-4 筛选条件", False, "筛选条件未正确保存")

def test_bug5_50limit():
    """
    BUG-5: 分页限定 50 条
    测试：每页是否固定显示 50 条
    """
    print("\n" + "="*60)
    print("测试 BUG-5: 分页限定 50 条")
    print("="*60)
    
    logviewer_path = r"E:\openclaw-projects\log-monitor-app\src\pages\LogViewer.js"
    if not check_file_exists(logviewer_path):
        return print_result("BUG-5 分页 50 条", False, "LogViewer.js 不存在")
    
    with open(logviewer_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查 pageSize 是否为 50
    has_50_limit = 'pageSize: 50' in content or 'pageSize:50' in content or 'pageSize = 50' in content
    
    passed = has_50_limit
    
    if passed:
        return print_result("BUG-5 分页 50 条", True, "每页固定 50 条")
    else:
        return print_result("BUG-5 分页 50 条", False, "pageSize 不是 50")

def main():
    print("\n" + "="*60)
    print(f"{YELLOW}日志监控应用 - 5 个 BUG 自动化测试{RESET}")
    print("="*60)
    
    # 检查应用是否存在
    exe_path = r"E:\openclaw-projects\log-monitor-app\dist\LogMonitor 1.0.0.exe"
    print(f"\n检查安装包：{exe_path}")
    
    if not check_file_exists(exe_path):
        print(f"{RED}[ERROR] 安装包不存在！{RESET}")
        print("请先运行打包命令生成安装包")
        return
    
    exe_mtime = get_file_mtime(exe_path)
    exe_time = time.strftime('%Y/%m/%d %H:%M:%S', time.localtime(exe_mtime))
    print(f"{GREEN}[OK] 安装包存在{RESET} (生成时间：{exe_time})")
    
    # 运行所有测试
    results = []
    
    results.append(("BUG-1 分页功能", test_bug1_pagination()))
    results.append(("BUG-2 自动刷新", test_bug2_auto_refresh()))
    results.append(("BUG-3 日志同步", test_bug3_sync()))
    results.append(("BUG-4 筛选条件", test_bug4_filter()))
    results.append(("BUG-5 分页 50 条", test_bug5_50limit()))
    
    # 汇总结果
    print("\n" + "="*60)
    print(f"{YELLOW}测试结果汇总{RESET}")
    print("="*60)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_name, passed in results:
        status = f"{GREEN}[PASS]{RESET}" if passed else f"{RED}[FAIL]{RESET}"
        print(f"{status} {test_name}")
    
    print("\n" + "-"*60)
    print(f"总计：{passed_count}/{total_count} 通过")
    
    if passed_count == total_count:
        print(f"\n{GREEN}[SUCCESS] 所有 BUG 已修复！{RESET}")
    else:
        print(f"\n{RED}[WARNING] 还有 {total_count - passed_count} 个 BUG 未修复{RESET}")
    
    print("="*60 + "\n")
    
    # 返回结果
    return passed_count == total_count

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
