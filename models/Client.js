const mongoose = require('mongoose');

const clientSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Por favor, informe o nome do cliente'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor, forneça um email válido'
      ],
      sparse: true
    },
    phone: {
      type: String,
      trim: true
    },
    address: {
      street: String,
      number: String,
      complement: String,
      neighborhood: String,
      city: String,
      state: String,
      zipCode: String
    },
    document: {
      type: String,
      trim: true
    },
    birthday: {
      type: Date
    },
    observations: {
      type: String
    },
    loyaltyPoints: {
      type: Number,
      default: 0
    },
    favorite: {
      category: {
        type: String,
        enum: ['Essências', 'Tabaco', 'Acessórios', 'Narguilés', 'Carvão', 'Bebidas', 'Outros'],
      },
      products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      }]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    totalPurchased: {
      type: Number,
      default: 0
    },
    lastPurchase: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Índices
clientSchema.index({ name: 'text' });
clientSchema.index({ phone: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ document: 1 });
clientSchema.index({ isActive: 1 });

module.exports = mongoose.model('Client', clientSchema);