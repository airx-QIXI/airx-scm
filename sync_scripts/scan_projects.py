# -*- coding: utf-8 -*-
"""
Trae 项目扫描器 - 智能扫描工作目录下的所有独立项目

识别规则:
1. 哈希目录（如 6a717be5...）= 一个 Trae 项目工作区
2. 如果哈希目录根目录有 package.json/vercel.json → 哈希目录本身就是项目
3. 如果哈希目录下有子文件夹 → 子文件夹是项目内容
4. 排除 Trae 应用文件目录（aha_doctor, bin, locales 等）
"""

import os
import json
import re

TRAE_WORKSPACE = r"F:\TRAE SOLO CN"

# Trae 应用文件目录（非项目）
APP_DIRS = {
    "aha_doctor", "bin", "locales", "resources", "tools",
    "LICENSES.chromium.html", "TRAE SOLO CN.VisualElementsManifest.xml",
    "TRAE SOLO CN.exe", "debug.log", "manifest.json"
}

# 项目根目录标志文件
ROOT_MARKERS = {"package.json", "vercel.json", "index.html", "app.py", "main.py"}

# 非项目子目录名
NON_PROJECT_DIRS = {
    "node_modules", ".git", "__pycache__", ".trae", "trae_shared",
    ".next", "dist", "build", ".cache"
}

HASH_PATTERN = re.compile(r'^[0-9a-f]{16,}$')


def is_hash_dir(dirname):
    return bool(HASH_PATTERN.match(dirname))


def get_project_name(project_path):
    """从项目中提取最佳显示名称"""
    # 1. package.json 的 name 字段
    pkg_path = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
            name = pkg.get("name", "")
            if name:
                return name
        except:
            pass

    # 2. 文件夹名
    return os.path.basename(project_path)


def get_project_type(project_path):
    """判断项目类型"""
    if os.path.exists(os.path.join(project_path, "vercel.json")):
        return "vercel-app"
    if os.path.exists(os.path.join(project_path, "package.json")):
        try:
            with open(os.path.join(project_path, "package.json"), "r", encoding="utf-8") as f:
                pkg = json.load(f)
            deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
            if "react" in deps or "vite" in deps:
                return "react-app"
            if "express" in deps:
                return "server"
        except:
            pass
    if any(os.path.exists(os.path.join(project_path, f)) for f in ["app.py", "main.py"]):
        return "python-app"
    html_files = [f for f in os.listdir(project_path) if f.endswith(".html")]
    if html_files:
        return "html-page"
    return "unknown"


def has_data_files(project_path):
    """检查项目是否包含数据文件"""
    for root, dirs, files in os.walk(project_path):
        dirs[:] = [d for d in dirs if d not in NON_PROJECT_DIRS]
        for f in files:
            if f.endswith((".json", ".csv", ".xlsx")) and f not in ("package.json", "package-lock.json"):
                return True
    return False


def scan_hash_dir(hash_path, hash_name):
    """
    扫描一个哈希目录，返回其中包含的项目
    """
    projects = []
    entries = sorted(os.listdir(hash_path))

    # 检查哈希目录本身是否是项目根目录
    is_root_project = any(
        os.path.exists(os.path.join(hash_path, marker))
        for marker in ROOT_MARKERS
    )

    if is_root_project:
        # 哈希目录本身就是项目（如 SCM 主项目）
        name = get_project_name(hash_path)
        projects.append({
            "name": name,
            "type": get_project_type(hash_path),
            "has_data": has_data_files(hash_path),
            "hash_dir": hash_name,
            "project_folder": "",
            "full_path": hash_path,
            "is_root": True,
        })
    else:
        # 遍历子目录找项目
        for entry in entries:
            entry_path = os.path.join(hash_path, entry)
            if not os.path.isdir(entry_path):
                continue
            if entry in NON_PROJECT_DIRS or entry.startswith("."):
                continue

            # 检查这个子目录是否是项目
            is_project = any(
                os.path.exists(os.path.join(entry_path, marker))
                for marker in ROOT_MARKERS
            ) or has_data_files(entry_path)

            if is_project:
                name = get_project_name(entry_path)
                projects.append({
                    "name": name,
                    "type": get_project_type(entry_path),
                    "has_data": has_data_files(entry_path),
                    "hash_dir": hash_name,
                    "project_folder": entry,
                    "full_path": entry_path,
                    "is_root": False,
                })

    return projects


def scan_all_projects():
    """扫描所有项目"""
    all_projects = []

    for dirname in sorted(os.listdir(TRAE_WORKSPACE)):
        dir_path = os.path.join(TRAE_WORKSPACE, dirname)

        if not os.path.isdir(dir_path):
            continue
        if dirname in APP_DIRS:
            continue
        if not is_hash_dir(dirname):
            continue

        projects = scan_hash_dir(dir_path, dirname)
        all_projects.extend(projects)

    return all_projects


def main():
    print("=" * 90)
    print("Trae 项目扫描结果")
    print("=" * 90)

    projects = scan_all_projects()

    print(f"\n{'#':<3} {'项目名称':<35} {'类型':<12} {'数据':<5} {'哈希目录':<20} {'文件夹'}")
    print("-" * 90)

    for i, p in enumerate(projects, 1):
        name = p["name"][:33]
        ptype = p["type"]
        has_data = "有" if p["has_data"] else "无"
        hash_short = p["hash_dir"][:18]
        folder = p["project_folder"] or "(根目录)"
        print(f"{i:<3} {name:<35} {ptype:<12} {has_data:<5} {hash_short:<20} {folder}")

    print("-" * 90)
    print(f"共 {len(projects)} 个项目\n")

    # 显示同步注册表状态
    registry_path = os.path.join(TRAE_WORKSPACE, "6a6af8dfe5bf7c0ed727a0ba", "sync_scripts", "sync_registry.json")
    if os.path.exists(registry_path):
        with open(registry_path, "r", encoding="utf-8") as f:
            # 跳过注释，解析JSON
            content = f.read()
            # 移除多行注释
            import re as re2
            content = re2.sub(r'/\*.*?\*/', '', content, flags=re2.DOTALL)
            # 移除单行注释
            lines = [l for l in content.split('\n') if not l.strip().startswith('//') and not l.strip().startswith('#')]
            registry = json.loads('\n'.join(lines))
        synced = [p["display_name"] for p in registry.get("projects", []) if p.get("status") == "active"]
        print(f"已注册同步的项目: {', '.join(synced) if synced else '无'}")

    print(f"\n注册表路径: {registry_path}")
    return projects


if __name__ == "__main__":
    main()
