const express = require('express');
const router = express.Router();
const {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
  getSuppliersByCategory
} = require('../controllers/supplierController');
const { protect, admin } = require('../middlewares/auth');

// Todas as rotas são protegidas com autenticação
router.use(protect);

router.route('/')
  .get(getSuppliers)
  .post(createSupplier);

router.route('/by-category')
  .get(getSuppliersByCategory);

router.route('/:id')
  .get(getSupplierById)
  .put(updateSupplier)
  .delete(admin, deleteSupplier);

router.route('/:id/products')
  .get(getSupplierProducts);

module.exports = router;