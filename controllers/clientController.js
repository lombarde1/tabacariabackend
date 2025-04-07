const asyncHandler = require('express-async-handler');
const Client = require('../models/Client');
const Sale = require('../models/Sale');
const config = require('../config/config');
const mongoose = require('mongoose');

/**
 * @desc    Obter todos os clientes
 * @route   GET /api/clients
 * @access  Private
 */
const getClients = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || config.pagination.defaultLimit;
  const page = parseInt(req.query.page) || 1;
  
  const keyword = req.query.keyword
    ? {
        $or: [
          { name: { $regex: req.query.keyword, $options: 'i' } },
          { email: { $regex: req.query.keyword, $options: 'i' } },
          { phone: { $regex: req.query.keyword, $options: 'i' } },
          { document: { $regex: req.query.keyword, $options: 'i' } }
        ]
      }
    : {};
    
  const isActive = req.query.isActive !== undefined 
    ? { isActive: req.query.isActive === 'true' } 
    : {};
  
  const query = {
    ...keyword,
    ...isActive
  };
  
  const count = await Client.countDocuments(query);
  
  const clients = await Client.find(query)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ name: 1 });
  
  res.json({
    clients,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

/**
 * @desc    Obter um cliente por ID
 * @route   GET /api/clients/:id
 * @access  Private
 */
const getClientById = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id)
    .populate('favorite.products', 'name price');
  
  if (client) {
    res.json(client);
  } else {
    res.status(404);
    throw new Error('Cliente não encontrado');
  }
});

/**
 * @desc    Criar um cliente
 * @route   POST /api/clients
 * @access  Private
 */
const createClient = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    document,
    birthday,
    observations,
    favorite
  } = req.body;
  
  // Verificar se já existe um cliente com o mesmo documento ou email
  if (document) {
    const clientByDocument = await Client.findOne({ document });
    if (clientByDocument) {
      res.status(400);
      throw new Error('Já existe um cliente com este documento');
    }
  }
  
  if (email) {
    const clientByEmail = await Client.findOne({ email });
    if (clientByEmail) {
      res.status(400);
      throw new Error('Já existe um cliente com este email');
    }
  }
  
  const client = await Client.create({
    name,
    email,
    phone,
    address,
    document,
    birthday,
    observations,
    favorite
  });
  
  if (client) {
    res.status(201).json(client);
  } else {
    res.status(400);
    throw new Error('Dados de cliente inválidos');
  }
});

/**
 * @desc    Atualizar um cliente
 * @route   PUT /api/clients/:id
 * @access  Private
 */
const updateClient = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    address,
    document,
    birthday,
    observations,
    favorite,
    isActive,
    loyaltyPoints
  } = req.body;
  
  const client = await Client.findById(req.params.id);
  
  if (client) {
    // Verificar se há outro cliente com o mesmo documento ou email
    if (document && document !== client.document) {
      const clientByDocument = await Client.findOne({ document });
      if (clientByDocument) {
        res.status(400);
        throw new Error('Já existe um cliente com este documento');
      }
    }
    
    if (email && email !== client.email) {
      const clientByEmail = await Client.findOne({ email });
      if (clientByEmail) {
        res.status(400);
        throw new Error('Já existe um cliente com este email');
      }
    }
    
    // Atualizar cliente
    client.name = name || client.name;
    client.email = email !== undefined ? email : client.email;
    client.phone = phone !== undefined ? phone : client.phone;
    
    if (address) {
      client.address = {
        street: address.street || client.address?.street,
        number: address.number || client.address?.number,
        complement: address.complement || client.address?.complement,
        neighborhood: address.neighborhood || client.address?.neighborhood,
        city: address.city || client.address?.city,
        state: address.state || client.address?.state,
        zipCode: address.zipCode || client.address?.zipCode
      };
    }
    
    client.document = document !== undefined ? document : client.document;
    client.birthday = birthday || client.birthday;
    client.observations = observations !== undefined ? observations : client.observations;
    client.isActive = isActive !== undefined ? isActive : client.isActive;
    client.loyaltyPoints = loyaltyPoints !== undefined ? loyaltyPoints : client.loyaltyPoints;
    
    if (favorite) {
      client.favorite = {
        category: favorite.category || client.favorite?.category,
        products: favorite.products || client.favorite?.products
      };
    }
    
    const updatedClient = await client.save();
    res.json(updatedClient);
  } else {
    res.status(404);
    throw new Error('Cliente não encontrado');
  }
});

