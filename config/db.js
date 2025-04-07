const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Usar a URL do MongoDB fornecida ou a do arquivo .env
    const dbUrl = process.env.MONGO_URI || 'mongodb://darkvips:lombarde1@147.79.111.143:27017/sobretabacaria?authSource=admin';
    
    const conn = await mongoose.connect(dbUrl);
    
    console.log(`MongoDB Conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Erro ao conectar ao MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB };