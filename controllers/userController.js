const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

/**
 * Gerar token JWT
 */
const generateToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtExpire
  });
};

/**
 * @desc    Autenticar usuário & obter token
 * @route   POST /api/users/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Verificar email e senha
  if (!email || !password) {
    res.status(400);
    throw new Error('Por favor, informe email e senha');
  }
  
  // Verificar se o usuário existe
  const user = await User.findOne({ email }).select('+password');
  
  if (user && (await user.matchPassword(password))) {
    // Atualizar último login
    user.lastLogin = Date.now();
    await user.save();
    
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user._id)
    });
  } else {
    res.status(401);
    throw new Error('Email ou senha inválidos');
  }
});

/**
 * @desc    Registrar um novo usuário
 * @route   POST /api/users
 * @access  Private/Admin
 */
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, isAdmin, phone } = req.body;
  
  // Verificar se usuário já existe
  const userExists = await User.findOne({ email });
  
  if (userExists) {
    res.status(400);
    throw new Error('Usuário já existe');
  }
  
  // Criar usuário
  const user = await User.create({
    name,
    email,
    password,
    isAdmin,
    phone
  });
  
  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      phone: user.phone
    });
  } else {
    res.status(400);
    throw new Error('Dados de usuário inválidos');
  }
});

/**
 * @desc    Obter perfil do usuário
 * @route   GET /api/users/profile
 * @access  Private
 */
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      phone: user.phone,
      lastLogin: user.lastLogin
    });
  } else {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }
});

/**
 * @desc    Atualizar perfil do usuário
 * @route   PUT /api/users/profile
 * @access  Private
 */
const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    
    if (req.body.password) {
      user.password = req.body.password;
    }
    
    const updatedUser = await user.save();
    
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      phone: updatedUser.phone,
      token: generateToken(updatedUser._id)
    });
  } else {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }
});

/**
 * @desc    Obter todos os usuários
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

/**
 * @desc    Excluir usuário
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (user) {
    await user.deleteOne();
    res.json({ message: 'Usuário removido' });
  } else {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }
});

/**
 * @desc    Obter usuário por ID
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  
  if (user) {
    res.json(user);
  } else {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }
});

/**
 * @desc    Atualizar usuário
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  
  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.phone = req.body.phone || user.phone;
    user.isAdmin = req.body.isAdmin !== undefined ? req.body.isAdmin : user.isAdmin;
    
    if (req.body.password) {
      user.password = req.body.password;
    }
    
    const updatedUser = await user.save();
    
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      isAdmin: updatedUser.isAdmin,
      phone: updatedUser.phone
    });
  } else {
    res.status(404);
    throw new Error('Usuário não encontrado');
  }
});

module.exports = {
  loginUser,
  registerUser,
  getUserProfile,
  updateUserProfile,
  getUsers,
  deleteUser,
  getUserById,
  updateUser
};