const express = require('express');
const router = express.Router();
const {
  getSales,
  getSaleById,
  createSale,
  updateSalePayment,
  cancelSale,
  getSalesByPeriod,
  getTopProducts
} = require('../controllers/saleController');
const { protect, admin } = require('../middlewares/auth');

// Todas as rotas são protegidas com autenticação
router.use(protect);

router.route('/')
  .get(getSales)
  .post(createSale);

router.route('/by-period')
  .get(getSalesByPeriod);

router.route('/top-products')
  .get(getTopProducts);

router.route('/:id')
  .get(getSaleById);

router.route('/:id/payment')
  .put(updateSalePayment);

router.route('/:id/cancel')
  .put(admin, cancelSale);

module.exports = router;