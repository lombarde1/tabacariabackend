const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const InventoryTransaction = require('../models/Inventory');
const config = require('../config/config');

/**
 * @desc    Obter todos os produtos
 * @route   GET /api/products
 * @access  Private
 */
const getProducts = asyncHandler(async (req, res) => {
  const pageSize = parseInt(req.query.limit) || config.pagination.defaultLimit;
  const page = parseInt(req.query.page) || 1;
  
  const keyword = req.query.keyword
    ? {
        $or: [
          { name: { $regex: req.query.keyword, $options: 'i' } },
          { description: { $regex: req.query.keyword, $options: 'i' } }
        ]
      }
    : {};
    
  const category = req.query.category ? { category: req.query.category } : {};
  const isActive = req.query.isActive !== undefined ? { isActive: req.query.isActive === 'true' } : {};
  const lowStock = req.query.lowStock 
    ? { $expr: { $lte: ['$stock', '$minStock'] } }
    : {};
  
  const query = {
    ...keyword,
    ...category,
    ...isActive,
    ...lowStock
  };
  
  const count = await Product.countDocuments(query);
  
  const products = await Product.find(query)
    .populate('supplier', 'name')
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ createdAt: -1 });
  
  res.json({
    products,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

/**
 * @desc    Obter um produto por ID
 * @route   GET /api/products/:id
 * @access  Private
 */
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('supplier', 'name companyName phone email');
  
  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
});

/**
 * @desc    Criar um produto
 * @route   POST /api/products
 * @access  Private
 */
const createProduct = asyncHandler(async (req, res) => {
    const {
        name,
        description,
        category,
        price,
        costPrice,
        stock,
        minStock,
        barcode,
        supplier,
        expiryDate,
        attributes,
        imageUrl,
        flavors // 👈 novo campo aqui
      } = req.body;
      
  
  // Verificar se já existe um produto com o mesmo código de barras
  if (barcode) {
    const existingProduct = await Product.findOne({ barcode });
    if (existingProduct) {
      res.status(400);
      throw new Error('Já existe um produto com este código de barras');
    }
  }
  
  // Processar imagens
  let images = [];
  if (imageUrl) {
    // Se imageUrl for um array, usa todas as URLs
    if (Array.isArray(imageUrl)) {
      images = imageUrl;
    } else {
      // Se for uma string, adiciona como primeira imagem
      images = [imageUrl];
    }
  }
  
  const product = await Product.create({
    name,
    description,
    category,
    price,
    costPrice,
    stock,
    minStock: minStock || 5,
    barcode,
    supplier,
    expiryDate,
    attributes: attributes || {},
    images,
    user: req.user._id,
    flavors: flavors || [],

  });
  
  if (product) {
    // Registrar transação de estoque inicial, se houver
    if (stock > 0) {
      await InventoryTransaction.create({
        product: product._id,
        type: 'entrada',
        quantity: stock,
        previousStock: 0,
        newStock: stock,
        costPrice,
        reason: 'Estoque inicial',
        user: req.user._id
      });
    }
    
    res.status(201).json(product);
  } else {
    res.status(400);
    throw new Error('Dados de produto inválidos');
  }
});

/**
 * @desc    Atualizar um produto
 * @route   PUT /api/products/:id
 * @access  Private
 */
const updateProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    price,
    costPrice,
    stock,
    minStock,
    barcode,
    supplier,
    expiryDate,
    isActive,
    flavors, // 👈 novo campo

    attributes,
    images // Pode receber um array completo de imagens para substituir
  } = req.body;
  
  const product = await Product.findById(req.params.id);
  
  if (product) {
    // Verificar se há outro produto com o mesmo código de barras
    if (barcode && barcode !== product.barcode) {
      const existingProduct = await Product.findOne({ barcode });
      if (existingProduct) {
        res.status(400);
        throw new Error('Já existe um produto com este código de barras');
      }
    }
    
    
    // Verificar se houve alteração no estoque
    const previousStock = product.stock;
    const newStock = stock !== undefined ? Number(stock) : previousStock;
    
    if (newStock !== previousStock) {
      // Registrar transação de ajuste de estoque
      await InventoryTransaction.create({
        product: product._id,
        type: 'ajuste',
        quantity: newStock - previousStock,
        previousStock,
        newStock,
        costPrice: product.costPrice,
        reason: 'Ajuste de estoque via edição de produto',
        user: req.user._id
      });
    }
    
    // Atualizar produto
    product.name = name || product.name;
    product.description = description || product.description;
    product.category = category || product.category;
    product.price = price !== undefined ? price : product.price;
    product.costPrice = costPrice !== undefined ? costPrice : product.costPrice;
    product.stock = newStock;
    product.minStock = minStock !== undefined ? minStock : product.minStock;
    product.barcode = barcode || product.barcode;
    product.supplier = supplier || product.supplier;
    product.expiryDate = expiryDate || product.expiryDate;
    product.isActive = isActive !== undefined ? isActive : product.isActive;
    if (flavors) {
        product.flavors = flavors;
      }
      
    // Atualiza as imagens se fornecidas
    if (images) {
      product.images = images;
    }
    
    if (attributes) {
      product.attributes = attributes;
    }
    
    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } else {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
});

