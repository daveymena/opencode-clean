FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Bogota
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y \
    ca-certificates curl wget \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libgbm1 libasound2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 libx11-6 libx11-xcb1 \
    libxcb1 libxext6 libxss1 libxtst6 libxcb-dri3-0 fonts-liberation \
    xvfb x11vnc novnc websockify \
    procps netcat-openbsd tzdata \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN echo '{"name":"app","private":true}' > /app/package.json && \
    rm -f /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/bun.lock

RUN npm install -g opencode-ai --ignore-scripts 2>/dev/null || true
RUN cd /usr/lib/node_modules/opencode-ai 2>/dev/null && node postinstall.mjs 2>/dev/null || \
    cd /usr/local/lib/node_modules/opencode-ai 2>/dev/null && node postinstall.mjs 2>/dev/null || true

RUN cd /app/web-operator && npm install
RUN cd /app/web-operator && npm install playwright --no-save

RUN cd /app/artifacts/opencode-ui && npm install

RUN mkdir -p /app/ui && cp /app/artifacts/opencode-ui/ui/index.html /app/ui/index.html

RUN npx playwright install chromium --with-deps 2>/dev/null || true

RUN chmod +x /app/docker-start.sh

EXPOSE 3000 3001 21294 6080

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -sf http://localhost:3000/__health || exit 1

CMD ["/app/docker-start.sh"]
