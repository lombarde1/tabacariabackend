const express = require('express');
const router = express.Router();
const {
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
  getProductsTable // Nova função
} = require('../controllers/productController');
const { protect, admin } = require('../middlewares/auth');

// Todas as rotas são protegidas com autenticação
router.use(protect);

router.route('/')
  .get(getProducts)
  .post(createProduct);

router.route('/low-stock')
  .get(getLowStockProducts);

router.route('/categories')
  .get(getProductsByCategory);

// Nova rota para tabela WhatsApp
router.route('/tabela')
  .get(getProductsTable);

router.route('/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(admin, deleteProduct);

router.route('/:id/stock')
  .put(updateProductStock);

router.route('/:id/inventory')
  .get(getProductInventory);

// Rotas para gerenciamento de imagens
router.route('/:id/image')
  .put(addProductImage);

router.route('/:id/image/:index')
  .delete(removeProductImage);

router.route('/:id/images/reorder')
  .put(reorderProductImages);

module.exports = router;