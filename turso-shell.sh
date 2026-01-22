#!/bin/bash

# 1. 检查文件
if [ ! -f .env ]; then
    echo "❌ 错误: 未找到 .env 文件"
    exit 1
fi

# 2. 稳健加载变量：只读取【字母开头=非空】的行
while IFS='=' read -r key value; do
    # 过滤掉注释行、空行，以及不符合 KEY=VALUE 格式的行
    if [[ $key =~ ^[a-zA-Z_]+[a-zA-Z0-9_]*$ ]]; then
        # 去掉 value 两端的引号和可能存在的行尾空格
        eval export "$key"="$value"
    fi
done < .env

# 3. 验证变量
if [ -z "$TURSO_URL" ]; then
    echo "❌ 错误: .env 中未定义 TURSO_URL"
    exit 1
fi

echo "✅ 配置加载成功 (已忽略非法注释)"
echo "🚀 正在连接 Turso..."

# 4. 进入交互模式
turso db shell "$TURSO_URL"