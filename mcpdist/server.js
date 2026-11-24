import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { config } from './config.js';
import { tools } from './tools.js';

const server = new McpServer({
  name: 'productos-mcp',
  version: '1.0.0',
});

for (const tool of tools) {
  server.registerTool(tool.name, tool.config, tool.handler);
}

// Todo log va a stderr: stdout está reservado para los mensajes JSON-RPC del protocolo.
console.error(`[productos-mcp] servidor listo -> ${config.graphqlUrl} (timeout ${config.timeoutMs} ms)`);

const transport = new StdioServerTransport();
await server.connect(transport);

async function shutdown(signal) {
  console.error(`[productos-mcp] ${signal} recibido, cerrando...`);
  await server.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
