const mongoose = require('mongoose');

const productSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Por favor, informe o nome do produto'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Por favor, informe a categoria do produto'],
      enum: ['Essências', 'Tabaco', 'Acessórios', 'Narguilés', 'Carvão', 'Bebidas','pod','Pod', 'Outros'],
      default: 'Outros'
    },
    price: {
      type: Number,
      required: [true, 'Por favor, informe o preço de venda'],
      min: [0, 'O preço não pode ser negativo']
    },
    costPrice: {
      type: Number,
      required: [true, 'Por favor, informe o preço de custo'],
      min: [0, 'O preço de custo não pode ser negativo']
    },
    stock: {
      type: Number,
      required: [true, 'Por favor, informe a quantidade em estoque'],
      default: 0,
      min: [0, 'O estoque não pode ser negativo']
    },
    minStock: {
      type: Number,
      default: 5,
      min: [0, 'O estoque mínimo não pode ser negativo']
    },
    barcode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier'
    },
    expiryDate: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    },
    images: [
        {
          type: String
        }
      ],
      flavors: [{
        type: String,
        trim: true
      }],
      
    attributes: {
      type: Map,
      of: String,
      default: {}
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual para calcular margem de lucro
productSchema.virtual('profitMargin').get(function() {
  if (this.costPrice === 0) return 100;
  return ((this.price - this.costPrice) / this.price * 100).toFixed(2);
});

// Virtual para verificar se o estoque está baixo
productSchema.virtual('isLowStock').get(function() {
  return this.stock <= this.minStock;
});

// Índices
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ 'supplier': 1 });
productSchema.index({ barcode: 1 });

module.exports = mongoose.model('Product', productSchema);