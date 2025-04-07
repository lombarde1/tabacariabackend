const asyncHandler = require('express-async-handler');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const config = require('../config/config');

/**
 * @desc    Obter todos os fornecedores
 * @route   GET /api/suppliers
 * @access  Private
 */
const getSuppliers = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || config.pagination.defaultLimit;
  const page = parseInt(req.query.page) || 1;
  
  const keyword = req.query.keyword
    ? {
        $or: [
          { name: { $regex: req.query.keyword, $options: 'i' } },
          { companyName: { $regex: req.query.keyword, $options: 'i' } },
          { document: { $regex: req.query.keyword, $options: 'i' } },
          { email: { $regex: req.query.keyword, $options: 'i' } },
          { phone: { $regex: req.query.keyword, $options: 'i' } }
        ]
      }
    : {};
    
  const category = req.query.category ? { categories: req.query.category } : {};
  const isActive = req.query.isActive !== undefined ? { isActive: req.query.isActive === 'true' } : {};
  
  const query = {
    ...keyword,
    ...category,
    ...isActive
  };
  
  const count = await Supplier.countDocuments(query);
  
  const suppliers = await Supplier.find(query)
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ name: 1 });
  
  res.json({
    suppliers,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

/**
 * @desc    Obter um fornecedor por ID
 * @route   GET /api/suppliers/:id
 * @access  Private
 */
const getSupplierById = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  
  if (supplier) {
    res.json(supplier);
  } else {
    res.status(404);
    throw new Error('Fornecedor não encontrado');
  }
});

/**
 * @desc    Criar um fornecedor
 * @route   POST /api/suppliers
 * @access  Private
 */
const createSupplier = asyncHandler(async (req, res) => {
  const {
    name,
    companyName,
    document,
    email,
    phone,
    address,
    contactPerson,
    categories,
    paymentTerms,
    minOrderValue,
    observations
  } = req.body;
  
  // Verificar se já existe um fornecedor com o mesmo documento
  if (document) {
    const existingSupplier = await Supplier.findOne({ document });
    if (existingSupplier) {
      res.status(400);
      throw new Error('Já existe um fornecedor com este documento');
    }
  }
  
  const supplier = await Supplier.create({
    name,
    companyName,
    document,
    email,
    phone,
    address,
    contactPerson,
    categories,
    paymentTerms,
    minOrderValue,
    observations
  });
  
  if (supplier) {
    res.status(201).json(supplier);
  } else {
    res.status(400);
    throw new Error('Dados de fornecedor inválidos');
  }
});

/**
 * @desc    Atualizar um fornecedor
 * @route   PUT /api/suppliers/:id
 * @access  Private
 */
const updateSupplier = asyncHandler(async (req, res) => {
  const {
    name,
    companyName,
    document,
    email,
    phone,
    address,
    contactPerson,
    categories,
    paymentTerms,
    minOrderValue,
    observations,
    isActive
  } = req.body;
  
  const supplier = await Supplier.findById(req.params.id);
  
  if (supplier) {
    // Verificar se há outro fornecedor com o mesmo documento
    if (document && document !== supplier.document) {
      const existingSupplier = await Supplier.findOne({ document });
      if (existingSupplier) {
        res.status(400);
        throw new Error('Já existe um fornecedor com este documento');
      }
    }
    
    // Atualizar fornecedor
    supplier.name = name || supplier.name;
    supplier.companyName = companyName !== undefined ? companyName : supplier.companyName;
    supplier.document = document !== undefined ? document : supplier.document;
    supplier.email = email !== undefined ? email : supplier.email;
    supplier.phone = phone !== undefined ? phone : supplier.phone;
    
    if (address) {
      supplier.address = {
        street: address.street || supplier.address?.street,
        number: address.number || supplier.address?.number,
        complement: address.complement || supplier.address?.complement,
        neighborhood: address.neighborhood || supplier.address?.neighborhood,
        city: address.city || supplier.address?.city,
        state: address.state || supplier.address?.state,
        zipCode: address.zipCode || supplier.address?.zipCode
      };
    }
    
    if (contactPerson) {
      supplier.contactPerson = {
        name: contactPerson.name || supplier.contactPerson?.name,
        phone: contactPerson.phone || supplier.contactPerson?.phone,
        email: contactPerson.email || supplier.contactPerson?.email
      };
    }
    
    supplier.categories = categories || supplier.categories;
    supplier.paymentTerms = paymentTerms !== undefined ? paymentTerms : supplier.paymentTerms;
    supplier.minOrderValue = minOrderValue !== undefined ? minOrderValue : supplier.minOrderValue;
    supplier.observations = observations !== undefined ? observations : supplier.observations;
    supplier.isActive = isActive !== undefined ? isActive : supplier.isActive;
    
    const updatedSupplier = await supplier.save();
    res.json(updatedSupplier);
  } else {
    res.status(404);
    throw new Error('Fornecedor não encontrado');
  }
});

/**
 * @desc    Excluir um fornecedor
 * @route   DELETE /api/suppliers/:id
 * @access  Private/Admin
 */
const deleteSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);
  
  if (supplier) {
    // Verificar se o fornecedor está associado a produtos
    const productCount = await Product.countDocuments({ supplier: supplier._id });
    
    if (productCount > 0) {
      // Em vez de excluir, apenas marcar como inativo
      supplier.isActive = false;
      await supplier.save();
      res.json({ message: 'Fornecedor marcado como inativo' });
    } else {
      // Se não tiver produtos associados, pode excluir
      await supplier.deleteOne();
      res.json({ message: 'Fornecedor removido' });
    }
  } else {
    res.status(404);
    throw new Error('Fornecedor não encontrado');
  }
});

/**
 * @desc    Obter produtos de um fornecedor
 * @route   GET /api/suppliers/:id/products
 * @access  Private
 */
const getSupplierProducts = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || config.pagination.defaultLimit;
  const page = parseInt(req.query.page) || 1;
  
  const count = await Product.countDocuments({ supplier: req.params.id });
  
  const products = await Product.find({ supplier: req.params.id })
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ name: 1 });
  
  res.json({
    products,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

/**
 * @desc    Obter fornecedores por categoria
 * @route   GET /api/suppliers/by-category
 * @access  Private
 */
const getSuppliersByCategory = asyncHandler(async (req, res) => {
  const categories = ['Essências', 'Tabaco', 'Acessórios', 'Narguilés', 'Carvão', 'Bebidas', 'Outros'];
  
  const result = await Promise.all(
    categories.map(async (category) => {
      const count = await Supplier.countDocuments({ 
        categories: category,
        isActive: true
      });
      
      return {
        category,
        count
      };
    })
  );
  
  res.json(result);
});

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
  getSuppliersByCategory
};