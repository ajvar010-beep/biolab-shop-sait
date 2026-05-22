const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // Устанавливаем UTF-8 для правильной работы с кириллицей
    mongoose.set('strictQuery', false);

    console.log('MongoDB подключена');
  } catch (error) {
    console.error('Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
