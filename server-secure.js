const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const morgan = require('morgan');
const https = require('https');
const fs = require('fs');
const helmet = require('helmet');

const app = express();

// =============================================
// 1. Middleware
// =============================================
app.use(bodyParser.json());
app.use(helmet()); // Защита HTTP-заголовков
app.use(morgan('combined')); // Логирование запросов

// =============================================
// 2. Конфигурация MySQL
// =============================================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'your_password',
  database: 'pc_inventory',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Проверка подключения к БД
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Подключено к MySQL');
    conn.release();
  } catch (err) {
    console.error('❌ Ошибка подключения к MySQL:', err);
    process.exit(1);
  }
})();

// =============================================
// 3. Аутентификация по API-ключу
// =============================================
const API_KEYS = new Set(['SECRET_KEY_123', 'BACKUP_KEY_456']); // Храните ключи в env на проде!

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || !API_KEYS.has(apiKey)) {
    return res.status(403).json({ 
      success: false,
      error: 'Invalid or missing API key' 
    });
  }
  next();
};

app.use(authMiddleware); // Применяем ко всем роутам

// =============================================
// 4. Обработка данных с валидацией
// =============================================
app.post('/api/pc-data', async (req, res) => {
  const { pcName, cpu, ram, os, disks, ip, mac, timestamp } = req.body;

  // Валидация обязательных полей
  if (!pcName || !cpu || !ram || !os) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields (pcName, cpu, ram, os)'
    });
  }

  // Проверка серийных номеров дисков
  const validatedDisks = disks.map(disk => ({
    model: disk.model || 'Unknown',
    size: disk.size || 'N/A',
    serial: disk.serial || (() => {
      console.warn('⚠️ Disk serial missing for model:', disk.model);
      return 'NOT_PROVIDED';
    })()
  }));

  try {
    const [result] = await pool.query(
      `INSERT INTO computers 
       (pc_name, cpu, ram, os, disks, ip, mac, timestamp) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [pcName, cpu, ram, os, JSON.stringify(validatedDisks), ip, mac, timestamp]
    );

    res.status(200).json({ 
      success: true,
      message: 'Data saved to MySQL',
      insertedId: result.insertId 
    });
  } catch (error) {
    console.error('❌ MySQL error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Database error',
      details: error.message 
    });
  }
});

// =============================================
// 5. Запуск HTTPS-сервера
// =============================================
const SSL_KEY = fs.readFileSync('./selfsigned.key', 'utf8');
const SSL_CERT = fs.readFileSync('./selfsigned.crt', 'utf8');

const credentials = {
  key: SSL_KEY,
  cert: SSL_CERT
};

const PORT = 443;
https.createServer(credentials, app)
  .listen(PORT, () => {
    console.log(`🚀 Secure server running on https://localhost:${PORT}`);
  });

// Обработка непредвиденных ошибок
process.on('unhandledRejection', (err) => {
  console.error('⚠️ Unhandled rejection:', err);
});