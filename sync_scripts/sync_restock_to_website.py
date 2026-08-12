# -*- coding: utf-8 -*-
"""
排产补货预测（京东自营补货提醒）- 网站数据同步脚本
将本地 products_cache.json 同步到公域网站（通过API中转）

使用方式：
  1. 自动模式：scheduled_update.py 获取飞书数据后自动调用
  2. 手动模式：python sync_to_website.py

环境变量：
  WEBSITE_API_URL  - 网站API地址（默认: https://www.airxchina.com.cn）
"""

import json
import os
import sys
import urllib.request
import urllib.error

# ========== 配置 ==========
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR) if os.path.basename(SCRIPT_DIR) == "scripts" else SCRIPT_DIR
DATA_PATH = os.path.join(PROJECT_DIR, "data", "products_cache.json")

# 网站API地址
DEFAULT_API_BASE = "https://www.airxchina.com.cn"
API_BASE = os.environ.get("WEBSITE_API_URL", DEFAULT_API_BASE).rstrip("/")
SYNC_ENDPOINT = f"{API_BASE}/api/integrations/production-restock/sync"

# 请求超时（秒）
TIMEOUT = 60


def sync_to_website(products, cache_time=None):
    """
    将库存数据同步到网站API

    Args:
        products: 产品列表（与 products_cache.json 中的 products 字段一致）
        cache_time: 数据缓存时间字符串

    Returns:
        dict: API返回的响应数据，失败时返回 None
    """
    payload = json.dumps({
        "products": products,
        "cacheTime": cache_time or "",
    }, ensure_ascii=False).encode("utf-8")

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

            # API返回直接对象或包装对象
            sync_info = result.get("data", result)
            is_success = (
                result.get("success", False)
                or result.get("ok", False)
                or ("synced" in result and "syncedAt" in result)
                or (sync_info and "synced" in sync_info)
            )

            if is_success:
                info = sync_info if isinstance(sync_info, dict) and "synced" in sync_info else result
                print(f"  ✅ 网站同步成功!")
                print(f"     同步产品数: {info.get('synced', '-')}/{info.get('total', '-')}")
                print(f"     同步时间: {info.get('syncedAt', '-')}")
                if info.get('errors'):
                    print(f"     部分错误: {len(info['errors'])} 条")
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
    """独立运行模式：读取本地 products_cache.json 并同步到网站"""
    print("=" * 60)
    print("排产补货预测 - 网站数据同步")
    print("=" * 60)
    print(f"  本地数据: {DATA_PATH}")
    print(f"  网站API:  {SYNC_ENDPOINT}")
    print()

    # 检查本地数据文件
    if not os.path.exists(DATA_PATH):
        print(f"❌ 本地数据文件不存在: {DATA_PATH}")
        print("   请先运行: python scheduled_update.py")
        sys.exit(1)

    # 读取数据
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        cache = json.load(f)

    products = cache.get("products", [])
    cache_time = cache.get("cache_time", "")

    print(f"  数据概览:")
    print(f"    产品总数: {len(products)}")
    print(f"    缓存时间: {cache_time}")
    print()

    if not products:
        print("❌ 无产品数据可同步")
        sys.exit(1)

    # 同步到网站
    print("  开始同步...")
    result = sync_to_website(products, cache_time)

    if result:
        print(f"\n✅ 同步完成! 网站将自动显示最新数据。")
    else:
        print(f"\n❌ 同步失败，请检查网络或API地址。")
        print(f"   可设置环境变量 WEBSITE_API_URL 切换API地址")
        sys.exit(1)


if __name__ == "__main__":
    main()
