#!/bin/bash

# 1. 参数获取与默认值设置
# $1 为第一个参数（项目名），默认为 webp:run
# $2 为第二个参数（循环次数），默认为 2
COMMAND=${1:-"webp:run"}
MAX_RUNS=${2:-2}

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 启动自动化守护程序...${NC}"
echo -e "${BLUE}配置信息: 任务名[${COMMAND}] | 计划循环[${MAX_RUNS}]次${NC}"

# 计数器
COUNT=1

# 2. 将 true 改为条件判断：当 COUNT 小于等于 MAX_RUNS 时循环
while [ $COUNT -le $MAX_RUNS ]
do
    echo -e "${YELLOW}--- [第 $COUNT / $MAX_RUNS 轮] 启动任务: ${COMMAND} ---${NC}"
    
    # 执行任务
    node ace $COMMAND
    
    EXIT_CODE=$?
    
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}✅ 第 $COUNT 轮顺利结束。${NC}"
    else
        echo -e "\033[0;31m🚨 第 $COUNT 轮异常退出 (Code: $EXIT_CODE)${NC}"
    fi

    # 计数器自增
    ((COUNT++))

    # 如果还没跑完，就休息一下
    if [ $COUNT -le $MAX_RUNS ]; then
        echo "休息 5 秒后继续..."
        sleep 5
    fi
done

echo -e "${GREEN}🏁 所有任务已完成，共执行 $MAX_RUNS 轮。${NC}"