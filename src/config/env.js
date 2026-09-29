import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_DATABASE = 'productos';

/**
 * Inserta el nombre de la base de datos en la URI cuando no viene definido.
 * Atlas suele entregar URIs del tipo "mongodb+srv://user:pass@cluster.net/?appName=X",
 * y sin nombre Mongoose usaría la base "test".
 */
function withDatabaseName(uri, dbName) {
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(\/[^?]*)?(\?.*)?$/i);
  if (!match) return uri;

  const [, authority, path = '/', query = ''] = match;
  const current = path.slice(1);

  return `${authority}/${current || encodeURIComponent(dbName)}${query}`;
}

function resolveMongoUri(env) {
  if (env.MONGODB_URI?.trim()) {
    return withDatabaseName(env.MONGODB_URI.trim(), env.MONGODB_DATABASE || DEFAULT_DATABASE);
  }

  const { MONGODB_USERNAME, MONGODB_PASSWORD, MONGODB_HOST } = env;
  if (!MONGODB_USERNAME || !MONGODB_PASSWORD || !MONGODB_HOST) {
    throw new Error(
      'Falta la configuración de MongoDB. Definí MONGODB_URI o bien MONGODB_USERNAME, MONGODB_PASSWORD y MONGODB_HOST en el archivo .env',
    );
  }

  const user = encodeURIComponent(MONGODB_USERNAME);
  const password = encodeURIComponent(MONGODB_PASSWORD);
  const database = encodeURIComponent(env.MONGODB_DATABASE || DEFAULT_DATABASE);

  return `mongodb+srv://${user}:${password}@${MONGODB_HOST}/${database}`;
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  get isProd() {
    return this.nodeEnv === 'production';
  },
  port: Number(process.env.PORT) || 4000,
  mongoUri: resolveMongoUri(process.env),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export { resolveMongoUri, withDatabaseName };
