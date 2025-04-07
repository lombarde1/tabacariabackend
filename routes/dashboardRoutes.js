const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getSalesAnalysis,
  getInventoryAnalysis,
  getClientAnalysis
} = require('../controllers/dashboardController');
const { protect } = require('../middlewares/auth');

// Todas as rotas são protegidas com autenticação
router.use(protect);

router.route('/')
  .get(getDashboardStats);

router.route('/sales-analysis')
  .get(getSalesAnalysis);

router.route('/inventory-analysis')
  .get(getInventoryAnalysis);

router.route('/client-analysis')
  .get(getClientAnalysis);

module.exports = router;