# 使用 Node.js 20 作为基础镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装所有依赖（包括开发依赖）
RUN npm ci

# 复制项目源代码
COPY . .

# 编译 TypeScript 代码
RUN npm run build

# 切换到构建后的目录
WORKDIR /app/build

# 只安装生产环境依赖
RUN npm ci --omit="dev"

# 暴露端口（AdonisJS 默认使用 3333 端口）
EXPOSE 3333 7860

# 启动服务器（这是容器真正运行的命令）
CMD ["node", "bin/server.js"]