const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Supplier = require('../models/Supplier');

/**
 * @desc    Obter estatísticas gerais para o dashboard
 * @route   GET /api/dashboard
 * @access  Private
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  // Data atual para filtros
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Contagens
  const productCount = await Product.countDocuments({ isActive: true });
  const clientCount = await Client.countDocuments({ isActive: true });
  const supplierCount = await Supplier.countDocuments({ isActive: true });
  
  // Produtos com estoque baixo
  const lowStockCount = await Product.countDocuments({
    $expr: { $lte: ['$stock', '$minStock'] },
    isActive: true
  });
  
  // Vendas de hoje
  const todaySales = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: today, $lte: endOfDay },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: '$total' },
        profit: { $sum: '$profit' }
      }
    }
  ]);
  
  // Vendas do mês
  const monthSales = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: '$total' },
        profit: { $sum: '$profit' }
      }
    }
  ]);
  
  // Vendas por método de pagamento (mês atual)
  const paymentMethods = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: '$paymentMethod',
        count: { $sum: 1 },
        total: { $sum: '$total' }
      }
    },
    { $sort: { total: -1 } }
  ]);
  
  // Vendas por categoria de produto (mês atual)
  const salesByCategory = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: '$productInfo.category',
        count: { $sum: '$items.quantity' },
        total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { total: -1 } }
  ]);
  
  // Top 5 produtos mais vendidos (mês atual)
  const topProducts = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        quantity: { $sum: '$items.quantity' },
        total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
      }
    },
    { $sort: { quantity: -1 } },
    { $limit: 5 }
  ]);
  
  // Top 5 clientes (mês atual)
  const topClients = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        paymentStatus: { $ne: 'Cancelado' },
        client: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$client',
        count: { $sum: 1 },
        total: { $sum: '$total' }
      }
    },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'clientInfo'
      }
    },
    { $unwind: '$clientInfo' },
    {
      $project: {
        _id: 1,
        name: '$clientInfo.name',
        count: 1,
        total: 1
      }
    },
    { $sort: { total: -1 } },
    { $limit: 5 }
  ]);
  
  // Vendas por dia (últimos 7 dias)
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);
  
  const salesByDay = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: lastWeekStart, $lte: endOfDay },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
        total: { $sum: '$total' },
        profit: { $sum: '$profit' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  res.json({
    counts: {
      products: productCount,
      clients: clientCount,
      suppliers: supplierCount,
      lowStock: lowStockCount
    },
    sales: {
      today: todaySales.length > 0 ? todaySales[0] : { count: 0, total: 0, profit: 0 },
      month: monthSales.length > 0 ? monthSales[0] : { count: 0, total: 0, profit: 0 }
    },
    charts: {
      paymentMethods,
      salesByCategory,
      salesByDay
    },
    top: {
      products: topProducts,
      clients: topClients
    }
  });
});

/**
 * @desc    Obter análise de vendas por período
 * @route   GET /api/dashboard/sales-analysis
 * @access  Private
 */
const getSalesAnalysis = asyncHandler(async (req, res) => {
  const { startDate, endDate, groupBy } = req.query;
  
  // Verificar datas
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  start.setHours(0, 0, 0, 0);
  
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  
  // Definir agrupamento
  let groupFormat;
  let sortOrder = 1;
  
  switch (groupBy) {
    case 'day':
      groupFormat = '%Y-%m-%d';
      break;
    case 'week':
      groupFormat = '%G-W%V'; // Formato ISO: ano-semana
      break;
    case 'month':
      groupFormat = '%Y-%m';
      break;
    case 'year':
      groupFormat = '%Y';
      break;
    default:
      groupFormat = '%Y-%m-%d'; // Padrão: dia
  }
  
  // Análise de vendas
  const salesAnalysis = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
        count: { $sum: 1 },
        total: { $sum: '$total' },
        profit: { $sum: '$profit' },
        averageTicket: { $avg: '$total' }
      }
    },
    {
      $sort: { _id: sortOrder }
    }
  ]);
  
  // Totais do período
  const totals = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        total: { $sum: '$total' },
        profit: { $sum: '$profit' },
        averageTicket: { $avg: '$total' }
      }
    }
  ]);
  
  // Vendas por categoria do período
  const categorySales = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        paymentStatus: { $ne: 'Cancelado' }
      }
    },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'productInfo'
      }
    },
    { $unwind: '$productInfo' },
    {
      $group: {
        _id: '$productInfo.category',
        count: { $sum: '$items.quantity' },
        total: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        profit: { $sum: { 
          $subtract: [
            { $multiply: ['$items.price', '$items.quantity'] },
            { $multiply: ['$items.costPrice', '$items.quantity'] }
          ]
        }}
      }
    },
    { $sort: { total: -1 } }
  ]);
  
  res.json({
    period: {
      start,
      end,
      groupBy
    },
    analysis: salesAnalysis,
    totals: totals.length > 0 ? totals[0] : { count: 0, total: 0, profit: 0, averageTicket: 0 },
    categorySales
  });
});

