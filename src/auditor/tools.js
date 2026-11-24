import { tool } from 'ai';
import { z } from 'zod';
import { createInterface } from 'node:readline/promises';
import { graphqlRequest, GraphQLClientError } from '../mcp/graphqlClient.js';

/** ObjectId de MongoDB: 24 caracteres hexadecimales. */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Quita las claves sin valor. Ojo con los valores falsy: `price: 0`,
 * `stock: 0` y `description: ''` son valores válidos y deben conservarse.
 */
function compact(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

const errorText = (message) => `ERROR: ${message}`;

function toErrorMessage(error) {
  if (error instanceof GraphQLClientError) {
    return `ERROR al llamar a la API GraphQL (${error.code}): ${error.message}`;
  }
  return `ERROR inesperado: ${error.message}`;
}

const GET_PRODUCTS_QUERY = /* GraphQL */ `
  query GetProducts($filter: ProductFilter) {
    products(filter: $filter) {
      id name price stock category description updatedAt
    }
  }
`;

const GET_PRODUCT_QUERY = /* GraphQL */ `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id name price stock category description updatedAt
    }
  }
`;

const UPDATE_PRODUCT_MUTATION = /* GraphQL */ `
  mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) {
      id name price stock category description updatedAt
    }
  }
`;

const FIELD_LABELS = {
  name: 'nombre',
  price: 'precio',
  stock: 'stock',
  category: 'categoría',
  description: 'descripción',
};

/**
 * La autorización se pide por consola justo antes de ejecutar la mutación.
 * El candado serializa los prompts: si el modelo llama dos veces a la
 * herramienta en el mismo paso, los dos pedidos no se pisan en stdin.
 */
let promptQueue = Promise.resolve();

function withAuthorizationLock(fn) {
  const next = promptQueue.then(fn, fn);
  promptQueue = next.catch(() => {});
  return next;
}

const APPROVED = new Set(['s', 'si', 'sí', 'y', 'yes']);

/**
 * Una única interfaz de readline para todo el proceso: crear y cerrar una por
 * prompt descarta las respuestas que ya estaban bufferizadas en stdin (y en un
 * pipeline no interactivo eso dejaba los pedidos siguientes sin leer).
 */
let rlInstance = null;

function getReadline() {
  if (!rlInstance) {
    rlInstance = createInterface({ input: process.stdin, output: process.stdout });
  }
  return rlInstance;
}

async function askForAuthorization(product, changes) {
  console.log('');
  console.log('  ── CAMBIO PROPUESTO ────────────────────────────────────');
  console.log(`  Producto: ${product.name} (${product.id})`);
  for (const [field, { from, to }] of Object.entries(changes)) {
    const label = FIELD_LABELS[field] ?? field;
    console.log(`    ${label}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`);
  }
  console.log('  ────────────────────────────────────────────────────────');

  const rl = getReadline();
  // Si stdin ya se cerró no hay de dónde leer: se niega por defecto (nunca se muta sin respuesta).
  if (rl.closed) return false;

  const answer = await new Promise((resolve) => {
    const onClose = () => resolve('');
    rl.once('close', onClose);
    rl.question('  ¿Autorizás este cambio? [s/N]: ', (value) => {
      rl.off('close', onClose);
      resolve(value);
    });
  });
  return APPROVED.has(answer.trim().toLowerCase());
}

/** Tool de solo lectura: lista productos con los mismos filtros que el MCP. */
const getProductsTool = tool({
  description:
    'Devuelve el listado de productos del catálogo. Sin argumentos devuelve todos los productos. ' +
    'Acepta filtros opcionales para acotar el resultado por categoría, texto, precio o stock, ' +
    'y puede ordenarlos y paginarlos.',
  inputSchema: z.object({
    category: z
      .string()
      .min(1)
      .max(60)
      .optional()
      .describe('Categoría exacta a filtrar (no distingue mayúsculas de minúsculas).'),
    search: z
      .string()
      .min(1)
      .optional()
      .describe('Búsqueda parcial de texto sobre el nombre y la descripción.'),
    minPrice: z.number().min(0).optional().describe('Precio mínimo incluido.'),
    maxPrice: z.number().min(0).optional().describe('Precio máximo incluido.'),
    minStock: z.number().int().min(0).optional().describe('Stock mínimo incluido.'),
    maxStock: z.number().int().min(0).optional().describe('Stock máximo incluido.'),
    inStock: z
      .boolean()
      .optional()
      .describe('true devuelve solo productos con stock, false solo los agotados.'),
    sortBy: z
      .enum(['NAME', 'PRICE', 'STOCK', 'CATEGORY', 'CREATED_AT'])
      .optional()
      .describe('Campo por el que se ordena el listado. Por defecto CREATED_AT.'),
    sortOrder: z
      .enum(['ASC', 'DESC'])
      .optional()
      .describe('Sentido del orden. Por defecto DESC.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(200)
      .optional()
      .describe('Cantidad máxima de productos a devolver (por defecto 50).'),
    offset: z.number().int().min(0).optional().describe('Cantidad de productos a omitir.'),
  }),

  async execute(args) {
    const filter = compact(args ?? {});
    try {
      const data = await graphqlRequest(GET_PRODUCTS_QUERY, { filter });
      const products = data.products;
      if (products.length === 0) {
        return Object.keys(filter).length > 0
          ? 'No se encontraron productos que coincidan con el filtro.'
          : 'El catálogo no tiene productos cargados.';
      }
      const lines = products.map((product) => {
        const header = `- [${product.id}] ${product.name}`;
        const details = `  precio: ${product.price} | stock: ${product.stock} | categoría: ${product.category}`;
        const description = product.description ? `\n  descripción: ${product.description}` : '';
        return `${header}\n${details}${description}`;
      });
      const total = products.length;
      return (
        `Se ${total === 1 ? 'encontró 1 producto' : `encontraron ${total} productos`}` +
        `${Object.keys(filter).length > 0 ? ' con el filtro aplicado' : ''}:\n\n${lines.join('\n')}`
      );
    } catch (error) {
      return toErrorMessage(error);
    }
  },
});

/**
 * Tool de escritura. Antes de tocar la API muestra el diff (valores actuales
 * vs propuestos) y pide autorización por consola. Sin autorización no hay
 * mutación: el modelo recibe un mensaje claro y debe respetar la decisión.
 */
const updateProductTool = tool({
  description:
    'Actualiza campos de un producto existente identificado por su id: nombre, precio, stock, ' +
    'categoría o descripción. Solo se modifican los campos enviados y los demás quedan intactos. ' +
    'PIDE AUTORIZACIÓN al usuario por consola antes de aplicar cualquier cambio: si el usuario ' +
    'la deniega, no se modifica nada. Devuelve el producto con los valores ya guardados.',
  inputSchema: z.object({
    id: z
      .string()
      .regex(OBJECT_ID, 'El id debe ser un ObjectId de MongoDB: 24 caracteres hexadecimales.')
      .describe('Id del producto a actualizar (el que devuelve get_products).'),
    name: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres.')
      .max(120, 'El nombre no puede superar los 120 caracteres.')
      .optional()
      .describe('Nuevo nombre del producto.'),
    price: z
      .number()
      .min(0, 'El precio no puede ser negativo.')
      .optional()
      .describe('Nuevo precio del producto.'),
    stock: z
      .number()
      .int('El stock debe ser un número entero.')
      .min(0, 'El stock no puede ser negativo.')
      .optional()
      .describe('Nuevo stock del producto.'),
    category: z
      .string()
      .min(1, 'La categoría no puede estar vacía.')
      .max(60, 'La categoría no puede superar los 60 caracteres.')
      .optional()
      .describe('Nueva categoría del producto.'),
    description: z
      .string()
      .max(1000, 'La descripción no puede superar los 1000 caracteres.')
      .optional()
      .describe('Nueva descripción del producto.'),
  }),

  async execute({ id, ...rawInput }) {
    const input = compact(rawInput);
    if (Object.keys(input).length === 0) {
      return errorText(
        'No indicaste ningún campo a actualizar. Enviá al menos uno de: name, price, stock, category o description.',
      );
    }

    return withAuthorizationLock(async () => {
      try {
        const current = (await graphqlRequest(GET_PRODUCT_QUERY, { id })).product;
        if (!current) {
          return errorText(
            `No existe un producto con el id "${id}". Usá get_products para ver los ids disponibles.`,
          );
        }

        const changes = Object.fromEntries(
          Object.entries(input)
            .filter(([field, value]) => current[field] !== value)
            .map(([field, value]) => [field, { from: current[field], to: value }]),
        );
        if (Object.keys(changes).length === 0) {
          return `El producto "${current.name}" (${id}) ya tiene exactamente esos valores: no hay nada que cambiar.`;
        }

        const authorized = await askForAuthorization(current, changes);
        if (!authorized) {
          console.log('  → Autorización denegada: no se modificó nada.');
          return errorText(
            `AUTORIZACIÓN DENEGADA por el usuario para el producto "${current.name}" (${id}). ` +
              'No se modificó nada y no debés volver a intentar este cambio. ' +
              'Mencioná el cambio en tu informe como "propuesto (no autorizado)".',
          );
        }

        const product = (await graphqlRequest(UPDATE_PRODUCT_MUTATION, { id, input })).updateProduct;
        const changed = Object.keys(changes).join(', ');
        console.log('  → Cambio aplicado.');
        return (
          `Producto "${product.name}" (${product.id}) actualizado con autorización del usuario. ` +
          `Campos modificados: ${changed}.\n` +
          `Valores actuales: nombre: ${product.name} | precio: ${product.price} | stock: ${product.stock} | ` +
          `categoría: ${product.category}`
        );
      } catch (error) {
        return toErrorMessage(error);
      }
    });
  },
});

export const auditorTools = {
  get_products: getProductsTool,
  update_product: updateProductTool,
};
