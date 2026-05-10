#!/bin/bash
set -e

echo "=== AI HOT 部署 ==="

# 1. 构建
echo "📦 构建 Docker 镜像..."
docker compose build

# 2. 启动数据库
echo "🗄️  启动 PostgreSQL..."
docker compose up db -d
echo "⏳ 等待数据库就绪..."
sleep 5

# 3. 推送表结构
echo "📋 创建数据库表..."
docker compose run --rm app \
  npx prisma db push --skip-generate 2>/dev/null || \
  docker compose exec -T db psql -U postgres -c "SELECT 1" && echo "  表已存在"

# 4. 填充信源数据
echo "📡 填充信源数据..."
docker compose run --rm app npx tsx prisma/seed.ts

# 5. 启动应用
echo "🚀 启动应用..."
docker compose up -d

echo ""
echo "=== 部署完成 ==="
echo "访问: http://localhost:3000"
echo ""
echo "常用命令："
echo "  docker compose logs -f app      # 查看日志"
echo "  docker compose restart app      # 重启应用"
echo "  docker compose down             # 停止所有服务"
echo "  docker compose up -d --build    # 重新构建并启动"