/**
 * @desc    Excluir um produto
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  
  if (product) {
    // Verificar se o produto já foi usado em vendas
    const inventoryCount = await InventoryTransaction.countDocuments({
      product: product._id,
      type: 'venda'
    });
    
    if (inventoryCount > 0) {
      // Em vez de excluir, apenas marcar como inativo
      product.isActive = false;
      await product.save();
      res.json({ message: 'Produto marcado como inativo' });
    } else {
      // Se não tiver vendas, pode excluir
      await product.deleteOne();
      await InventoryTransaction.deleteMany({ product: product._id });
      res.json({ message: 'Produto removido' });
    }
  } else {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
});

/**
 * @desc    Atualizar estoque de um produto
 * @route   PUT /api/products/:id/stock
 * @access  Private
 */
const updateProductStock = asyncHandler(async (req, res) => {
  const { quantity, reason, type } = req.body;
  
  if (!quantity || !type || !['entrada', 'saida', 'ajuste'].includes(type)) {
    res.status(400);
    throw new Error('Informe a quantidade e o tipo de movimentação (entrada, saida ou ajuste)');
  }
  
  const product = await Product.findById(req.params.id);
  
  if (product) {
    const previousStock = product.stock;
    let newStock;
    
    if (type === 'entrada') {
      newStock = previousStock + Number(quantity);
    } else if (type === 'saida') {
      newStock = previousStock - Number(quantity);
      if (newStock < 0) {
        res.status(400);
        throw new Error('Estoque insuficiente');
      }
    } else {
      // Ajuste direto
      newStock = Number(quantity);
    }
    
    // Atualizar estoque do produto
    product.stock = newStock;
    await product.save();
    
    // Registrar transação de estoque
    await InventoryTransaction.create({
      product: product._id,
      type,
      quantity: type === 'ajuste' ? newStock - previousStock : Number(quantity),
      previousStock,
      newStock,
      costPrice: product.costPrice,
      reason: reason || `Movimentação de estoque: ${type}`,
      user: req.user._id
    });
    
    res.json({
      message: 'Estoque atualizado com sucesso',
      stock: newStock
    });
  } else {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
});

/**
 * @desc    Obter histórico de estoque de um produto
 * @route   GET /api/products/:id/inventory
 * @access  Private
 */
const getProductInventory = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
  
  const pageSize = parseInt(req.query.limit) || config.pagination.defaultLimit;
  const page = parseInt(req.query.page) || 1;
  
  const count = await InventoryTransaction.countDocuments({
    product: req.params.id
  });
  
  const transactions = await InventoryTransaction.find({ product: req.params.id })
    .populate('user', 'name')
    .limit(pageSize)
    .skip(pageSize * (page - 1))
    .sort({ createdAt: -1 });
  
  res.json({
    transactions,
    page,
    pages: Math.ceil(count / pageSize),
    total: count
  });
});

/**
 * @desc    Obter produtos com estoque baixo
 * @route   GET /api/products/low-stock
 * @access  Private
 */
const getLowStockProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({
    $expr: { $lte: ['$stock', '$minStock'] },
    isActive: true
  }).sort({ stock: 1 });
  
  res.json(products);
});

/**
 * @desc    Obter produtos por categoria
 * @route   GET /api/products/categories
 * @access  Private
 */
const getProductsByCategory = asyncHandler(async (req, res) => {
  const categories = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { _id: 1 } }
  ]);
  
  res.json(categories);
});

/**
 * @desc    Adicionar/atualizar imagem a um produto
 * @route   PUT /api/products/:id/image
 * @access  Private
 */
