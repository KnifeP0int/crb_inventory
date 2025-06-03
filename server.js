const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const { pool } = require('./db-config');
const app = express();
require('dotenv').config();

// =============================================
// 1. Настройка шаблонизатора EJS
// =============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public'));

// Добавьте эти строки ПЕРЕД роутами:
app.use(express.urlencoded({ extended: true })); // для данных форм
app.use(express.json()); // для JSON данных (если будет API)

// =============================================
// 2. Сессии для авторизации админов
// =============================================
const sessionStore = new MySQLStore({
  database: 'pc_inventory',
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, pool);

app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Изменили на false для HTTP
}));

// =============================================
// 3. Роуты для веб-интерфейса
// =============================================
// Главная страница (логин)
app.get('/admin', (req, res) => {
  if (req.session.isAdmin) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

// Аутентификация
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (username === process.env.LOGIN && password === process.env.PASSWORD) {
    req.session.isAdmin = true;
    return res.redirect('/dashboard');
  }
  
  res.render('login', { error: 'Неверный логин или пароль' });
});

// Выход из системы
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin');
});

// Дашборд (просмотр данных)
app.get('/dashboard', async (req, res) => {
  if (!req.session.isAdmin) {
    return res.redirect('/admin');
  }

  const { pcName, ip, place_install, sort, order } = req.query;
  let query = 'SELECT * FROM computers';
  let params = [];
  let where = [];

  if (ip) {
    where.push('JSON_CONTAINS(network, JSON_OBJECT("ip", ?))');
    params.push(ip);
  }
  if (pcName) {
    where.push('pc_name LIKE ?');
    params.push(`%${pcName}%`);
  }
  if (place_install){
    where.push('place_install LIKE ?');
    params.push(`%${place_install}%`);
  }
  if (where.length){
    query += ' WHERE ' + where.join(' AND ');
  }

  const allowedSort = ['id', 'pc_name', 'timestamp', 'place_install'];
  let orderBy = 'timestamp DESC';
  if (sort && allowedSort.includes(sort)){
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
    orderBy =`${sort} ${sortOrder}`
  }
  query += ` ORDER BY ${orderBy} LIMIT 1000`;

  try {
    const [computers] = await pool.query(query, params);
    const baseQueryParams = {};
    if (pcName) baseQueryParams.pcName = pcName;
    if (ip) baseQueryParams.ip = ip;
    if (place_install) baseQueryParams.place_install = place_install;
    const baseQueryString = new URLSearchParams(baseQueryParams).toString();

    res.render('dashboard', { 
      computers: computers.map(pc => {
        // Функция для безопасного парсинга JSON
        const parseJsonField = (field) => {
          try {
            if (typeof field === 'string') {
              return JSON.parse(field);
            }
            return field || [];
          } catch (e) {
            console.error('Ошибка парсинга JSON:', e);
            return [];
          }
        };

        const disks = parseJsonField(pc.disks);
        const network = parseJsonField(pc.network);
        
        return {
          id: pc.id,
          pc_name: pc.pc_name,
          cpu: pc.cpu,
          ram: pc.ram,
          os: pc.os || 'Не указано',
          disks: disks.map(disk => ({
            size: disk.size || disk.Size || '',
            model: disk.model || disk.Model || '',
            serial: disk.serial || disk.Serial || '',
            type: disk.type || disk.Type || '',
            name: disk.name || disk.Name || ''
          })),
          network: network.map(net => ({
            ip: net.ip || net.IP || '',
            mac: net.mac || net.MAC || '',
            description: net.description || net.ifname || net.Description || 'Не указано'
          })),
          timestamp: pc.timestamp,
          place_install: pc.place_install
        };
      }),
      pcNameQuery: pcName || '',
      place_installQuery: place_install || '',
      searchQuery: ip || '',
      baseQueryString,
      currentSort: sort,
      currentOrder: order
    });
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    res.status(500).render('error', { 
      message: 'Ошибка БД',
      error: null,
      statusCode: 500
    });
  }
});


// Проверка подключения к БД
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Подключено к MySQL');
    connection.release();
  } catch (err) {
    console.error('❌ Ошибка подключения к MySQL:', err);
    process.exit(1);
  }
})();



// API для приёма данных от клиентов
app.post('/api/pc-data', async (req, res) => {
  const { pcName, cpu, ram, os, disks, network, timestamp } = req.body;
  
  //console.log(req.body);

  try {
    // Проверяем существование записи с таким именем компьютера
    const [existingRows] = await pool.query(
      'SELECT id FROM computers WHERE pc_name = ? LIMIT 1',
      [pcName]
    );
    
    let result;
    if (existingRows.length > 0) {
      // Если запись существует - обновляем
      const computerId = existingRows[0].id;
      [result] = await pool.query(
        `UPDATE computers 
         SET cpu = ?, ram = ?, os = ?, disks = ?, network = ?, timestamp = ?
         WHERE id = ?`,
        [
          cpu,
          ram,
          os,
          JSON.stringify(disks),
          JSON.stringify(network),
          timestamp,
          computerId
        ]
      );
      
      res.status(200).json({ 
        success: true,
        message: 'Данные компьютера успешно обновлены в MySQL!',
        updatedId: computerId
      });
    } else {
      // Если записи нет - вставляем новую
      [result] = await pool.query(
        `INSERT INTO computers 
         (pc_name, cpu, ram, os, disks, network, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          pcName, 
          cpu, 
          ram, 
          os, 
          JSON.stringify(disks), 
          JSON.stringify(network),
          timestamp
        ]
      );
      
      res.status(200).json({ 
        success: true,
        message: 'Данные компьютера успешно добавлены в MySQL!',
        insertedId: result.insertId 
      });
    }
  } catch (error) {
    console.error('❌ Ошибка работы с MySQL:', error);
    res.status(500).json({ 
      success: false,
      error: 'Ошибка сервера' 
    });
  }
});

// Обновление place_install
app.post('/api/update-place_install', async (req, res) => {
  let result;
  try {
    const { pcId, location } = req.body;
    
    console.log(req.body);

    // Обновление в базе данных

      [result] = await pool.query(
        `UPDATE computers 
         SET location = ?
         WHERE id = ?`,
        [
          location,
          pcId
        ]
      );
    res.json({ success: true });
    console.log('UPDATE RESULT:', result)
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/computers', async (req, res) => {
  const { pcName, ip, place_install, sort, order } = req.query;
  let query = 'SELECT * FROM computers';
  let params = [];
  let where = [];

  if (ip) {
    where.push('JSON_CONTAINS(network, JSON_OBJECT("ip", ?))');
    params.push(ip);
  }
  if (pcName) {
    where.push('pc_name LIKE ?');
    params.push(`%${pcName}%`);
  }
  if (place_install){
    where.push('place_install LIKE ?');
    params.push(`%${place_install}%`);
  }
  if (where.length){
    query += ' WHERE ' + where.join(' AND ');
  }
  const validSortFields = ['id', 'pc_name', 'timestamp', 'place_install'];
  const SortField = validSortFields.includes(sort) ? sort : 'timestamp'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${SortField} ${sortOrder} LIMIT 1000`;

  try {
    const [computers] = await pool.query(query, params);
    res.json(computers);
  } catch (error){
    res.status(500).json({error:'DB error'});
  }
});
// API для получения данных конкретного компьютера
app.get('/api/computers/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM computers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Компьютер не найден' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('❌ Ошибка получения данных:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});


// Запуск сервера
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
});