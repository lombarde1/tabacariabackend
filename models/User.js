const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Por favor, informe o nome']
    },
    email: {
      type: String,
      required: [true, 'Por favor, informe o email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Por favor, forneça um email válido'
      ]
    },
    password: {
      type: String,
      required: [true, 'Por favor, informe a senha'],
      minlength: [6, 'A senha deve ter pelo menos 6 caracteres'],
      select: false
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    phone: {
      type: String
    },
    lastLogin: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Encriptar senha usando bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Método para comparar senha informada com a senha armazenada
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);