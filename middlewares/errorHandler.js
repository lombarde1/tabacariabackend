/**
 * Middleware para tratamento de erros
 */
const errorHandler = (err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    // Log do erro no console
    console.error(err.stack);
    
    res.status(statusCode).json({
      success: false,
      message: err.message || 'Erro interno do servidor',
      stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
  };
  
  module.exports = { errorHandler };