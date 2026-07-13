// ============================================================
// MiMoCode Bridge Server
// Puente entre MiMoCode (cerebro) y PC Agent (manos)
// Permite a MiMoCode ver y controlar la PC en tiempo real
// ============================================================

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT = parseInt(process.env.BRIDGE_PORT || '21295');
const AGENT_SERVER = process.env.AGENT_SERVER_URL || 'ws://localhost:21291/agent';

// ─── State ───────────────────────────────────────────────────────
let pcAgent = null;
let mimoConnection = null;
const pendingCommands = new Map();
const commandHistory = [];
const TASK_FILE = path.join(os.homedir(), '.opencode-agent', 'current-task.json');

// ─── WebSocket Server for MiMoCode ──────────────────────────────
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('[bridge] MiMoCode conectado');
  mimoConnection = ws;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // MiMoCode sends command to execute on PC
      if (msg.type === 'command') {
        const result = await executeOnPC(msg.cmd, msg.timeout);
        ws.send(JSON.stringify({ type: 'result', id: msg.id, result }));
      }

      // MiMoCode requests screenshot
      if (msg.type === 'screenshot') {
        const result = await executeOnPC({ type: 'screenshot' });
        ws.send(JSON.stringify({ type: 'screenshot', id: msg.id, data: result }));
      }

      // MiMoCode sends autonomous task
      if (msg.type === 'task') {
        ws.send(JSON.stringify({ type: 'task_ack', id: msg.id }));
        executeAutonomousTask(msg.task, ws).catch(err => {
          console.error('[bridge] Task error:', err.message);
        });
      }

    } catch (err) {
      console.error('[bridge] Error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[bridge] MiMoCode desconectado');
    mimoConnection = null;
  });

  // Send current state
  ws.send(JSON.stringify({
    type: 'connected',
    agentConnected: !!pcAgent,
    agentId: pcAgent?.id || null,
    agentName: pcAgent?.name || null,
  }));
});

// ─── Connect to PC Agent via agent-server ────────────────────────
let agentWs = null;

function connectToAgent() {
  try {
    agentWs = new WebSocket(AGENT_SERVER, {
      headers: { 'x-agent-name': 'mimocode-bridge', 'x-agent-id': 'mimocode' }
    });

    agentWs.on('open', () => {
      console.log('[bridge] Conectado a PC Agent');
      agentWs.send(JSON.stringify({
        type: 'register',
        agentName: 'mimocode-bridge',
        agentId: 'mimocode',
        sysinfo: { hostname: os.hostname(), platform: os.platform() }
      }));
    });

    agentWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'registered') {
          pcAgent = { id: msg.agentId, connected: true };
          console.log(`[bridge] PC Agent registrado: ${msg.agentId}`);
          // Notify MiMoCode
          if (mimoConnection?.readyState === 1) {
            mimoConnection.send(JSON.stringify({ type: 'agent_connected', agent: pcAgent }));
          }
        }

        if (msg.type === 'result' && msg.requestId) {
          const pending = pendingCommands.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.result);
            pendingCommands.delete(msg.requestId);
          }
        }
      } catch {}
    });

    agentWs.on('close', () => {
      pcAgent = null;
      console.log('[bridge] PC Agent desconectado. Reconectando en 5s...');
      setTimeout(connectToAgent, 5000);
    });

    agentWs.on('error', (err) => {
      console.error('[bridge] Error agent:', err.message);
    });

  } catch (err) {
    console.error('[bridge] No se pudo conectar:', err.message);
    setTimeout(connectToAgent, 5000);
  }
}

// ─── Execute command on PC ───────────────────────────────────────
function executeOnPC(cmd, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!agentWs || agentWs.readyState !== 1) {
      return reject(new Error('PC Agent no conectado'));
    }
    const requestId = randomUUID();
    const timer = setTimeout(() => {
      pendingCommands.delete(requestId);
      reject(new Error('Timeout'));
    }, timeoutMs);

    pendingCommands.set(requestId, {
      resolve: (result) => { clearTimeout(timer); resolve(result); }
    });

    agentWs.send(JSON.stringify({ type: 'command', requestId, cmd }));
  });
}

