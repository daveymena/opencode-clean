// ============================================================
// Scheduler: Preoperacional Nova diario
// Ejecuta el preoperacional automáticamente cada día a las 6:30 AM
// hora de Bogotá (America/Bogota).
// ============================================================

import { runDaily, getStatus } from './skill.js';

const HOUR = parseInt(process.env.PREOP_SCHEDULE_HOUR ?? '6');
const MINUTE = parseInt(process.env.PREOP_SCHEDULE_MINUTE ?? '30');
const TIMEZONE = process.env.TZ || 'America/Bogota';

function log(...args) {
  console.log('[preop-scheduler]', ...args);
}

function getBogotaNow() {
  const d = new Date();
  return new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

async function tick() {
  const now = getBogotaNow();
  if (now.getHours() === HOUR && now.getMinutes() === MINUTE) {
    log(`Hora de ejecución: ${now.toISOString()}`);
    try {
      const result = await runDaily();
      log('Ejecución exitosa:', result.message);
    } catch (err) {
      log('Error en ejecución:', err.message);
    }
    // Esperar 60s para no volver a ejecutar en el mismo minuto
    await new Promise(r => setTimeout(r, 60000));
  }
}

async function main() {
  log('Scheduler iniciado');
  log('Estado del skill:', getStatus());
  log(`Programado para las ${HOUR.toString().padStart(2, '0')}:${MINUTE.toString().padStart(2, '0')} ${TIMEZONE}`);

  // Ejecutar inmediatamente si se pasa --run-now
  if (process.argv.includes('--run-now')) {
    try {
      log('Ejecutando ahora por flag --run-now');
      const result = await runDaily();
      log('Resultado:', result.message);
    } catch (err) {
      log('Error:', err.message);
    }
  }

  setInterval(tick, 30000);
}

main().catch(err => { log('Fatal:', err.message); process.exit(1); });
