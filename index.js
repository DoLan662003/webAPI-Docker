const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = 3000;

const pool = new Pool({
  user: 'user',
  host: 'db',
  database: 'students',
  password: 'password',
  port: 5432,
});

app.use(express.json());

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
app.post('/students', async (req, res) => {
  const { name, age, major } = req.body;
  try {
    const result = await pool.query('INSERT INTO students (name, age, major) VALUES ($1, $2, $3) RETURNING *', [name, age, major]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint sửa đổi thông tin sinh viên theo ID
app.put('/students/:id', async (req, res) => {
  const studentId = req.params.id;
  const { name, age, major } = req.body;
  try {
    const result = await pool.query('UPDATE students SET name = $1, age = $2, major = $3 WHERE id = $4 RETURNING *', [name, age, major, studentId]);
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
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [studentId]);
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
