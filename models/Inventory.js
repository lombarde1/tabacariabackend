const mongoose = require('mongoose');

const inventoryTransactionSchema = mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    type: {
      type: String,
      enum: ['entrada', 'saida', 'ajuste', 'venda'],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    previousStock: {
      type: Number,
      required: true
    },
    newStock: {
      type: Number,
      required: true
    },
    costPrice: {
      type: Number
    },
    reason: {
      type: String
    },
    reference: {
      type: String
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referenceModel'
    },
    referenceModel: {
      type: String,
      enum: ['Sale', 'Purchase', 'StockAdjustment']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Índices
inventoryTransactionSchema.index({ product: 1 });
inventoryTransactionSchema.index({ type: 1 });
inventoryTransactionSchema.index({ createdAt: -1 });
inventoryTransactionSchema.index({ user: 1 });
inventoryTransactionSchema.index({ referenceId: 1, referenceModel: 1 });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);