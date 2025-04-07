// Configurações da aplicação
module.exports = {
    // JWT config
    jwtSecret: process.env.JWT_SECRET || 'tabacaria_jwt_secret',
    jwtExpire: process.env.JWT_EXPIRE || '30d',
    
    // Configurações de e-mail (para implementação futura)
    email: {
      service: process.env.EMAIL_SERVICE || 'gmail',
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASSWORD
    },
    
    // Níveis de estoque
    stock: {
      lowThreshold: 5, // Alerta de estoque baixo quando quantidade < 5
      criticalThreshold: 2 // Alerta crítico quando quantidade < 2
    },
    
    // Configurações de paginação
    pagination: {
      defaultLimit: 10,
      maxLimit: 100
    }
  };