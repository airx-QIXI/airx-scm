# =====================================================
# fetch_data.py 修改补丁说明
#
# 以下展示需要在 fetch_data.py 的 main() 函数末尾添加的代码
# 原始文件路径：
#   F:\TRAE SOLO CN\6a717be5ded033ac5a159e55\工厂排产跟进\scripts\fetch_data.py
# =====================================================

"""
在 fetch_data.py 的 main() 函数中，找到以下代码（约第595-609行）：

    # 4. 保存JSON
    print(f"步骤4: 保存数据到 {OUTPUT_PATH}")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n数据获取完成!")
    print(f"  产品总数: {result['summary']['total_products']}")
    print(f"  品类总数: {result['summary']['total_categories']}")
    print(f"  日期范围: {result['summary']['date_range']['start']} ~ {result['summary']['date_range']['end']}")
    print(f"  总排产计划: {result['summary']['total_planned']}")
    print(f"  总实际生产: {result['summary']['total_actual']}")
    print(f"  有排产计划的产品: {result['summary']['products_with_plan']}")
    print(f"  有实际生产的产品: {result['summary']['products_with_actual']}")


替换为以下代码（在末尾新增步骤5）：

    # 4. 保存JSON
    print(f"步骤4: 保存数据到 {OUTPUT_PATH}")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\n数据获取完成!")
    print(f"  产品总数: {result['summary']['total_products']}")
    print(f"  品类总数: {result['summary']['total_categories']}")
    print(f"  日期范围: {result['summary']['date_range']['start']} ~ {result['summary']['date_range']['end']}")
    print(f"  总排产计划: {result['summary']['total_planned']}")
    print(f"  总实际生产: {result['summary']['total_actual']}")
    print(f"  有排产计划的产品: {result['summary']['products_with_plan']}")
    print(f"  有实际生产的产品: {result['summary']['products_with_actual']}")

    # 5. 同步到公域网站
    print(f"\n步骤5: 同步数据到公域网站...")
    try:
        from sync_to_website import sync_to_website
        sync_to_website(result)
    except ImportError:
        print("  ⚠️ 同步脚本未找到，跳过网站同步（本地数据已保存）")
    except Exception as e:
        print(f"  ⚠️ 网站同步失败: {e}（本地数据已保存）")
"""
