import { z } from 'zod';
import { graphqlRequest, GraphQLClientError } from './graphqlClient.js';

/** ObjectId de MongoDB: 24 caracteres hexadecimales. */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Quita las claves sin valor. Ojo con los valores falsy: `inStock: false`,
 * `offset: 0` y `price: 0` son filtros válidos y deben conservarse.
 */
function compact(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function errorResult(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const textResult = (text) => ({ content: [{ type: 'text', text }] });

const GET_PRODUCTS_QUERY = /* GraphQL */ `
  query GetProducts($filter: ProductFilter) {
    products(filter: $filter) {
      id
      name
      price
      stock
      category
      description
      updatedAt
    }
  }
`;

const UPDATE_PRODUCT_MUTATION = /* GraphQL */ `
  mutation UpdateProduct($id: ID!, $input: UpdateProductInput!) {
    updateProduct(id: $id, input: $input) {
      id
      name
      price
      stock
      category
      description
      updatedAt
    }
  }
`;

export const getProductsTool = {
  name: 'get_products',
  config: {
    title: 'Listar productos',
    description:
      'Devuelve el listado de productos del catálogo. Sin argumentos devuelve todos los productos. ' +
      'Acepta filtros opcionales para acotar el resultado por categoría, texto, precio o stock, ' +
      'y puede ordenarlos y paginarlos.',
    inputSchema: {
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
      sortOrder: z.enum(['ASC', 'DESC']).optional().describe('Sentido del orden. Por defecto DESC.'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('Cantidad máxima de productos a devolver (por defecto 50).'),
      offset: z.number().int().min(0).optional().describe('Cantidad de productos a omitir.'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },

  async handler(args) {
    const filter = compact(args ?? {});

    try {
      const data = await graphqlRequest(GET_PRODUCTS_QUERY, { filter });
      const products = data.products;

      if (products.length === 0) {
        return textResult(
          Object.keys(filter).length > 0
            ? 'No se encontraron productos que coincidan con el filtro.'
            : 'El catálogo no tiene productos cargados.',
        );
      }

      const lines = products.map((product) => {
        const header = `- [${product.id}] ${product.name}`;
        const details = `  precio: ${product.price} | stock: ${product.stock} | categoría: ${product.category}`;
        const description = product.description ? `\n  descripción: ${product.description}` : '';
        return `${header}\n${details}${description}`;
      });

      const total = products.length;
      const resumen = `Se ${total === 1 ? 'encontró 1 producto' : `encontraron ${total} productos`}${
        Object.keys(filter).length > 0 ? ' con el filtro aplicado' : ''
      }:\n\n${lines.join('\n')}`;

      return textResult(resumen);
    } catch (error) {
      return toErrorResult(error);
    }
  },
};

export const updateProductTool = {
  name: 'update_product',
  config: {
    title: 'Actualizar producto',
    description:
      'Actualiza el precio, el stock o la categoría de un producto existente, identificado por su id. ' +
      'Solo se modifican los campos enviados y los demás quedan intactos. ' +
      'Devuelve el producto con los valores ya guardados.',
    inputSchema: {
      id: z
        .string()
        .regex(OBJECT_ID, 'El id debe ser un ObjectId de MongoDB: 24 caracteres hexadecimales.')
        .describe('Id del producto a actualizar (el que devuelve get_products).'),
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
        .max(60)
        .optional()
        .describe('Nueva categoría del producto.'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },

  async handler({ id, price, stock, category }) {
    const input = compact({ price, stock, category });

    if (Object.keys(input).length === 0) {
      return errorResult(
        'No indicaste ningún campo a actualizar. Enviá al menos uno de: price, stock o category.',
      );
    }

    try {
      const data = await graphqlRequest(UPDATE_PRODUCT_MUTATION, { id, input });
      const product = data.updateProduct;
      const changed = Object.keys(input)
        .map((field) => ({ price: 'price', stock: 'stock', category: 'category' })[field])
        .join(', ');

      return textResult(
        `Producto "${product.name}" (${product.id}) actualizado. Campos modificados: ${changed}.\n\n` +
          `Valores actuales: precio: ${product.price} | stock: ${product.stock} | categoría: ${product.category}`,
      );
    } catch (error) {
      if (error instanceof GraphQLClientError && error.code === 'NOT_FOUND') {
        return errorResult(
          `No existe un producto con el id "${id}". Usá get_products para ver los ids disponibles.`,
        );
      }
      return toErrorResult(error);
    }
  },
};

function toErrorResult(error) {
  if (error instanceof GraphQLClientError) {
    return errorResult(`Error al llamar a la API GraphQL (${error.code}): ${error.message}`);
  }
  return errorResult(`Error inesperado: ${error.message}`);
}

export const tools = [getProductsTool, updateProductTool];
