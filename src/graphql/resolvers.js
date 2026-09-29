import { GraphQLError } from 'graphql';
import { isValidObjectId } from 'mongoose';
import { Product } from '../models/Product.js';

const SORT_FIELDS = {
  NAME: 'name',
  PRICE: 'price',
  STOCK: 'stock',
  CATEGORY: 'category',
  CREATED_AT: 'createdAt',
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const badInput = (message, field) =>
  new GraphQLError(message, {
    extensions: { code: 'BAD_USER_INPUT', ...(field && { field }) },
  });

const notFound = (message) =>
  new GraphQLError(message, { extensions: { code: 'NOT_FOUND' } });

function assertObjectId(id) {
  if (!isValidObjectId(id)) {
    throw badInput(`"${id}" no es un id válido de MongoDB (ObjectId de 24 caracteres hexadecimales)`, 'id');
  }
}

function assertRange({ min, max }, label) {
  if (min != null && max != null && min > max) {
    throw badInput(`El mínimo de ${label} (${min}) no puede ser mayor que el máximo (${max})`, label);
  }
}

function toProductDTO(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    price: doc.price,
    stock: doc.stock,
    category: doc.category,
    description: doc.description ?? null,
    createdAt: doc.createdAt?.toISOString() ?? null,
    updatedAt: doc.updatedAt?.toISOString() ?? null,
  };
}

function buildProductQuery(filter) {
  const query = {};

  if (filter.search?.trim()) {
    const pattern = new RegExp(escapeRegex(filter.search.trim()), 'i');
    query.$or = [{ name: pattern }, { description: pattern }];
  }

  const categories = [
    ...(filter.category ? [filter.category] : []),
    ...(filter.categories ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new RegExp(`^${escapeRegex(value)}$`, 'i'));

  if (categories.length === 1) {
    query.category = categories[0];
  } else if (categories.length > 1) {
    query.category = { $in: categories };
  }

  assertRange({ min: filter.minPrice, max: filter.maxPrice }, 'price');
  assertRange({ min: filter.minStock, max: filter.maxStock }, 'stock');

  if (filter.minPrice != null || filter.maxPrice != null) {
    query.price = {};
    if (filter.minPrice != null) query.price.$gte = filter.minPrice;
    if (filter.maxPrice != null) query.price.$lte = filter.maxPrice;
  }

  const stock = {};
  if (filter.minStock != null) stock.$gte = filter.minStock;
  if (filter.maxStock != null) stock.$lte = filter.maxStock;
  if (filter.inStock === true) stock.$gt = 0;
  if (filter.inStock === false) stock.$eq = 0;
  if (Object.keys(stock).length > 0) query.stock = stock;

  return query;
}

function buildPagination(filter) {
  const limit = filter.limit ?? DEFAULT_LIMIT;
  const offset = filter.offset ?? 0;

  if (!Number.isInteger(limit) || limit < 1) {
    throw badInput(`"limit" debe ser un entero mayor o igual a 1 (recibido: ${limit})`, 'limit');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw badInput(`"offset" debe ser un entero mayor o igual a 0 (recibido: ${offset})`, 'offset');
  }

  return { limit: Math.min(limit, MAX_LIMIT), offset };
}

/** Traduce errores de Mongoose a errores de GraphQL con un mensaje legible. */
async function runQuery(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw badInput(
        Object.values(error.errors)
          .map((detail) => detail.message)
          .join(' | '),
      );
    }
    throw error;
  }
}

export const resolvers = {
  Query: {
    products: async (_parent, { filter }) => {
      const options = filter ?? {};
      const query = buildProductQuery(options);
      const { limit, offset } = buildPagination(options);
      const sortBy = SORT_FIELDS[options.sortBy] ?? 'createdAt';
      const sortOrder = options.sortOrder === 'ASC' ? 1 : -1;

      const products = await runQuery(() =>
        Product.find(query).sort({ [sortBy]: sortOrder }).skip(offset).limit(limit).lean(),
      );

      return products.map(toProductDTO);
    },

    product: async (_parent, { id }) => {
      assertObjectId(id);
      const product = await Product.findById(id).lean();
      return product ? toProductDTO(product) : null;
    },

    categories: async () => {
      const categories = await Product.distinct('category');
      return categories.sort((a, b) => a.localeCompare(b, 'es'));
    },
  },

  Mutation: {
    createProduct: async (_parent, { input }) =>
      runQuery(async () => toProductDTO(await Product.create(input))),

    updateProduct: async (_parent, { id, input }) => {
      assertObjectId(id);

      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined && value !== null),
      );

      if (Object.keys(changes).length === 0) {
        throw badInput('El campo "input" no contiene ningún campo a actualizar');
      }

      const product = await runQuery(() =>
        Product.findByIdAndUpdate(
          id,
          { $set: changes },
          { returnDocument: 'after', runValidators: true },
        ).lean(),
      );

      if (!product) throw notFound(`No existe un producto con el id "${id}"`);

      return toProductDTO(product);
    },

    deleteProduct: async (_parent, { id }) => {
      assertObjectId(id);

      const product = await Product.findByIdAndDelete(id).lean();
      if (!product) throw notFound(`No existe un producto con el id "${id}"`);

      return toProductDTO(product);
    },
  },
};
