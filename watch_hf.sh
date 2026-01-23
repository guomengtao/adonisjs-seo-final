#!/bin/bash

# 处理 SEO 任务的函数
run_summary() {
    while true; do
        echo "[SUM] --- 开始新一轮处理 ---"
        # node ace ai:seo 
        node ace gemini:summary 
        echo "[SUM] --- 处理完成，休息 31 秒 ---"
        sleep 31
    done
}

# 处理 GEO 任务的函数
run_webp() {
    # while true; do
        echo "[WEBP] --- 开始新一轮处理 ---"
        node ace webp:cf
        echo "[WEBP] --- 处理完成，休息 662 秒 ---"
        # sleep 30
    # done
}


# 处理 TAG 任务的函数
run_tag() {
    while true; do
        echo "[TAG] --- 开始新一轮处理 ---"
        node ace gemini:tags 
        echo "[TAG] --- 处理完成，休息 20 秒 ---"
        sleep 20
    done
}
# 同时在后台启动两个任务
run_summary &
run_webp &
run_tag &

# 保持主进程不退出，否则容器会关闭
wait