/**
 * @desc    Excluir um cliente
 * @route   DELETE /api/clients/:id
 * @access  Private/Admin
 */
const deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findById(req.params.id);
  
  if (client) {
    // Verificar se o cliente já realizou compras
    const salesCount = await Sale.countDocuments({ client: client._id });
    
    if (salesCount > 0) {
      // Em vez de excluir, apenas marcar como inativo
      client.isActive = false;
      await client.save();
      res.json({ message: 'Cliente marcado como inativo' });
    } else {
      // Se não tiver compras, pode excluir
      await client.deleteOne();
      res.json({ message: 'Cliente removido' });
    }
  } else {
    res.status(404);
    throw new Error('Cliente não encontrado');
  }
});

/**
 * @desc    Obter histórico de compras de um cliente
 * @route   GET /api/clients/:id/sales
 * @access  Private
 */
const getClientSales = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || config.pagination.defaultLimit;
  const page = parseInt(req.query.page) || 1;
  
  const count = await Sale.countDocuments({ client: req.params.id });
  
  const sales = await Sale.find({ client: req.params.id })
    .populate('seller', 'name')
    .select('-items')
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ createdAt: -1 });
  
  const totalPurchased = await Sale.aggregate([
    { $match: { client: new mongoose.Types.ObjectId(req.params.id) } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  
  res.json({
    sales,
    page,
    pages: Math.ceil(count / pageSize),
    total: count,
    totalPurchased: totalPurchased.length > 0 ? totalPurchased[0].total : 0
  });
});

/**
 * @desc    Adicionar ou remover pontos de fidelidade
 * @route   PUT /api/clients/:id/loyalty
 * @access  Private
 */
const updateLoyaltyPoints = asyncHandler(async (req, res) => {
  const { points, operation, reason } = req.body;
  
  if (!points || !operation || !['add', 'remove'].includes(operation)) {
    res.status(400);
    throw new Error('Informe os pontos e a operação (add ou remove)');
  }
  
  const client = await Client.findById(req.params.id);
  
  if (client) {
    if (operation === 'add') {
      client.loyaltyPoints += Number(points);
    } else {
      if (client.loyaltyPoints < Number(points)) {
        res.status(400);
        throw new Error('Cliente não possui pontos suficientes');
      }
      client.loyaltyPoints -= Number(points);
    }
    
    await client.save();
    
    res.json({
      message: `Pontos ${operation === 'add' ? 'adicionados' : 'removidos'} com sucesso`,
      loyaltyPoints: client.loyaltyPoints,
      reason: reason || `Pontos ${operation === 'add' ? 'adicionados' : 'removidos'} manualmente`
    });
  } else {
    res.status(404);
    throw new Error('Cliente não encontrado');
  }
});

/**
 * @desc    Obter os melhores clientes
 * @route   GET /api/clients/top
 * @access  Private
 */
const getTopClients = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  
  const topClients = await Sale.aggregate([
    { $match: { client: { $ne: null } } },
    { $group: { 
        _id: '$client', 
        totalSpent: { $sum: '$total' },
        orderCount: { $sum: 1 },
        lastPurchase: { $max: '$createdAt' }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: limit },
    { $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'clientDetails'
      }
    },
    { $unwind: '$clientDetails' },
    { $project: {
        _id: 1,
        name: '$clientDetails.name',
        phone: '$clientDetails.phone',
        totalSpent: 1,
        orderCount: 1,
        lastPurchase: 1
      }
    }
  ]);
  
  res.json(topClients);
});

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientSales,
  updateLoyaltyPoints,
  getTopClients
};