#!/bin/bash

# 处理 SEO 任务的函数
# run_seo() {
#     while true; do
#         echo "[SEO] --- 开始新一轮处理 ---"
#         node ace ai:seo 
#         echo "[SEO] --- 处理完成，休息 30 秒 ---"
#         sleep 30
#     done
# }

# 处理 GEO 任务的函数
run_webp() {
    while true; do
        echo "[GEO] --- 开始新一轮处理 ---"
        node ace webp:run 
        echo "[GEO] --- 处理完成，休息 30 秒 ---"
        sleep 30
    done
}

# 同时在后台启动两个任务
# run_seo &
run_webp &

# 保持主进程不退出，否则容器会关闭
wait