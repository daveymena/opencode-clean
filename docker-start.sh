#!/bin/bash
set +e

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     OpenCode Evolved — Iniciando en Docker   ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

echo "[1/5] Iniciando pantalla virtual (Xvfb)..."
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp &
sleep 2
echo "  → Xvfb listo"

echo "[2/5] Iniciando VNC + noVNC..."
x11vnc -display :99 -nopw -listen localhost -xkb -forever -quiet 2>/dev/null &
sleep 1
websockify --web=/usr/share/novnc/ 0.0.0.0:6080 localhost:5900 >/dev/null 2>&1 &
sleep 1
echo "  → VNC listo en :5900, noVNC en :6080"

echo "[3/5] Iniciando OpenCode Engine..."
OPENCODE_PORT=${OPENCODE_PORT:-21294}

if command -v opencode >/dev/null 2>&1; then
  opencode serve --port $OPENCODE_PORT &
  echo "  → Esperando OpenCode en :$OPENCODE_PORT..."
  for i in $(seq 1 30); do
    if nc -z localhost $OPENCODE_PORT 2>/dev/null; then
      echo "  → OpenCode Engine listo"
      break
    fi
    sleep 1
  done
else
  echo "  ⚠  OpenCode no encontrado — saltando engine"
fi

# Cambiamos el puerto del Web Operator API para evitar conflicto con el Proxy (3000)
# Usaremos 3005 para la API del Operador
OPERATOR_API_PORT=3005
export OPERATOR_PORT=${OPERATOR_PORT:-3001}
export API_SERVER_PORT=$OPERATOR_API_PORT

echo "[4/5] Iniciando Web Operator..."
cd /app/web-operator
node api-server.js &
WEB_PID=$!
sleep 3
if kill -0 $WEB_PID 2>/dev/null; then
  echo "  → Web Operator listo en :3001"
else
  echo "  ⚠  Web Operator falló al iniciar (ver logs)"
fi

echo "[5/5] Iniciando Proxy Web UI..."
cd /app/artifacts/opencode-ui
export PORT=${PORT:-3000}
export OPENCODE_PORT=${OPENCODE_PORT:-21294}
export OPERATOR_PORT=${OPERATOR_PORT:-3001}
export API_SERVER_PORT=${OPERATOR_PORT:-3001}
node proxy.mjs &
PROXY_PID=$!
sleep 2
if kill -0 $PROXY_PID 2>/dev/null; then
  echo "  → Proxy listo en :${PORT}"
else
  echo "  ⚠  Proxy falló al iniciar (ver logs)"
fi

cd /app

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║          TODO LISTO EN EASYPANEL             ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

wait
