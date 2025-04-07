const express = require('express');
const router = express.Router();
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientSales,
  updateLoyaltyPoints,
  getTopClients
} = require('../controllers/clientController');
const { protect, admin } = require('../middlewares/auth');

// Todas as rotas são protegidas com autenticação
router.use(protect);

router.route('/')
  .get(getClients)
  .post(createClient);

router.route('/top')
  .get(getTopClients);

router.route('/:id')
  .get(getClientById)
  .put(updateClient)
  .delete(admin, deleteClient);

router.route('/:id/sales')
  .get(getClientSales);

router.route('/:id/loyalty')
  .put(updateLoyaltyPoints);

module.exports = router;