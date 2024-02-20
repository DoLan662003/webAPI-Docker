const express = require('express');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');


const app = express();
const port = 5000;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: '123',
  port: 5432,
});

app.use(express.json());

// Middleware để kiểm tra lỗi và trả về thông báo lỗi nếu có
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Endpoint chào mừng
app.get('/', (req, res) => {
  res.send('Hello, this is the home page!');
});

// Endpoint lấy danh sách sinh viên
app.get('/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint lấy thông tin sinh viên theo ID
app.get('/students/:id', async (req, res) => {
  const studentId = req.params.id;
  try {
    const result = await pool.query('SELECT * FROM students WHERE id = $1', [studentId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Student not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint thêm sinh viên mới
app.post('/students',
  async (req, res) => {
    const { name, major,age } = req.body;
    console.log(name, major, age);
    
    try {
      const query = `INSERT INTO students (id, name, major, age) VALUES (6 ,'{${name}}', '{${major}}', ${age}) RETURNING *`;
      const result = await pool.query(query);
    //   console.log(result);
      res.json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);
// Sửa thông tin sinh viên theo ID
app.put('/students/:id', async (req, res) => {
  const studentId = req.params.id;
  const { name, major, age } = req.body;
  try {
    const query = 'UPDATE students SET name = $1, major = $2, age = $3 WHERE id = $4 RETURNING *';
    const result = await pool.query(query, [name, major, age, studentId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Student not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint xóa sinh viên theo ID
app.delete('/students/:id', async (req, res) => {
  const studentId = req.params.id;
  try {
    const query = 'DELETE FROM students WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [studentId]);
    if (result.rows.length > 0) {
      res.json({ message: 'Student deleted successfully' });
    } else {
      res.status(404).json({ error: 'Student not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});