const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Supplier = require('../models/Supplier');
const { connectDB } = require('./db');

// Dados iniciais
const users = [
  {
    name: 'Admin User',
    email: 'admin@tabacaria.com',
    password: '123456',
    isAdmin: true
  },
  {
    name: 'Vendedor 1',
    email: 'vendedor1@tabacaria.com',
    password: '123456',
    isAdmin: false
  }
];

const suppliers = [
  {
    name: 'Chefe Tabacaria',
    companyName: 'Shopping Pagé',
    document: '12345678000190',
    email: 'contato@essenciaspremium.com',
    phone: '(11) 98765-4321',
    categories: ['Essências'],
    address: {
      street: 'Rua das Essências',
      number: '123',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-567'
    }
  }
];
/*/
const products = [
  {
    name: 'Essência Zomo Strong Mint',
    description: 'Essência para narguilé com sabor de menta forte',
    category: 'Essências',
    price: 15.90,
    costPrice: 8.50,
    stock: 20,
    minStock: 5
  },
  {
    name: 'Essência Adalya Love 66',
    description: 'Essência importada com sabor de melancia, melão e menta',
    category: 'Essências',
    price: 25.90,
    costPrice: 14.50,
    stock: 15,
    minStock: 3
  },
  {
    name: 'Narguilé Pequeno Zeus',
    description: 'Narguilé compacto com 35cm de altura',
    category: 'Narguilés',
    price: 120.00,
    costPrice: 65.00,
    stock: 8,
    minStock: 2
  },
  {
    name: 'Carvão Coco Premium',
    description: 'Carvão de coco para narguilé, caixa com 250g',
    category: 'Carvão',
    price: 18.90,
    costPrice: 9.50,
    stock: 30,
    minStock: 10
  },
  {
    name: 'Mangueira Silicone',
    description: 'Mangueira de silicone lavável para narguilé',
    category: 'Acessórios',
    price: 45.00,
    costPrice: 22.00,
    stock: 12,
    minStock: 3
  }
];

const clients = [
  {
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '(11) 99876-5432',
    loyaltyPoints: 25,
    document: '123.456.789-00',
    address: {
      street: 'Rua dos Clientes',
      number: '123',
      neighborhood: 'Vila Mariana',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '04567-000'
    }
  },
  {
    name: 'Maria Oliveira',
    email: 'maria@email.com',
    phone: '(11) 98765-4321',
    loyaltyPoints: 40,
    document: '987.654.321-00',
    address: {
      street: 'Av. Paulista',
      number: '1000',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01234-000'
    }
  },
  {
    name: 'Pedro Santos',
    email: 'pedro@email.com',
    phone: '(11) 91234-5678',
    loyaltyPoints: 10,
    document: '111.222.333-44',
    address: {
      street: 'Rua Augusta',
      number: '500',
      neighborhood: 'Consolação',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01304-000'
    }
  }
];
/*/
// Função para importar dados
const importData = async () => {
  try {
    // Conectar ao banco de dados
    await connectDB();
    
    // Limpar dados existentes
    await User.deleteMany();
    await Supplier.deleteMany();
    await Product.deleteMany();
    await Client.deleteMany();
    
    console.log('Dados antigos removidos');
    
    // Criar usuários com senhas criptografadas
    const createdUsers = [];
    for (let user of users) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
      createdUsers.push(user);
    }
    
    await User.insertMany(createdUsers);
    console.log('Usuários importados');
      /*/  
    // Criar fornecedores
    const createdSuppliers = await Supplier.insertMany(suppliers);
    console.log('Fornecedores importados');

    // Associar fornecedores aos produtos
    const productsWithSuppliers = products.map((product, index) => {
      // Associar o fornecedor adequado com base na categoria
      const supplier = product.category === 'Essências'
        ? createdSuppliers[0]._id
        : createdSuppliers[1]._id;
      
      return { ...product, supplier };
    });
    
    // Criar produtos
    await Product.insertMany(productsWithSuppliers);
    console.log('Produtos importados');
   
    // Criar clientes
    await Client.insertMany(clients);
    console.log('Clientes importados');
       /*/ 
    console.log('Importação concluída com sucesso');
    process.exit();
  } catch (error) {
    console.error(`Erro na importação: ${error.message}`);
    process.exit(1);
  }
};

// Executar importação
importData();