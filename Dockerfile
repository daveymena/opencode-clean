FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Bogota
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer"

# Chromium + system deps para Playwright + Xvfb/VNC
RUN apt-get update && apt-get install -y \
    ca-certificates curl wget gnupg \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libgbm1 libasound2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 libx11-6 libx11-xcb1 \
    libxcb1 libxext6 libxss1 libxtst6 libxcb-dri3-0 \
    fonts-liberation fonts-freefont-ttf \
    xvfb x11vnc novnc python3-netifaces \
    procps netcat-openbsd tzdata \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Root package.json mínimo (sirve como contenedor, no instala nada)
RUN echo '{"name":"opencode-platform","private":true,"version":"1.0.0"}' > package.json

# Instalar opencode-ai CLI globalmente
RUN npm install -g opencode-ai --ignore-scripts 2>/dev/null || true

# Ejecutar postinstall de opencode-ai (instala Playwright + Chromium)
RUN node -e "const p=['/usr/lib/node_modules/opencode-ai','/usr/local/lib/node_modules/opencode-ai'].find(p=>require('fs').existsSync(p+'/postinstall.mjs'));if(p)require('child_process').execSync('node postinstall.mjs',{cwd:p,stdio:'inherit',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:'/ms-playwright'}})" 2>/dev/null || true

# Instalar Chromium explícitamente si postinstall falló
RUN npx playwright install chromium --with-deps 2>/dev/null || true

COPY web-operator/package.json web-operator/
RUN cd web-operator && npm install

COPY artifacts/opencode-ui/package.json artifacts/opencode-ui/
RUN cd artifacts/opencode-ui && npm install

COPY . .

RUN mkdir -p /app/ui && cp /app/artifacts/opencode-ui/ui/index.html /app/ui/index.html 2>/dev/null || true

RUN rm -f /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/bun.lock

RUN chmod +x /app/docker-start.sh

EXPOSE 3000 3001 21294 6080

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -sf http://localhost:3000/__health || exit 1

CMD ["/app/docker-start.sh"]
