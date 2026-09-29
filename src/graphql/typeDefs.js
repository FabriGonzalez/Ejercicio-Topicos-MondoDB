export const typeDefs = /* GraphQL */ `
  """
  Un producto del catálogo.
  """
  type Product {
    id: ID!
    name: String!
    price: Float!
    stock: Int!
    category: String!
    description: String
    "Los agrega automáticamente Mongoose (timestamps: true)."
    createdAt: String
    updatedAt: String
  }

  """
  Criterios de filtrado, orden y paginación para la consulta \`products\`.
  Todos los campos son opcionales y se combinan con AND.
  """
  input ProductFilter {
    "Búsqueda parcial (case-insensitive) sobre name y description."
    search: String
    "Categoría exacta (case-insensitive)."
    category: String
    "Varias categorías a la vez (OR entre ellas)."
    categories: [String!]
    minPrice: Float
    maxPrice: Float
    minStock: Int
    maxStock: Int
    "Si es true devuelve solo productos con stock; si es false, solo los agotados."
    inStock: Boolean
    sortBy: ProductSortField
    sortOrder: SortOrder
    "Cantidad máxima de resultados (por defecto 50, máximo 200)."
    limit: Int
    "Cantidad de resultados a omitir, útil para paginar."
    offset: Int
  }

  enum ProductSortField {
    NAME
    PRICE
    STOCK
    CATEGORY
    CREATED_AT
  }

  enum SortOrder {
    ASC
    DESC
  }

  input CreateProductInput {
    name: String!
    price: Float!
    stock: Int!
    category: String!
    description: String
  }

  "Todos los campos son opcionales: solo se actualizan los enviados."
  input UpdateProductInput {
    name: String
    price: Float
    stock: Int
    category: String
    description: String
  }

  type Query {
    "Devuelve todos los productos, con filtros opcionales."
    products(filter: ProductFilter): [Product!]!

    "Devuelve un producto por su id. Error NOT_FOUND si no existe."
    product(id: ID!): Product

    "Lista las categorías existentes, sin repetidas y en orden alfabético."
    categories: [String!]!
  }

  type Mutation {
    "Crea un producto nuevo."
    createProduct(input: CreateProductInput!): Product!

    "Actualiza uno o varios campos de un producto existente."
    updateProduct(id: ID!, input: UpdateProductInput!): Product!

    "Elimina un producto por su id."
    deleteProduct(id: ID!): Product!
  }
`;
