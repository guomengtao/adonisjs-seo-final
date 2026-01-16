#!/bin/bash

# 注意：等号两边不能有空格！
# 如果运行 ./run.sh 时后面没跟参数，$1 就是空的，则默认使用 webp:run
COMMAND=${1:-"webp:run"}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 启动自动化守护程序...${NC}"
echo -e "${GREEN}当前执行任务: node ace ${COMMAND}${NC}"

while true
do
    echo -e "${YELLOW}--- 正在启动新一轮任务: ${COMMAND} ---${NC}"
    
    # 关键点：这里必须使用变量 $COMMAND，而不是硬编码的 webp:run
    node ace $COMMAND
    
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ 任务顺利结束。${NC}"
    else
        echo -e "\033[0;31m🚨 脚本异常退出 (Code: $EXIT_CODE)，5秒后重启...${NC}"
    fi

    echo "休息 5 秒..."
    sleep 5
done