const addProductImage = asyncHandler(async (req, res) => {
  const { imageUrl, imageIndex } = req.body;
  
  if (!imageUrl) {
    res.status(400);
    throw new Error('URL da imagem é obrigatória');
  }
  
  const product = await Product.findById(req.params.id);
  
  if (product) {
    // Inicializa o array de imagens se não existir
    if (!product.images) {
      product.images = [];
    }
    
    // Se um índice for fornecido, atualiza a imagem nessa posição
    if (imageIndex !== undefined && !isNaN(imageIndex)) {
      if (imageIndex < product.images.length) {
        product.images[imageIndex] = imageUrl;
      } else {
        // Se o índice for maior que o tamanho do array, adiciona ao final
        product.images.push(imageUrl);
      }
    } else {
      // Adiciona a nova imagem ao final do array
      product.images.push(imageUrl);
    }
    
    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } else {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
});

/**
 * @desc    Remover imagem de um produto
 * @route   DELETE /api/products/:id/image/:index
 * @access  Private
 */
const removeProductImage = asyncHandler(async (req, res) => {
  const index = parseInt(req.params.index);
  
  if (isNaN(index)) {
    res.status(400);
    throw new Error('Índice inválido');
  }
  
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
  
  if (!product.images || index >= product.images.length) {
    res.status(404);
    throw new Error('Imagem não encontrada');
  }
  
  // Remove a imagem do array
  product.images.splice(index, 1);
  
  const updatedProduct = await product.save();
  res.json(updatedProduct);
});

/**
 * @desc    Reordenar imagens de um produto
 * @route   PUT /api/products/:id/images/reorder
 * @access  Private
 */
const reorderProductImages = asyncHandler(async (req, res) => {
  const { order } = req.body;
  
  if (!Array.isArray(order)) {
    res.status(400);
    throw new Error('A ordem das imagens deve ser um array');
  }
  
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    res.status(404);
    throw new Error('Produto não encontrado');
  }
  
  if (!product.images || product.images.length === 0) {
    res.status(400);
    throw new Error('O produto não possui imagens');
  }
  
  if (order.length !== product.images.length) {
    res.status(400);
    throw new Error('A quantidade de índices não corresponde à quantidade de imagens');
  }
  
  // Verifica se todos os índices são válidos
  const validIndices = order.every(index => 
    typeof index === 'number' && 
    index >= 0 && 
    index < product.images.length
  );
  
  if (!validIndices) {
    res.status(400);
    throw new Error('Índices inválidos');
  }
  
  // Reordena as imagens
  const reorderedImages = order.map(index => product.images[index]);
  product.images = reorderedImages;
  
  const updatedProduct = await product.save();
  res.json(updatedProduct);
});

/**
 * @desc    Gerar tabela de produtos formatada para WhatsApp
 * @route   GET /api/products/tabela
 * @access  Private
 */
const getProductsTable = asyncHandler(async (req, res) => {
    const selectedCategory = req.query.categoria;
  
    const filter = {
      isActive: true,
      stock: { $gt: 0 }
    };
  
    if (selectedCategory) {
      filter.category = selectedCategory;
    }
  
    const products = await Product.find(filter).sort({ category: 1, name: 1 });
  
    if (!products || products.length === 0) {
      return res.json({
        table: "Nenhum produto disponível no momento"
      });
    }
  
    const productsByCategory = products.reduce((acc, product) => {
      const category = product.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(product);
      return acc;
    }, {});
  
    const categoryEmojis = {
      'Essências': '💨',
      'Tabaco': '🚬',
      'Acessórios': '🔧',
      'Narguilés': '💭',
      'Carvão': '🔥',
      'Bebidas': '🥤',
      'pod': '🔥',
      'Pod': '🔥',
      'Outros': '🎁'
    };
  
    let table = "";
  
    Object.keys(productsByCategory).forEach(category => {
      const products = productsByCategory[category];
  
      if (products.length > 0) {
        const categoryEmoji = categoryEmojis[category] || '📦';
        table += `\n━━━━━━━━━\n${categoryEmoji} *${category.toUpperCase()}* ${categoryEmoji}\n━━━━━━━━━\n\n`;
  
        products.forEach(product => {
          const formattedPrice = product.price.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          });
  
          table += `*${product.name.toUpperCase()}:* *${formattedPrice}*\n`;
  
          // Exibir sabores apenas se houver e estiverem no campo flavors
          if (['Pod', 'pod', 'Essências'].includes(category) && Array.isArray(product.flavors) && product.flavors.length > 0) {
            table += `_Sabores disponíveis:_\n\n`;
            product.flavors.forEach(flavor => {
              table += `   • *${flavor}*\n`;
            });
          }
  
          if (product.isLowStock) {
            table += `⚠️ *Últimas unidades!* ⚠️\n`;
          }
  
          table += `\n`;
        });
      }
    });
  
    table += "\n━━━━━━━━━\n";
    table += "💬 *Avise qual tiver interesse!*\n";
  
    table = table.trim();
  
    res.json({ table });
  });
  
  // Atualizar o module.exports para incluir a nova função
  module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    updateProductStock,
    getProductInventory,
    getLowStockProducts,
    getProductsByCategory,
    addProductImage,
    removeProductImage,
    reorderProductImages,
    getProductsTable // Nova função adicionada
  };