const express = require('express');
const router = express.Router();
const {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
  getUserById,
  updateUser
} = require('../controllers/userController');
const { protect, admin } = require('../middlewares/auth');

// Rotas públicas
router.post('/login', loginUser);

// Rotas privadas
router.route('/profile')
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

// Rotas de administrador
router.route('/')
  .post(protect, admin, registerUser)
  .get(protect, admin, getUsers);

router.route('/:id')
  .delete(protect, admin, deleteUser)
  .get(protect, admin, getUserById)
  .put(protect, admin, updateUser);

module.exports = router;