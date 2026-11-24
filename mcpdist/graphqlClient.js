import { config } from './config.js';

/** Error de negocio o de transporte hablando con la API GraphQL. */
export class GraphQLClientError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'GraphQLClientError';
    this.code = code ?? 'GRAPHQL_CLIENT_ERROR';
    this.status = status;
  }
}

/**
 * Ejecuta una operación contra la API GraphQL.
 * Traduce los fallos de red, HTTP y de GraphQL a GraphQLClientError con un mensaje accionable.
 */
export async function graphqlRequest(query, variables = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response;
  try {
    response = await fetch(config.graphqlUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new GraphQLClientError(
        `El servidor GraphQL no respondió en ${config.timeoutMs / 1000}s. ` +
          'Si es la primera llamada, el servicio de Render puede estar despertando: reintentá en unos segundos.',
        { code: 'TIMEOUT' },
      );
    }
    throw new GraphQLClientError(
      `No se pudo conectar con ${config.graphqlUrl}: ${error.message}`,
      { code: 'NETWORK_ERROR' },
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new GraphQLClientError(
      `El servidor GraphQL respondió ${response.status} ${response.statusText}.`,
      { code: 'HTTP_ERROR', status: response.status },
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new GraphQLClientError('La respuesta del servidor GraphQL no es JSON válido.', {
      code: 'INVALID_RESPONSE',
    });
  }

  if (body.errors?.length) {
    const messages = body.errors.map((error) => error.message).join(' | ');
    const code = body.errors.find((error) => error.extensions?.code)?.extensions?.code;
    throw new GraphQLClientError(messages, { code: code ?? 'GRAPHQL_ERROR' });
  }

  return body.data;
}
