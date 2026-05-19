# ビルドステージ
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production=false

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# 本番ステージ
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# 本番依存のみインストール
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ビルド成果物をコピー
COPY --from=builder /app/dist ./dist

# 自動投稿用テンプレートをイメージに同梱（X投稿管理画面と post_to_x.js の参照元）
COPY data/ ./data/

# 非rootユーザーで実行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
