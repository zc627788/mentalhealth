#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从 generated_ids.json 读取 ID 并更新到 002_import_random_ids.sql
"""

import json
import os

# 文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(SCRIPT_DIR, 'generated_ids.json')
SQL_FILE = os.path.join(SCRIPT_DIR, 'supabase', 'migrations', '002_import_random_ids.sql')

def main():
    # 读取 JSON 文件
    with open(JSON_FILE, 'r', encoding='utf-8') as f:
        ids = json.load(f)
    
    print(f"从 {JSON_FILE} 读取了 {len(ids)} 个 ID")
    
    # 生成 SQL VALUES 语句
    values_lines = []
    for code in ids:
        values_lines.append(f"('{code}', false, NULL, NULL, NOW(), NOW())")
    
    # 构建完整的 SQL 内容
    sql_content = """-- 导入随机 ID 数据到 random_ids 表
-- 此脚本由 generated_ids.json 生成

-- 清空现有数据 (如需重新导入)
-- DELETE FROM random_ids;

-- 插入所有随机 ID (共 {} 条)
INSERT INTO random_ids (code, is_used, user_id, used_at, created_at, updated_at) VALUES
{}
;
""".format(len(ids), ",\n".join(values_lines))
    
    # 写入 SQL 文件
    with open(SQL_FILE, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    
    print(f"已更新 {SQL_FILE}")
    print(f"共生成 {len(ids)} 条 INSERT 语句")

if __name__ == '__main__':
    main()
