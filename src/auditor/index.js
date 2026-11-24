import { config } from './config.js';
import { runAudit } from './audit.js';

function printBanner() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' Auditor del catálogo de productos — Gemini + Vercel AI SDK');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(` Modelo:    ${config.model}`);
  console.log(` API:       ${config.graphqlUrl}`);
  console.log(` Pasos máx: ${config.maxSteps}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('El agente va a leer el catálogo, explicar sus hallazgos y, si detecta');
  console.log('problemas seguros de corregir, te va a pedir autorización por consola');
  console.log('antes de modificar cada producto.');
}

function argsPreview(args) {
  const json = JSON.stringify(args ?? {});
  return json.length > 90 ? `${json.slice(0, 87)}...` : json;
}

function logStep({ stepNumber, toolCalls, text }) {
  if (toolCalls.length > 0) {
    for (const call of toolCalls) {
      console.log(`  [paso ${stepNumber}] ${call.toolName}(${argsPreview(call.input)})`);
    }
  } else if (text.trim()) {
    const preview = text.trim().split('\n')[0].slice(0, 100);
    console.log(`  [paso ${stepNumber}] el modelo escribe: ${preview}`);
  }
}

async function main() {
  printBanner();

  if (!config.apiKey) {
    console.error('');
    console.error('Falta GOOGLE_GENERATIVE_AI_API_KEY.');
    console.error('Creá una clave en https://aistudio.google.com/apikey y agregá en .env:');
    console.error('  GOOGLE_GENERATIVE_AI_API_KEY="tu-clave"');
    process.exit(1);
  }

  console.log('');
  console.log('▶ Auditando el catálogo... (los cambios te van a consultar por consola)');
  console.log('');

  const startedAt = Date.now();
  const result = await runAudit({ onStep: logStep });

  console.log('');
  console.log('─────────────────── INFORME DEL AGENTE ───────────────────');
  console.log(result.text);
  console.log('───────────────────────────────────────────────────────────');

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log('');
  console.log(
    `Fin en ${seconds}s · pasos: ${result.steps.length} · tokens: ${result.usage.totalTokens ?? 'n/d'}`,
  );
}

main().catch((error) => {
  console.error('');
  console.error('La auditoría falló:');
  console.error(`  ${error.message}`);
  if (error.message.includes('API key') || error.message.includes('API_KEY')) {
    console.error('Revisá GOOGLE_GENERATIVE_AI_API_KEY en .env.');
  }
  if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
    console.error('Revisá tu conexión o GRAPHQL_URL en .env.');
  }
  process.exit(1);
});
