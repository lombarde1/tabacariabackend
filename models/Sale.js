const mongoose = require('mongoose');

const saleItemSchema = mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'A quantidade deve ser pelo menos 1']
    },
    price: {
      type: Number,
      required: true
    },
    costPrice: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    }
  },
  {
    _id: true
  }
);

const saleSchema = mongoose.Schema(
  {
    saleNumber: {
      type: String,
      required: true,
      unique: true
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client'
    },
    items: [saleItemSchema],
    subtotal: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    profit: {
      type: Number,
      required: true
    },
    paymentMethod: {
      type: String,
      enum: ['Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Pix', 'Transferência', 'Outro'],
      default: 'Dinheiro'
    },
    paymentStatus: {
      type: String,
      enum: ['Pendente', 'Pago', 'Parcial', 'Cancelado'],
      default: 'Pago'
    },
    notes: {
      type: String
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Gerar o número da venda automaticamente
saleSchema.pre('save', async function(next) {
  if (this.isNew) {
    const lastSale = await this.constructor.findOne({}, {}, { sort: { 'createdAt': -1 } });
    
    if (lastSale && lastSale.saleNumber) {
      // Extrair o número da última venda e incrementar
      const lastNumber = parseInt(lastSale.saleNumber.split('-')[1]);
      this.saleNumber = `VENDA-${(lastNumber + 1).toString().padStart(6, '0')}`;
    } else {
      // Primeira venda
      this.saleNumber = 'VENDA-000001';
    }
  }
  
  next();
});

// Índices
saleSchema.index({ createdAt: -1 });
saleSchema.index({ client: 1 });
saleSchema.index({ seller: 1 });
saleSchema.index({ paymentMethod: 1 });
saleSchema.index({ paymentStatus: 1 });
saleSchema.index({ total: 1 });

module.exports = mongoose.model('Sale', saleSchema);