# API de Productos con GraphQL, Express y MongoDB Atlas

API GraphQL de productos construida con **Express 5**, **Apollo Server 5**, **Mongoose 9** y **MongoDB Atlas**.
Trae introspección y la interfaz **Apollo Sandbox** habilitadas, lista para desplegar en **Render**.

## Stack

| Paquete | Versión | Rol |
| --- | --- | --- |
| `express` | ^5.2.1 | Servidor HTTP y middleware |
| `@apollo/server` | ^5.5.1 | Servidor GraphQL |
| `@as-integrations/express5` | ^1.1.2 | Puente Apollo ↔ Express 5 |
| `graphql` | ^16.11.0 | Motor GraphQL (17 todavía no es compatible con Apollo Server 5) |
| `mongoose` | ^9.10.3 | ODM y conexión a Atlas |
| `cors` / `dotenv` | ^2.8.5 / ^18.0.4 | CORS y variables de entorno |

## 1. Requisitos

- Node.js 20 o superior (probado con v22.20.0)
- Un cluster en MongoDB Atlas

## 2. Preparar MongoDB Atlas

### a) Crear el usuario de base de datos

**Database Access → Add New Database User**. Usá el usuario y la contraseña que ya tenés.

### b) Habilitar el acceso de red (¡paso obligatorio!)

**Network Access → Add IP Address**.

- Para trabajar en local: agregá tu IP pública, o elegí **Allow access from anywhere** (`0.0.0.0/0`).
- **Render es obligatorio usar `0.0.0.0/0`**: las IPs de salida de Render son dinámicas y cambian con cada
  despliegue, así que una IP fija bloquearía la conexión en producción.

Sin esto la app no conecta y Mongoose falla con
`MongooseServerSelectionError: Could not connect to any servers`.

### c) Obtener la URI

**Connect → Drivers**. Copiá la URI y reemplazá `<db_username>` y `<password>` por tus credenciales.
Si la contraseña tiene caracteres especiales (`@ : / ? # [ ] %`), va codificada en URL (`%40`, `%3A`, ...).

## 3. Instalación

```bash
npm install
```

## 4. Variables de entorno

```bash
cp .env.example .env
```

Completá `MONGODB_URI` en `.env`:

```env
PORT=4000
MONGODB_URI="mongodb+srv://fabrigonzalez171_db_user:TU_CONTRASENA@clusterproductos.oym6hbh.mongodb.net/?appName=ClusterProductos"
MONGODB_DATABASE="productos"
CORS_ORIGIN="*"
```

> `.env` está en `.gitignore` y nunca se sube al repositorio. El nombre de la base (`productos`) se agrega
> automáticamente si la URI no lo trae, porque Atlas suele entregarla sin base y Mongoose usaría `test`.

## 5. Cargar datos de ejemplo

```bash
npm run seed
```

Inserta 8 productos y borra los anteriores de la colección `products`.

## 6. Ejecutar

```bash
npm run dev     # con recarga automática (node --watch)
npm start       # normal
```

- **GraphQL + Apollo Sandbox:** http://localhost:4000/graphql
- **Health check:** http://localhost:4000/health
- `/` redirige a `/graphql`

Abrí `http://localhost:4000/graphql` en el navegador para usar **Apollo Sandbox**: escribís la operación a la
izquierda, la ejecutás y ves el JSON a la derecha, con autocompletado del esquema.

## Estructura del proyecto

```
├── src/
│   ├── index.js              # Express + Apollo Server, plugins, /health, apagado limpio
│   ├── config/env.js         # Carga y validación de variables de entorno
│   ├── db/connection.js      # Conexión a Atlas con Mongoose
│   ├── models/Product.js     # Schema de Mongoose con validaciones e índices
│   ├── graphql/
│   │   ├── typeDefs.js       # SDL
│   │   └── resolvers.js      # Resolvers (queries y mutations)
│   └── scripts/seed.js       # Carga de datos de ejemplo
├── .env.example
├── render.yaml               # Configuración de despliegue en Render
└── package.json
```

## Esquema GraphQL

```graphql
type Product {
  id: ID!
  name: String!
  price: Float!
  stock: Int!
  category: String!
  description: String
  createdAt: String
  updatedAt: String
}

input ProductFilter {
  search: String          # parcial, case-insensitive, sobre name y description
  category: String        # exacta, case-insensitive
  categories: [String!]   # varias categorías (OR entre ellas)
  minPrice: Float
  maxPrice: Float
  minStock: Int
  maxStock: Int
  inStock: Boolean        # true = con stock, false = agotados
  sortBy: ProductSortField
  sortOrder: SortOrder
  limit: Int              # por defecto 50, máximo 200
  offset: Int
}
```

### Queries

| Query | Descripción |
| --- | --- |
| `products(filter: ProductFilter): [Product!]!` | Todos los productos, con filtros, orden y paginación opcionales |
| `product(id: ID!): Product` | Un producto por id. `null` si no existe |
| `categories: [String!]!` | Categorías únicas, orden alfabéticamente |

### Mutations

| Mutation | Descripción |
| --- | --- |
| `updateProduct(id: ID!, input: UpdateProductInput!): Product!` | Actualiza uno o varios campos |
| `createProduct(input: CreateProductInput!): Product!` | Crea un producto |
| `deleteProduct(id: ID!): Product!` | Elimina y devuelve el producto borrado |

