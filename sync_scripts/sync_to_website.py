# -*- coding: utf-8 -*-
"""
工厂排产跟进 - 网站数据同步脚本
将本地 data.json 同步到公域网站 TiDB Cloud（通过网站API中转）

使用方式：
  1. 自动模式：fetch_data.py 获取飞书数据后自动调用
  2. 手动模式：python sync_to_website.py

环境变量：
  WEBSITE_API_URL  - 网站API地址（默认: https://airxchina.com.cn）
"""

import json
import os
import sys
import urllib.request
import urllib.error

# ========== 配置 ==========
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DATA_PATH = os.path.join(PROJECT_DIR, "public", "data.json")

# 网站API地址（优先使用环境变量，支持自定义域名或预览地址）
DEFAULT_API_BASE = "https://www.airxchina.com.cn"
API_BASE = os.environ.get("WEBSITE_API_URL", DEFAULT_API_BASE).rstrip("/")
SYNC_ENDPOINT = f"{API_BASE}/api/integrations/factory-production/sync"

# 请求超时（秒）
TIMEOUT = 30


def sync_to_website(data):
    """
    将排产数据同步到网站API

    Args:
        data: 排产数据字典（与 data.json 内容一致）

    Returns:
        dict: API返回的响应数据，失败时返回 None
    """
    payload = json.dumps({"data": data}, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        SYNC_ENDPOINT,
        data=payload,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "User-Agent": "AIRX-SCM-Sync/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)

            # API may return wrapped {success, data} or direct snapshot object
            sync_info = result.get("data", result)
            is_success = (
                result.get("success", False)
                or result.get("ok", False)
                or ("id" in result and "syncedAt" in result)
            )
            if is_success:
                print(f"  ✅ 网站同步成功!")
                print(f"     快照ID: {sync_info.get('id', '-')}")
                print(f"     同步时间: {sync_info.get('syncedAt', '-')}")
                print(f"     产品数: {sync_info.get('totalProducts', '-')}")
                print(f"     排产计划: {sync_info.get('totalPlanned', '-')}")
                print(f"     实际生产: {sync_info.get('totalActual', '-')}")
                return result
            else:
                print(f"  ⚠️ 网站API返回异常: {body[:200]}")
                return None

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        print(f"  ❌ 网站同步失败 (HTTP {e.code}): {error_body[:200]}")
        return None

    except urllib.error.URLError as e:
        print(f"  ❌ 网站连接失败: {e.reason}")
        print(f"     端点: {SYNC_ENDPOINT}")
        return None

    except Exception as e:
        print(f"  ❌ 同步异常: {e}")
        return None


def main():
    """独立运行模式：读取本地 data.json 并同步到网站"""
    print("=" * 60)
    print("工厂排产跟进 - 网站数据同步")
    print("=" * 60)
    print(f"  本地数据: {DATA_PATH}")
    print(f"  网站API:  {SYNC_ENDPOINT}")
    print()

    # 检查本地数据文件
    if not os.path.exists(DATA_PATH):
        print(f"❌ 本地数据文件不存在: {DATA_PATH}")
        print("   请先运行: python scripts/fetch_data.py")
        sys.exit(1)

    # 读取数据
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    summary = data.get("summary", {})
    print(f"  数据概览:")
    print(f"    产品总数: {summary.get('total_products', 0)}")
    print(f"    排产计划: {summary.get('total_planned', 0)}")
    print(f"    实际生产: {summary.get('total_actual', 0)}")
    print(f"    获取时间: {data.get('meta', {}).get('fetched_at', '-')}")
    print()

    # 同步到网站
    print("  开始同步...")
    result = sync_to_website(data)

    if result:
        print(f"\n✅ 同步完成! 网站将自动显示最新数据。")
    else:
        print(f"\n❌ 同步失败，请检查网络或API地址。")
        print(f"   可设置环境变量 WEBSITE_API_URL 切换API地址")
        sys.exit(1)


if __name__ == "__main__":
    main()
