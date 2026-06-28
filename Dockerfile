FROM oven/bun:1.3-slim AS base
WORKDIR /app

# Зависимости отдельным слоем — кешируются при изменении только кода
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

COPY src/ ./src/

ENV NODE_ENV=production

CMD ["bun", "run", "src/bot.ts"]
