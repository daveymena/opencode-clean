# Skill: Preoperacional Nova

Integra el preoperacional diario de Nova dentro de OpenCode Evolved.

## Cómo funciona

El wrapper (`skill.js`) ejecuta `automation.js --now` del proyecto original.
El scheduler (`scheduler.js`) lo ejecuta automáticamente cada día a las 6:30 AM
hora de Bogotá.

## Montaje del proyecto original

Copia o monta el proyecto original en:

```
/app/skills/preoperacional-nova/src
```

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `PREOP_SKILL_SRC` | Ruta al proyecto original (default `/app/skills/preoperacional-nova/src`) |
| `PREOP_SKILL_DATA` | Ruta para datos persistentes |
| `PREOP_URL` | URL del formulario de Conectar TV |
| `PREOP_EMAIL` / `PREOP_PASSWORD` | Credenciales Nova 360 |
| `PREOP_SUPERVISOR` | Nombre del supervisor |
| `SMTP_*` | Configuración de correos |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Notificaciones Telegram |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta a Chromium (default `/usr/bin/chromium`) |
| `PREOP_SCHEDULE_HOUR` | Hora de ejecución (default 6) |
| `PREOP_SCHEDULE_MINUTE` | Minuto de ejecución (default 30) |

## Endpoints expuestos por Web Operator

- `POST /api/skills/preoperacional/run` — ejecutar preoperacional ahora
- `GET /api/skills/preoperacional/status` — estado del skill

## Scheduler

El scheduler se inicia automáticamente en `docker-start.sh`. También puedes
iniciarlo manualmente:

```bash
node skills/preoperacional-nova/scheduler.js
```

Para ejecutar inmediatamente una vez:

```bash
node skills/preoperacional-nova/scheduler.js --run-now
```

## Nota importante

El script original `automation.js` está hardcodeado para Windows/Chrome visible.
Para Docker:

1. Usar `headless: true`.
2. Usar `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
3. Leer credenciales desde variables de entorno.
4. Evitar rutas fijas de Windows.

Crea una copia adaptada en `src/` dentro de este skill si no puedes modificar
el original.
