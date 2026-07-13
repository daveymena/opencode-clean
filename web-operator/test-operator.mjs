/**
 * Test Operator Engine - Prueba rápida
 */

import { OperatorEngine } from './operator-engine.js';

async function main() {
  const engine = new OperatorEngine();
  
  await engine.launch();
  
  const result = await engine.runTask(
    'Go to Facebook and login',
    'https://www.facebook.com'
  );
  
  console.log('\nResult:', result);
  
  // Keep browser open
  await new Promise(() => {});
}

main().catch(console.error);
