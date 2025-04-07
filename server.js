const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const cors = require('cors');
const { connectDB } = require('./config/db');
const { errorHandler } = require('./middlewares/errorHandler');

// Carrega variáveis de ambiente
dotenv.config();

// Conecta ao banco de dados
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Logger de desenvolvimento
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rotas
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/sales', require('./routes/saleRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Rota base para verificar se a API está funcionando
app.get('/', (req, res) => {
  res.json({ message: 'API do CRM da Tabacaria funcionando!' });
});

// Middleware de tratamento de erros
app.use(errorHandler);

// Definir porta e iniciar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando no modo ${process.env.NODE_ENV} na porta ${PORT}`);
});