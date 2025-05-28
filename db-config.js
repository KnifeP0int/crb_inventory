const mysql = require('mysql2/promise');
const env=require('dotenv').config();


const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
  connectionLimit: 10,       // максимальное количество соединений в пуле
  queueLimit: 0,             // неограниченная очередь запросов
  timezone: '+00:00',        // временная зона UTC
  charset: 'utf8mb4',        // кодировка (поддерживает emoji)
  ssl: {
    // Если используется SSL (например, для облачных БД)
    // ca: fs.readFileSync('/path/to/ca.pem'),
    // cert: fs.readFileSync('/path/to/client-cert.pem'),
    // key: fs.readFileSync('/path/to/client-key.pem'),
    rejectUnauthorized: false // для самоподписанных сертификатов
  }
  };

  // 2. Создание пула соединений
const pool = mysql.createPool(dbConfig);

// 3. Проверка подключения (опционально)
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Успешное подключение к MySQL');
    connection.release();
  } catch (err) {
    console.error('❌ Ошибка подключения к MySQL:', err.message);
    process.exit(1); // Завершаем процесс при ошибке
  }
})();

// 4. Экспорт пула для использования в других файлах
module.exports = {
  pool
};