`UpdateProductInput` tiene todos sus campos opcionales, así que la mutación es un **PATCH**: solo se modifican
los campos enviados. Si mandás `input: {}` devuelve un error `BAD_USER_INPUT`.

## Ejemplos de operaciones

**Todos los productos**

```graphql
query {
  products {
    id
    name
    price
    stock
    category
    description
  }
}
```

**Filtrar**

```graphql
query {
  products(
    filter: {
      category: "Perifericos"
      minPrice: 50
      inStock: true
      sortBy: PRICE
      sortOrder: ASC
    }
  ) {
    name
    price
    stock
  }
}
```

**Buscar por texto**

```graphql
query {
  products(filter: { search: "monitor", maxPrice: 300 }) {
    name
    price
  }
}
```

**Un producto por id**

```graphql
query {
  product(id: "507f1f77bcf86cd799439011") {
    name
    price
  }
}
```

**Actualizar campos de un producto**

```graphql
mutation {
  updateProduct(id: "507f1f77bcf86cd799439011", input: { price: 79.99, stock: 25 }) {
    id
    name
    price
    stock
    updatedAt
  }
}
```

**Actualizar con variables**

```graphql
mutation ActualizarProducto($id: ID!, $input: UpdateProductInput!) {
  updateProduct(id: $id, input: $input) {
    id
    name
    price
    stock
  }
}
```

```json
{
  "id": "507f1f77bcf86cd799439011",
  "input": { "price": 79.99, "stock": 25 }
}
```

## Manejo de errores

Los errores de negocio usan `extensions.code`, para poder tratarlos desde el cliente:

| `extensions.code` | Cuándo ocurre |
| --- | --- |
| `BAD_USER_INPUT` | Validaciones de Mongoose, id con formato inválido, rangos incoherentes (`minPrice > maxPrice`), input vacío |
| `NOT_FOUND` | El producto no existe al actualizar o eliminar |
| `GRAPHQL_VALIDATION_FAILED` | La consulta no coincide con el SDL |

```json
{
  "data": null,
  "errors": [
    {
      "message": "No existe un producto con el id \"507f1f77bcf86cd799439011\"",
      "extensions": { "code": "NOT_FOUND" }
    }
  ]
}
```

## Introspección y Apollo Sandbox

En `src/index.js` la introspección se habilita de forma explícita:

```js
introspection: true,
plugins: [
  ApolloServerPluginDrainHttpServer({ httpServer }),
  ApolloServerPluginLandingPageLocalDefault({ embed: true, includeCookies: false }),
]
```

Apollo Server **deshabilita la introspección y cambia la landing page cuando `NODE_ENV=production`**, así que
ambos valores están forzados a mano para que el esquema se pueda explorar también en producción.

`embed: true` hace que Sandbox se sirva dentro de la propia página en lugar de redirigir a
`studio.apollographql.com`. Eso importa en Render: la interfaz queda en tu propio dominio y no depende de
Apollo, por lo que el explorador del esquema y la consola de consultas funcionan sin conexión externa.

## Despliegue en Render

El repositorio incluye `render.yaml`, así que se puede desplegar como **Blueprint**.

### Opción A: Blueprint (recomendada)

1. Subí el proyecto a GitHub (`.env` no se incluye, ya está en `.gitignore`).
2. En Render: **New → Blueprint**, elegí el repositorio.
3. Render va a pedir el valor de `MONGODB_URI` porque está declarado como `sync: false`.
4. Click en **Apply**.

### Opción B: Manual

1. **New → Web Service**, conectá el repositorio.
2. Configuración:

   | Campo | Valor |
   | --- | --- |
   | Runtime | Node |
   | Build Command | `npm ci` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |

3. En **Environment** agregá:

   | Variable | Valor |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Tu URI de Atlas (con la contraseña) |
   | `CORS_ORIGIN` | `*` |

   `PORT` lo inyecta Render automáticamente, no hay que cargarlo.

4. **Create Web Service**.

### Después del despliegue

- Sandbox: `https://<tu-servicio>.onrender.com/graphql`
- Health: `https://<tu-servicio>.onrender.com/health`

Recordá que en Atlas debe estar habilitado `0.0.0.0/0` en **Network Access**, si no Render tampoco va a poder
conectar.

### Cargar datos en la base de Atlas

```bash
npm run seed
```

## Detalles de implementación

- **`/health`** devuelve `200` si la base está conectada y `503` si no. Render lo usa para decidir si el
  servicio está sano.
- **Apagado limpio**: el plugin `ApolloServerPluginDrainHttpServer` más handlers de `SIGINT`/`SIGTERM` cierran
  las conexiones de GraphQL y de Mongoose antes de salir, para que Render no corte peticiones a medias.
- **Los `id` son ObjectId de MongoDB.** Un `id` con otro formato devuelve `BAD_USER_INPUT` en lugar de un error
  500.
- **Regex escapadas**: los valores de `search` y `category` se escapan antes de armar la expresión regular, así
  que un `.*` busca el texto literal `.*` y no matchea todos los productos.
- **Orden validado**: `sortBy` se traduce con una tabla de campos permitidos, así que no se puede inyectar
  cualquier clave de MongoDB.
- **Sin `stacktrace` en producción**: Apollo Server solo lo incluye cuando `NODE_ENV !== 'production'`.
