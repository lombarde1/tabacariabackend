const mongoose = require('mongoose');

const supplierSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Por favor, informe o nome do fornecedor'],
      trim: true
    },
    companyName: {
      type: String,
      trim: true
    },
    document: {
      type: String,
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
    contactPerson: {
      name: String,
      phone: String,
      email: String
    },
    categories: [{
      type: String,
      enum: ['Essências', 'Tabaco', 'Acessórios', 'Narguilés', 'Carvão', 'Bebidas', 'Outros'],
    }],
    paymentTerms: {
      type: String
    },
    minOrderValue: {
      type: Number,
      default: 0
    },
    observations: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true
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
supplierSchema.index({ name: 'text', companyName: 'text' });
supplierSchema.index({ categories: 1 });
supplierSchema.index({ isActive: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);