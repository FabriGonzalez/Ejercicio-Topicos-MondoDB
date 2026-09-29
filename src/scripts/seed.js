import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { Product } from '../models/Product.js';

const productos = [
  {
    name: 'Notebook Lenovo ThinkPad E14',
    price: 849.99,
    stock: 12,
    category: 'Computadoras',
    description: 'AMD Ryzen 5, 16 GB RAM, SSD 512 GB, pantalla 14".',
  },
  {
    name: 'Mouse Logitech G502 X',
    price: 59.5,
    stock: 40,
    category: 'Perifericos',
    description: 'Sensor de alta precisión y 13 botones programables.',
  },
  {
    name: 'Teclado Mecánico Redragon K552',
    price: 42.0,
    stock: 25,
    category: 'Perifericos',
    description: 'Switches mecánicos rojos, iluminación LED roja.',
  },
  {
    name: 'Auriculares Sony WH-1000XM5',
    price: 379.0,
    stock: 8,
    category: 'Audio',
    description: 'Cancelación activa de ruido y hasta 30 horas de batería.',
  },
  {
    name: 'Monitor Samsung 24" Curvo',
    price: 189.99,
    stock: 0,
    category: 'Monitores',
    description: 'Full HD, 75 Hz, panel VA con HDMI.',
  },
  {
    name: 'Disco SSD Kingston 1TB NVMe',
    price: 74.9,
    stock: 60,
    category: 'Componentes',
    description: 'PCIe 4.0, lectura hasta 3500 MB/s.',
  },
  {
    name: 'Silla Gamer ergonomica',
    price: 249.0,
    stock: 6,
    category: 'Muebles',
    description: 'Respaldo reclinable, reposabrazos 3D y apoyo lumbar.',
  },
  {
    name: 'Webcam Logitech C920 HD',
    price: 79.0,
    stock: 17,
    category: 'Perifericos',
    description: 'Full HD 1080p, 30 fps, micrófono estéreo.',
  },
];

await connectDatabase();

const { deletedCount } = await Product.deleteMany({});
const inserted = await Product.insertMany(productos);

console.log(`[seed] ${deletedCount} producto(s) eliminado(s)`);
console.log(`[seed] ${inserted.length} producto(s) insertados en "${mongoose.connection.name}"`);

await disconnectDatabase();
