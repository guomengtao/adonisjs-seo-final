#!/bin/bash

# 定义颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # 无颜色

echo -e "${GREEN}🚀 启动自动化搬运守护程序...${NC}"

# 无限循环
while true
do
    echo -e "${YELLOW}--- 正在启动新一轮搬运任务 ---${NC}"
    
    # 执行 adonis 命令
    node ace webp:run
    
    # 获取上面命令的退出状态码
    EXIT_CODE=$?
    
    # 如果脚本提示“所有任务已完成”，我们可以优雅退出
    # 如果是因为报错崩了，$EXIT_CODE 通常不为 0，我们可以选择等待并重启
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ 检测到任务可能已全部完成或本轮顺利结束。${NC}"
    else
        echo -e "\033[0;31m🚨 脚本异常退出 (Code: $EXIT_CODE)，5秒后尝试重启...${NC}"
    fi

    # 稍微休息一下，防止被 API 频率限制（如 B2 或 HF 的 API）
    echo "休息 5 秒..."
    sleep 5
done