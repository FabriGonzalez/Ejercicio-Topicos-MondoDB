import http from 'node:http';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';

import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { typeDefs } from './graphql/typeDefs.js';
import { resolvers } from './graphql/resolvers.js';

const GRAPHQL_PATH = '/graphql';

function buildCorsOptions(origin) {
  if (origin === '*' || origin === 'true') return { origin: true };
  const allowed = origin.split(',').map((value) => value.trim()).filter(Boolean);
  return { origin: allowed };
}

await connectDatabase();
console.log(`[mongo] conectado a la base "${mongoose.connection.name}"`);

const app = express();
const httpServer = http.createServer(app);

const apollo = new ApolloServer({
  typeDefs,
  resolvers,
  // La introspección se habilita explícitamente para que funcione también con NODE_ENV=production
  // (en producción el servidor la deshabilita por defecto).
  introspection: true,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Apollo Sandbox embebido, disponible en /graphql tanto en local como en Render.
    ApolloServerPluginLandingPageLocalDefault({ embed: true, includeCookies: false }),
  ],
});

await apollo.start();

app.get('/', (_req, res) => res.redirect(GRAPHQL_PATH));

// Render usa este endpoint para los health checks.
app.get('/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    database: dbReady ? 'conectado' : 'desconectado',
  });
});

app.use(
  GRAPHQL_PATH,
  cors(buildCorsOptions(env.corsOrigin)),
  express.json({ limit: '1mb' }),
  expressMiddleware(apollo, { context: async () => ({}) }),
);

httpServer.listen(env.port, () => {
  console.log(`[server] entorno: ${env.nodeEnv}`);
  console.log(`[server] API GraphQL lista en http://localhost:${env.port}${GRAPHQL_PATH}`);
  console.log(`[server] Apollo Sandbox en  http://localhost:${env.port}${GRAPHQL_PATH}`);
});

async function shutdown(signal) {
  console.log(`\n[server] señal ${signal} recibida, cerrando conexiones...`);
  await apollo.stop();
  await disconnectDatabase();
  httpServer.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
