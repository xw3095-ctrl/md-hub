#!/bin/bash
# MD Hub 一键部署脚本
# 使用方法: bash deploy.sh

set -e

echo "🚀 MD Hub 部署脚本"
echo "==================="

# 检查 vercel 是否可用
if ! command -v npx &> /dev/null; then
  echo "❌ 需要 Node.js 和 npx，请先安装"
  exit 1
fi

echo ""
echo "📦 项目路径: $(pwd)"
echo ""

# 检查是否已登录
if npx vercel whoami &> /dev/null; then
  echo "🔑 Vercel 已登录，开始部署..."
  npx vercel deploy --prod --yes
else
  echo "🔑 需要登录 Vercel"
  echo ""
  echo "请打开终端，运行以下命令："
  echo ""
  echo "  cd $(pwd)"
  echo "  npx vercel login"
  echo "  npx vercel deploy --prod --yes"
  echo ""
fi
