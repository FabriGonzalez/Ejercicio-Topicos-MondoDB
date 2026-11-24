import dotenv from 'dotenv';

// Imprescindible: dotenv escribe un aviso en stdout y stdout es el canal del protocolo MCP.
// Un solo carácter extra en stdout rompe la comunicación con el cliente.
dotenv.config({ quiet: true });

const DEFAULT_GRAPHQL_URL = 'https://ejercicio-topicos-mondodb.onrender.com/graphql';

// Render en plan free hiberna el servicio cuando no hay tráfico, así que el primer
// request puede tardar más de 30 s. El timeout por defecto es holgado a propósito.
const DEFAULT_TIMEOUT_MS = 60_000;

export const config = {
  graphqlUrl: process.env.GRAPHQL_URL?.trim() || DEFAULT_GRAPHQL_URL,
  timeoutMs: Number(process.env.GRAPHQL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
};

export { DEFAULT_GRAPHQL_URL, DEFAULT_TIMEOUT_MS };
