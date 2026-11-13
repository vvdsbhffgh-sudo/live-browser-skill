FROM node:22-bookworm-slim

# Playwright Chromium dependencies (Debian slim)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    libx11-6 libxcb1 libxext6 libxi6 libxtst6 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
RUN npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium

ENV LIVE_BROWSER_PORT=3100
ENV LIVE_BROWSER_PROFILE=/data/profile
ENV LIVE_BROWSER_HEADED=0
EXPOSE 3100
CMD ["node", "server/index.js", "--http"]
