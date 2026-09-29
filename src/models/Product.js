import mongoose from 'mongoose';

const { Schema } = mongoose;

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'El nombre del producto es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre debe tener al menos 2 caracteres'],
      maxlength: [120, 'El nombre no puede superar los 120 caracteres'],
    },
    price: {
      type: Number,
      required: [true, 'El precio del producto es obligatorio'],
      min: [0, 'El precio no puede ser negativo'],
    },
    stock: {
      type: Number,
      required: [true, 'El stock del producto es obligatorio'],
      min: [0, 'El stock no puede ser negativo'],
    },
    category: {
      type: String,
      required: [true, 'La categoría del producto es obligatoria'],
      trim: true,
      maxlength: [60, 'La categoría no puede superar los 60 caracteres'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'La descripción no puede superar los 1000 caracteres'],
      default: '',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'products',
  },
);

productSchema.index({ category: 1, price: 1 });
productSchema.index({ createdAt: -1 });

export const Product = mongoose.model('Product', productSchema);
