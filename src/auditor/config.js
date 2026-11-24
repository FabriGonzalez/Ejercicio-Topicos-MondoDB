import dotenv from 'dotenv';

// quiet: true para que dotenv no escriba nada en stdout (la CLI lee stdin/stdout interactivamente).
dotenv.config({ quiet: true });

const DEFAULT_GRAPHQL_URL = 'https://ejercicio-topicos-mondodb.onrender.com/graphql';

// Render en plan free hiberna el servicio: el primer request puede tardar más de 30 s.
const DEFAULT_TIMEOUT_MS = 60_000;

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

// Tope de pasos (llamadas al modelo) por auditoría, para que el loop no se dispare.
const DEFAULT_MAX_STEPS = 40;

export const config = {
  /** API key de Google AI Studio (https://aistudio.google.com/apikey). */
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || undefined,
  graphqlUrl: process.env.GRAPHQL_URL?.trim() || DEFAULT_GRAPHQL_URL,
  timeoutMs: Number(process.env.GRAPHQL_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  model: process.env.AUDITOR_MODEL?.trim() || DEFAULT_MODEL,
  maxSteps: Number(process.env.AUDITOR_MAX_STEPS) || DEFAULT_MAX_STEPS,
};

export { DEFAULT_GRAPHQL_URL, DEFAULT_TIMEOUT_MS, DEFAULT_MODEL, DEFAULT_MAX_STEPS };
