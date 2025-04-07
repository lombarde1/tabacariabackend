const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Client = require('../models/Client');
const InventoryTransaction = require('../models/Inventory');
const config = require('../config/config');

/**
 * @desc    Obter todas as vendas
 * @route   GET /api/sales
 * @access  Private
 */
const getSales = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || config.pagination.defaultLimit;
  const page = parseInt(req.query.page) || 1;
  
  // Filtros
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
  
  let dateFilter = {};
  if (startDate && endDate) {
    endDate.setHours(23, 59, 59, 999); // Final do dia
    dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };
  } else if (startDate) {
    dateFilter = {
      createdAt: { $gte: startDate }
    };
  } else if (endDate) {
    endDate.setHours(23, 59, 59, 999); // Final do dia
    dateFilter = {
      createdAt: { $lte: endDate }
    };
  }
  
  const clientFilter = req.query.client ? { client: req.query.client } : {};
  const sellerFilter = req.query.seller ? { seller: req.query.seller } : {};
  const paymentMethodFilter = req.query.paymentMethod ? { paymentMethod: req.query.paymentMethod } : {};
  const paymentStatusFilter = req.query.paymentStatus ? { paymentStatus: req.query.paymentStatus } : {};
  
  const query = {
    ...dateFilter,
    ...clientFilter,
    ...sellerFilter,
    ...paymentMethodFilter,
    ...paymentStatusFilter
  };
  
  const count = await Sale.countDocuments(query);
  
  const sales = await Sale.find(query)
    .populate('client', 'name phone')
    .populate('seller', 'name')
    .select('-items')
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ createdAt: -1 });
  
  // Calcular totais
  const totals = await Sale.aggregate([
    { $match: query },
    { $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalProfit: { $sum: '$profit' }
      }
    }
  ]);
  
  res.json({
    sales,
    page,
    pages: Math.ceil(count / pageSize),
    total: count,
    totals: totals.length > 0 ? totals[0] : { totalSales: 0, totalRevenue: 0, totalProfit: 0 }
  });
});

/**
 * @desc    Obter uma venda por ID
 * @route   GET /api/sales/:id
 * @access  Private
 */
const getSaleById = asyncHandler(async (req, res) => {
  const sale = await Sale.findById(req.params.id)
    .populate('client', 'name phone email')
    .populate('seller', 'name')
    .populate('items.product', 'name');
  
  if (sale) {
    res.json(sale);
  } else {
    res.status(404);
    throw new Error('Venda não encontrada');
  }
});

/**
 * @desc    Criar uma nova venda
 * @route   POST /api/sales
 * @access  Private
 */
/**
 * @desc    Criar uma nova venda
 * @route   POST /api/sales
 * @access  Private
 */