// ─── Autonomous Task Execution ──────────────────────────────────
async function executeAutonomousTask(task, ws) {
  const steps = [];
  let stepCount = 0;
  const MAX_STEPS = 20;

  // Save current task
  fs.mkdirSync(path.dirname(TASK_FILE), { recursive: true });
  fs.writeFileSync(TASK_FILE, JSON.stringify({ task, startedAt: new Date().toISOString(), steps }));

  console.log(`[bridge] Iniciando tarea: ${task}`);

  while (stepCount < MAX_STEPS) {
    stepCount++;

    // 1. Take screenshot
    let screenshot;
    try {
      screenshot = await executeOnPC({ type: 'screenshot' });
    } catch (e) {
      steps.push({ step: stepCount, action: 'screenshot', error: e.message });
      break;
    }

    // 2. Send to MiMoCode for analysis
    if (ws?.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'task_step',
        step: stepCount,
        screenshot: screenshot?.base64,
        task,
        history: steps.slice(-5)
      }));
    }

    // 3. Wait for MiMoCode's instruction (with timeout)
    const instruction = await waitForInstruction(60000);
    if (!instruction) {
      steps.push({ step: stepCount, action: 'timeout', message: 'Sin instrucción de MiMoCode' });
      break;
    }

    if (instruction.action === 'done') {
      steps.push({ step: stepCount, action: 'done', message: 'Tarea completada' });
      break;
    }

    if (instruction.action === 'abort') {
      steps.push({ step: stepCount, action: 'aborted', message: instruction.reason });
      break;
    }

    // 4. Execute the instruction
    try {
      const result = await executeOnPC(instruction.cmd);
      steps.push({ step: stepCount, action: instruction.cmd.type, result });
      console.log(`[bridge] Step ${stepCount}: ${instruction.cmd.type} → ${result?.ok ? 'OK' : 'FAIL'}`);

      // Brief pause between actions
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      steps.push({ step: stepCount, action: instruction.cmd.type, error: e.message });
    }
  }

  // Save final state
  fs.writeFileSync(TASK_FILE, JSON.stringify({ task, completedAt: new Date().toISOString(), steps }));

  if (ws?.readyState === 1) {
    ws.send(JSON.stringify({ type: 'task_complete', task, steps, totalSteps: stepCount }));
  }

  console.log(`[bridge] Tarea completada: ${task} (${stepCount} pasos)`);
}

// ─── Wait for instruction from MiMoCode ─────────────────────────
let pendingInstruction = null;
let instructionResolve = null;

function waitForInstruction(timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingInstruction = null;
      instructionResolve = null;
      resolve(null);
    }, timeoutMs);

    pendingInstruction = { resolve: (inst) => { clearTimeout(timer); resolve(inst); } };
    instructionResolve = pendingInstruction.resolve;
  });
}

// HTTP API for MiMoCode to send instructions
const apiServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Status
  if (url.pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      agentConnected: !!pcAgent,
      agent: pcAgent,
      hasTask: !!pendingInstruction,
      historyCount: commandHistory.length
    }));
    return;
  }

  // Quick command (fire and forget)
  if (url.pathname === '/cmd' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const cmd = JSON.parse(body);
        const result = await executeOnPC(cmd);
        commandHistory.push({ cmd, result, time: new Date().toISOString() });
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Send instruction to running task
  if (url.pathname === '/instruction' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const instruction = JSON.parse(body);
        if (instructionResolve) {
          instructionResolve(instruction);
          instructionResolve = null;
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No hay tarea esperando instrucción' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Screenshot
  if (url.pathname === '/screenshot') {
    executeOnPC({ type: 'screenshot' })
      .then(result => res.writeHead(200) || res.end(JSON.stringify(result)))
      .catch(e => res.writeHead(500).end(JSON.stringify({ error: e.message })));
    return;
  }

  // History
  if (url.pathname === '/history') {
    res.writeHead(200);
    res.end(JSON.stringify({ history: commandHistory.slice(-50) }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ─── Start ───────────────────────────────────────────────────────
const server = http.createServer();
server.on('upgrade', (req, socket, head) => {
  if (req.url === '/mimo') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         MiMoCode Bridge Server                  ║
║         Puente cerebro ↔ manos                  ║
╠══════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:${PORT}/mimo           ║
║  HTTP API:  http://localhost:${PORT}/status        ║
║  Agent:     ${AGENT_SERVER.padEnd(34)}║
╚══════════════════════════════════════════════════╝
  `);
  connectToAgent();
});

process.on('SIGINT', () => {
  console.log('\n[bridge] Deteniendo...');
  if (agentWs) agentWs.close();
  server.close();
  process.exit(0);
});
