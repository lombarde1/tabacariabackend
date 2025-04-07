const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const config = require('../config/config');

/**
 * Middleware de proteção de rotas
 * Verifica se o usuário está autenticado
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;
  
  // Verificar se o token está no header de autorização
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Obter token do header
      token = req.headers.authorization.split(' ')[1];
      
      // Verificar token
      const decoded = jwt.verify(token, config.jwtSecret);
      
      // Obter usuário do token
      req.user = await User.findById(decoded.id).select('-password');
      
      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error('Não autorizado, token inválido');
    }
  }
  
  if (!token) {
    res.status(401);
    throw new Error('Não autorizado, token não encontrado');
  }
});

/**
 * Middleware para verificar se o usuário é admin
 */
const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    res.status(403);
    throw new Error('Não autorizado como administrador');
  }
};

module.exports = { protect, admin };