const createSale = asyncHandler(async (req, res) => {
    try {
      const {
        client,
        items,
        discount,
        tax,
        paymentMethod,
        paymentStatus,
        notes
      } = req.body;
      
      if (!items || items.length === 0) {
        res.status(400);
        throw new Error('Nenhum item adicionado à venda');
      }
      
      // Verificar disponibilidade de estoque e calcular valores
      let subtotal = 0;
      let totalProfit = 0;
      const saleItems = [];
      const productsToUpdate = [];
      
      for (const item of items) {
        const product = await Product.findById(item.product);
        
        if (!product) {
          throw new Error(`Produto com ID ${item.product} não encontrado`);
        }
        
        if (product.stock < item.quantity) {
          throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}`);
        }
        
        const itemPrice = item.price || product.price;
        const itemTotal = itemPrice * item.quantity;
        const itemCostTotal = product.costPrice * item.quantity;
        const itemProfit = itemTotal - itemCostTotal;
        
        subtotal += itemTotal;
        totalProfit += itemProfit;
        
        saleItems.push({
          product: product._id,
          name: product.name,
          quantity: item.quantity,
          price: itemPrice,
          costPrice: product.costPrice,
          discount: item.discount || 0,
          total: itemTotal - (item.discount || 0)
        });
        
        // Preparar para atualização de estoque
        productsToUpdate.push({
          productId: product._id,
          newStock: product.stock - item.quantity,
          previousStock: product.stock,
          quantity: item.quantity,
          costPrice: product.costPrice
        });
      }
      
      // Calcular total
      const discountAmount = discount || 0;
      const taxAmount = tax || 0;
      const total = subtotal - discountAmount + taxAmount;
      
      // Gerar número da venda
      const lastSale = await Sale.findOne({}, {}, { sort: { 'createdAt': -1 } });
      let saleNumber;
      
      if (lastSale && lastSale.saleNumber) {
        // Extrair o número da última venda e incrementar
        const lastNumber = parseInt(lastSale.saleNumber.split('-')[1]);
        saleNumber = `VENDA-${(lastNumber + 1).toString().padStart(6, '0')}`;
      } else {
        // Primeira venda
        saleNumber = 'VENDA-000001';
      }
      
      // Normalizar o método de pagamento (primeira letra maiúscula)
      let normalizedPaymentMethod = 'Dinheiro'; // Valor padrão
      
      if (paymentMethod) {
        // Converter o método de pagamento para o formato aceito pelo enum
        const methodMap = {
          'dinheiro': 'Dinheiro',
          'cartão de crédito': 'Cartão de crédito',
          'cartao de credito': 'Cartão de crédito',
          'cartão de débito': 'Cartão de débito',
          'cartao de debito': 'Cartão de débito',
          'pix': 'Pix',
          'transferência': 'Transferência',
          'transferencia': 'Transferência',
          'outro': 'Outro'
        };
        
        const lowerMethod = paymentMethod.toLowerCase();
        normalizedPaymentMethod = methodMap[lowerMethod] || 'Dinheiro';
      }
      
      // Criar a venda
      const sale = await Sale.create({
        saleNumber,
        client,
        items: saleItems,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        profit: totalProfit - discountAmount,
        paymentMethod: normalizedPaymentMethod,
        paymentStatus: paymentStatus || 'Pago',
        notes,
        seller: req.user._id
      });
      
      // Atualizar estoque dos produtos
      for (const productInfo of productsToUpdate) {
        await Product.findByIdAndUpdate(
          productInfo.productId,
          { $set: { stock: productInfo.newStock } }
        );
        
        // Criar transação de inventário
        await InventoryTransaction.create({
          product: productInfo.productId,
          type: 'saida',
          quantity: productInfo.quantity,
          previousStock: productInfo.previousStock,
          newStock: productInfo.newStock,
          costPrice: productInfo.costPrice,
          reason: 'Venda de produto',
          referenceModel: 'Sale',
          referenceId: sale._id,
          user: req.user._id
        });
      }
      
      // Atualizar informações do cliente
      if (client) {
        const clientDoc = await Client.findById(client);
        if (clientDoc) {
          clientDoc.totalPurchased = (clientDoc.totalPurchased || 0) + total;
          clientDoc.lastPurchase = Date.now();
          
          // Adicionar pontos de fidelidade (1 ponto para cada R$ 10,00)
          const loyaltyPoints = Math.floor(total / 10);
          if (loyaltyPoints > 0) {
            clientDoc.loyaltyPoints = (clientDoc.loyaltyPoints || 0) + loyaltyPoints;
          }
          
          await clientDoc.save();
        }
      }
      
      res.status(201).json(sale);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  });

/**
 * @desc    Atualizar status de pagamento da venda
 * @route   PUT /api/sales/:id/payment
 * @access  Private
 */
const updateSalePayment = asyncHandler(async (req, res) => {
  const { paymentStatus, paymentMethod } = req.body;
  
  const sale = await Sale.findById(req.params.id);
  
  if (sale) {
    sale.paymentStatus = paymentStatus || sale.paymentStatus;
    sale.paymentMethod = paymentMethod || sale.paymentMethod;
    
    const updatedSale = await sale.save();
    res.json(updatedSale);
  } else {
    res.status(404);
    throw new Error('Venda não encontrada');
  }
});

/**
 * @desc    Cancelar uma venda
 * @route   PUT /api/sales/:id/cancel
 * @access  Private/Admin
 */
const cancelSale = asyncHandler(async (req, res) => {
    try {
      const sale = await Sale.findById(req.params.id);
      
      if (!sale) {
        res.status(404);
        throw new Error('Venda não encontrada');
      }
      
      if (sale.paymentStatus === 'Cancelado') {
        res.status(400);
        throw new Error('Venda já está cancelada');
      }
      
      // Atualizar status de pagamento
      sale.paymentStatus = 'Cancelado';
      await sale.save();
      
      // Devolver produtos ao estoque
      for (const item of sale.items) {
        const product = await Product.findById(item.product);
        
        if (product) {
          const previousStock = product.stock;
          const newStock = product.stock + item.quantity;
          
          // Atualizar estoque
          await Product.findByIdAndUpdate(
            product._id,
            { $set: { stock: newStock } }
          );
          
          // Registrar movimentação de estoque
          await InventoryTransaction.create({
            product: product._id,
            type: 'entrada',
            quantity: item.quantity,
            previousStock,
            newStock,
            costPrice: item.costPrice,
            reason: 'Cancelamento de venda',
            referenceModel: 'Sale',
            referenceId: sale._id,
            user: req.user._id
          });
        }
      }
      
      // Atualizar informações do cliente
      if (sale.client) {
        const client = await Client.findById(sale.client);
        if (client) {
          client.totalPurchased = Math.max(0, (client.totalPurchased || 0) - sale.total);
          
          // Remover pontos de fidelidade
          const loyaltyPoints = Math.floor(sale.total / 10);
          if (loyaltyPoints > 0) {
            client.loyaltyPoints = Math.max(0, (client.loyaltyPoints || 0) - loyaltyPoints);
          }
          
          await client.save();
        }
      }
      
      res.json({ message: 'Venda cancelada com sucesso', sale });
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  });
/**
 * @desc    Obter vendas por período
 * @route   GET /api/sales/by-period
 * @access  Private
 */
const getSalesByPeriod = asyncHandler(async (req, res) => {
  const { period } = req.query;
  const today = new Date();
  let startDate, endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);
  
  // Definir período
  if (period === 'today') {
    startDate = new Date(today.setHours(0, 0, 0, 0));
  } else if (period === 'yesterday') {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);
  } else if (period === 'week') {
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === 'month') {
    startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === 'year') {
    startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Padrão: últimos 30 dias
    startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }
  
  // Calcular totais
  const totals = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        totalProfit: { $sum: '$profit' }
      }
    }
  ]);
  
  // Agrupar por dia
  const salesByDay = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$total' },
        profit: { $sum: '$profit' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  res.json({
    period,
    startDate,
    endDate,
    totals: totals.length > 0 ? totals[0] : { totalSales: 0, totalRevenue: 0, totalProfit: 0 },
    salesByDay
  });
});

/**
 * @desc    Obter produtos mais vendidos
 * @route   GET /api/sales/top-products
 * @access  Private
 */
const getTopProducts = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
  
  let dateFilter = {};
  if (startDate && endDate) {
    endDate.setHours(23, 59, 59, 999);
    dateFilter = {
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };
  } else if (startDate) {
    dateFilter = {
      createdAt: { $gte: startDate }
    };
  } else if (endDate) {
    endDate.setHours(23, 59, 59, 999);
    dateFilter = {
      createdAt: { $lte: endDate }
    };
  }
  
  const topProducts = await Sale.aggregate([
    { $match: { ...dateFilter, paymentStatus: { $ne: 'Cancelado' } } },
    { $unwind: '$items' },
    { $group: {
        _id: '$items.product',
        productName: { $first: '$items.name' },
        totalQuantity: { $sum: '$items.quantity' },
        totalSales: { $sum: 1 },
        totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
    { $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
    { $project: {
        _id: 1,
        name: '$productName',
        category: '$productDetails.category',
        stock: '$productDetails.stock',
        totalQuantity: 1,
        totalSales: 1,
        totalRevenue: 1
      }
    }
  ]);
  
  res.json(topProducts);
});

module.exports = {
  getSales,
  getSaleById,
  createSale,
  updateSalePayment,
  cancelSale,
  getSalesByPeriod,
  getTopProducts
};