/**
 * @desc    Obter análise de estoque
 * @route   GET /api/dashboard/inventory-analysis
 * @access  Private
 */
const getInventoryAnalysis = asyncHandler(async (req, res) => {
  // Análise por categoria
  const categoryAnalysis = await Product.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
        totalCost: { $sum: { $multiply: ['$stock', '$costPrice'] } },
        averagePrice: { $avg: '$price' }
      }
    },
    {
      $sort: { totalValue: -1 }
    }
  ]);
  
  // Produtos sem estoque
  const outOfStock = await Product.countDocuments({
    stock: 0,
    isActive: true
  });
  
  // Produtos com estoque baixo
  const lowStock = await Product.find({
    $expr: { $lte: ['$stock', '$minStock'] },
    isActive: true
  })
  .select('name category stock minStock price')
  .sort({ stock: 1 });
  
  // Valor total do inventário
  const inventoryValue = await Product.aggregate([
    {
      $match: { isActive: true }
    },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        totalStock: { $sum: '$stock' },
        totalValue: { $sum: { $multiply: ['$stock', '$price'] } },
        totalCost: { $sum: { $multiply: ['$stock', '$costPrice'] } },
        potentialProfit: { $sum: { 
          $subtract: [
            { $multiply: ['$stock', '$price'] },
            { $multiply: ['$stock', '$costPrice'] }
          ]
        }}
      }
    }
  ]);
  
  res.json({
    categoryAnalysis,
    stockStatus: {
      outOfStock,
      lowStock
    },
    inventoryValue: inventoryValue.length > 0 ? inventoryValue[0] : {
      totalItems: 0,
      totalStock: 0,
      totalValue: 0,
      totalCost: 0,
      potentialProfit: 0
    }
  });
});

/**
 * @desc    Obter análise de clientes
 * @route   GET /api/dashboard/client-analysis
 * @access  Private
 */
const getClientAnalysis = asyncHandler(async (req, res) => {
  // Data atual para filtros
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Contagem total de clientes
  const totalClients = await Client.countDocuments({ isActive: true });
  
  // Novos clientes este mês
  const newClients = await Client.countDocuments({
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    isActive: true
  });
  
  // Clientes com compras este mês
  const activeClients = await Sale.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        paymentStatus: { $ne: 'Cancelado' },
        client: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$client'
      }
    },
    {
      $count: 'total'
    }
  ]);
  
  // Top clientes (por valor total de compras)
  const topClients = await Sale.aggregate([
    {
      $match: {
        paymentStatus: { $ne: 'Cancelado' },
        client: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$client',
        totalSpent: { $sum: '$total' },
        orderCount: { $sum: 1 },
        lastPurchase: { $max: '$createdAt' }
      }
    },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'clientInfo'
      }
    },
    {
      $unwind: '$clientInfo'
    },
    {
      $project: {
        _id: 1,
        name: '$clientInfo.name',
        phone: '$clientInfo.phone',
        totalSpent: 1,
        orderCount: 1,
        lastPurchase: 1,
        averageTicket: { $divide: ['$totalSpent', '$orderCount'] }
      }
    },
    {
      $sort: { totalSpent: -1 }
    },
    {
      $limit: 10
    }
  ]);
  
  // Ticket médio por cliente
  const averageTicket = await Sale.aggregate([
    {
      $match: {
        paymentStatus: { $ne: 'Cancelado' },
        client: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$client',
        totalSpent: { $sum: '$total' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $project: {
        averageTicket: { $divide: ['$totalSpent', '$orderCount'] }
      }
    },
    {
      $group: {
        _id: null,
        average: { $avg: '$averageTicket' }
      }
    }
  ]);
  
  res.json({
    counts: {
      total: totalClients,
      newThisMonth: newClients,
      activeThisMonth: activeClients.length > 0 ? activeClients[0].total : 0
    },
    topClients,
    averageTicket: averageTicket.length > 0 ? averageTicket[0].average : 0
  });
});

module.exports = {
  getDashboardStats,
  getSalesAnalysis,
  getInventoryAnalysis,
  getClientAnalysis
};