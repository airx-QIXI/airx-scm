# -*- coding: utf-8 -*-
"""
Trae 项目智能识别器

原理:
- 哈希目录（如 6a717be5...）是 Trae 内部ID，不会因重命名而变化
- 通过扫描项目内容（README、package.json、HTML标题等）提取识别特征
- 用户通过这些特征确认项目身份，然后在注册表中建立映射
- 一旦注册，即使后续重命名，哈希目录路径仍然有效

使用场景:
  1. 用户说"我要同步XX项目" → 运行此脚本列出所有项目
  2. 用户通过特征确认哪个是目标项目
  3. 将项目添加到 sync_registry.json
"""

import os
import json
import re
from urllib.parse import unquote

TRAE_WORKSPACE = r"F:\TRAE SOLO CN"
REGISTRY_PATH = os.path.join(TRAE_WORKSPACE, "6a6af8dfe5bf7c0ed727a0ba", "sync_scripts", "sync_registry.json")

APP_DIRS = {"aha_doctor", "bin", "locales", "resources", "tools"}
NON_PROJECT_DIRS = {"node_modules", ".git", "__pycache__", ".trae", "trae_shared", ".next", "dist", "build", ".cache"}
HASH_PATTERN = re.compile(r'^[0-9a-f]{16,}$')


def is_hash_dir(dirname):
    return bool(HASH_PATTERN.match(dirname))


def extract_project_info(project_path, hash_dir, folder_name):
    """提取项目的识别信息"""
    info = {
        "hash_dir": hash_dir,
        "folder_name": folder_name,
        "full_path": project_path,
        "package_name": "",
        "description": "",
        "readme_title": "",
        "html_title": "",
        "main_files": [],
        "key_features": [],
    }

    # 1. package.json
    pkg_path = os.path.join(project_path, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                pkg = json.load(f)
            info["package_name"] = pkg.get("name", "")
            info["description"] = pkg.get("description", "")
            info["key_features"].append(f"npm项目: {pkg.get('name', '?')}")
        except:
            pass

    # 2. README 标题
    for readme in ["README.md", "readme.md", "README.MD"]:
        readme_path = os.path.join(project_path, readme)
        if os.path.exists(readme_path):
            try:
                with open(readme_path, "r", encoding="utf-8") as f:
                    first_line = f.readline().strip()
                    if first_line.startswith("#"):
                        info["readme_title"] = first_line.lstrip("#").strip()
                        info["key_features"].append(f"README标题: {info['readme_title']}")
            except:
                pass
            break

    # 3. HTML 文件标题
    for f in os.listdir(project_path):
        if f.endswith(".html"):
            try:
                with open(os.path.join(project_path, f), "r", encoding="utf-8") as fh:
                    content = fh.read(2000)
                    title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
                    if title_match:
                        info["html_title"] = title_match.group(1).strip()
                        info["key_features"].append(f"网页标题: {info['html_title']}")
            except:
                pass

    # 4. 主要文件列表
    for f in sorted(os.listdir(project_path)):
        if f.startswith(".") or f in NON_PROJECT_DIRS:
            continue
        if os.path.isfile(os.path.join(project_path, f)):
            info["main_files"].append(f)

    # 5. Python 项目特征
    for py_file in ["app.py", "main.py", "fetch_data.py"]:
        if os.path.exists(os.path.join(project_path, py_file)):
            try:
                with open(os.path.join(project_path, py_file), "r", encoding="utf-8") as f:
                    content = f.read(500)
                    doc_match = re.search(r'"""(.*?)"""', content, re.DOTALL)
                    if doc_match:
                        doc = doc_match.group(1).strip().split("\n")[0]
                        info["key_features"].append(f"脚本说明: {doc}")
            except:
                pass

    # 6. 数据文件
    data_files = []
    for f in os.listdir(project_path):
        if f.endswith((".json", ".csv", ".xlsx")) and f not in ("package.json", "package-lock.json"):
            data_files.append(f)
    if data_files:
        info["key_features"].append(f"数据文件: {', '.join(data_files[:3])}")

    # 7. 子目录中的项目
    subdirs = [d for d in os.listdir(project_path)
               if os.path.isdir(os.path.join(project_path, d))
               and not d.startswith(".") and d not in NON_PROJECT_DIRS]
    if subdirs:
        info["key_features"].append(f"子目录: {', '.join(subdirs[:5])}")

    return info


def scan_all_projects():
    """扫描所有项目"""
    projects = []

    for dirname in sorted(os.listdir(TRAE_WORKSPACE)):
        dir_path = os.path.join(TRAE_WORKSPACE, dirname)
        if not os.path.isdir(dir_path) or dirname in APP_DIRS or not is_hash_dir(dirname):
            continue

        # 检查哈希目录本身是否是项目
        root_markers = ["package.json", "vercel.json", "index.html", "app.py"]
        is_root = any(os.path.exists(os.path.join(dir_path, m)) for m in root_markers)

        if is_root:
            info = extract_project_info(dir_path, dirname, "(根目录)")
            projects.append(info)
        else:
            # 遍历子目录
            for subname in sorted(os.listdir(dir_path)):
                sub_path = os.path.join(dir_path, subname)
                if not os.path.isdir(sub_path) or subname in NON_PROJECT_DIRS or subname.startswith("."):
                    continue
                sub_markers = ["package.json", "index.html", "app.py", "main.py", "vite.config.js"]
                has_project = any(os.path.exists(os.path.join(sub_path, m)) for m in sub_markers)
                if has_project:
                    info = extract_project_info(sub_path, dirname, subname)
                    projects.append(info)

    return projects


def load_registry():
    """加载注册表"""
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"projects": []}


def main():
    projects = scan_all_projects()
    registry = load_registry()
    registered_hashes = {p.get("hash_dir", "") for p in registry.get("projects", [])}

    print("=" * 90)
    print("Trae 项目识别器 - 通过内容特征识别项目")
    print("=" * 90)

    for i, p in enumerate(projects, 1):
        is_synced = "✅已注册同步" if p["hash_dir"] in registered_hashes else "⬜未同步"

        print(f"\n{'─' * 90}")
        print(f"  项目 #{i}  {is_synced}")
        print(f"  哈希目录:   {p['hash_dir']}")
        print(f"  文件夹名:   {p['folder_name']}")
        print(f"  完整路径:   {p['full_path']}")

        if p["package_name"]:
            print(f"  npm名称:    {p['package_name']}")
        if p["description"]:
            print(f"  描述:       {p['description']}")
        if p["readme_title"]:
            print(f"  README标题: {p['readme_title']}")
        if p["html_title"]:
            print(f"  网页标题:   {p['html_title']}")

        if p["key_features"]:
            print(f"  识别特征:")
            for feat in p["key_features"]:
                print(f"    • {feat}")

        if p["main_files"]:
            print(f"  主要文件:   {', '.join(p['main_files'][:8])}")

    print(f"\n{'─' * 90}")
    print(f"共发现 {len(projects)} 个项目")
    synced = sum(1 for p in projects if p["hash_dir"] in registered_hashes)
    print(f"已注册同步: {synced} 个，未同步: {len(projects) - synced} 个")
    print(f"\n注册表路径: {REGISTRY_PATH}")
    print(f"\n提示: 告诉助手你要同步的项目序号（如 #1），即可添加到同步注册表。")


if __name__ == "__main__":
    main()
