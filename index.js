const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pgp = require('pg-promise')();

const app = express();
const port = 5000;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: '123',
  port: 5432,
});

const db = pgp({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: '123',
  port: 5432,
});

app.use(express.json());

// Kiểm tra lỗi và trả về thông báo lỗi nếu có
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Xác minh JWT và lấy thông tin user từ token
// const authenticateJWT = (req, res, next) => {
//   let token = req.header('Authorization');
//   token = token.split('Bearer ')[1];
//   token = token.replace('Bearer', '');
//   token = token.trim();
//   if (!token) return res.status(401).json({ error: 'Unauthorized' });
//   jwt.verify(token, 'secret_key', (err, user) => {
//     if (err) {
//       return res.status(403).json({ error: 'Forbidden' });
//     }
//     req.user = user;
//     console.log('Authenticated User:', user);
//     next();
//   });
// };
const authenticateJWT = (req, res, next) => {
  let token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  token = token.split('Bearer ')[1];
  token = token.trim();

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, 'secret_key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Log để kiểm tra giá trị role
    console.log('Authenticated User:', user);
    
    req.user = user;
    next();
  });
};
// // Middleware để kiểm tra quyền admin
// const checkAdminRole = (req, res, next) => {
//   const { role } = req.user;
//   console.log('Role:', role);
//   if (role === 'admin') {
//     // Nếu là admin, cho phép truy cập
//     next();
//   } else {
//     res.status(403).json({ error: 'Forbidden' });
//   }
// };

// Endpoint đăng ký người dùng (Admin)
app.post(
  '/admin/register',
  [
    body('username').notEmpty().isString(),
    body('password').notEmpty().isString(),
  ],
  validate,
  async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const existingAdmin = await pool.query('SELECT * FROM admin_accounts WHERE username = $1', [username]);
      if (existingAdmin.rows.length > 0) {
        // Nếu username đã có trong database
        return res.status(409).json({ error: 'Username already taken' });
      }
      // Nếu username chưa có trong database
      await pool.query('INSERT INTO admin_accounts (username, password, is_admin) VALUES ($1, $2, true)', [username, hashedPassword]);
      res.json({ message: 'Admin registered successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// Endpoint đăng nhập (Admin)
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM admin_accounts WHERE username = $1', [username]);
    const admin = result.rows[0];

    if (admin && (await bcrypt.compare(password, admin.password))) {
      const accessToken = jwt.sign({ username: admin.username, role: 'admin' }, 'secret_key');
      res.json({ accessToken });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Endpoint sinh viên đăng nhập và tạo token
app.post('/students/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (user && (await bcrypt.compare(password, user.password))) {
      const role = user.is_admin ? 'admin' : 'student';
      const accessToken = jwt.sign({ username: user.username, role: role }, 'secret_key');
      res.json({ accessToken });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// // Kiểm tra quyền sinh viên
// const checkStudentRole = (req, res, next) => {
//   const { role, username } = req.user;

//   if (role === 'student' && req.params.username === username) {
//     // Nếu là sinh viên và xem thông tin bản thân, cho phép truy cập
//     next();
//   } else {
//     res.status(403).json({ error: 'Forbidden' });
//   }
// };

// Tạo và gửi OTP
const sendOTP = async (req, res, next) => {
  const { username } = req.body;

  try {
    const otp = crypto.randomInt(100000, 999999);
    await db.none('INSERT INTO otps (username, otp, is_verified) VALUES ($1, $2, $3)', [username, otp, false]);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'dothilan1123@gmail.com',
        pass: 'byqp xzzx tmkd ycdg ',
      },
    });

    const mailOptions = {
      from: 'dothilan1123@gmail.com',
      to: 'ktrang1313@gmail.com',
      subject: 'Verification Code',
      text: `Your OTP is ${otp}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error sending OTP' });
      } else {
        console.log(`Email sent: ${info.response}`);
        req.otp = otp;
        next();
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
// Endpoint gửi OTP
app.post('/students/send-otp', authenticateJWT, async (req, res) => {
  let otpSent = false;

  try {
    await sendOTP(req, res);
    otpSent = true;

    console.log('Authenticated User in /send-otp:', req.user);

    if (!res.headersSent) {
      res.json({ message: 'OTP sent successfully' });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
});

const verifyOTP = async (req, res, next) => {
  try {
    const { username, otp } = req.body;
    if (typeof username !== 'string' || typeof otp !== 'string') {
      throw new Error('Invalid OTP data');
    }

    const result = await db.one('SELECT * FROM otps WHERE username = $1 AND otp = $2 AND is_verified = $3', [username, otp, false]);
    await db.none('UPDATE otps SET is_verified = $1 WHERE id = $2', [true, result.id]);

    next();
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(401).json({ error: 'Invalid OTP' });
  }
};
// Endpoint xác thực OTP
app.post('/students/verify-otp', authenticateJWT, verifyOTP, (req, res) => {
  res.json({ message: 'OTP verified successfully' });
});

// Kiểm tra quyền sinh viên
const checkStudentRole = (req, res, next) => {
  const { role, username } = req.user;

  if (role === 'student' && req.params.username === username) {
    // Nếu là sinh viên và xem thông tin bản thân, cho phép truy cập
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
};

//Sinh viên chỉ được xem thông tin chính mình
app.get('/students/:username', authenticateJWT, checkStudentRole, async (req, res) => {
  try {
    // Lấy thông tin sinh viên từ cơ sở dữ liệu
    const result = await pool.query('SELECT * FROM students WHERE username = $1', [req.params.username]);
    
    if (result.rows.length > 0) {
      // Trả về thông tin của sinh viên
      const studentInfo = result.rows[0];
      res.json(studentInfo);
    } else {
      res.status(404).json({ error: 'Student not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Middleware để kiểm tra quyền admin
const checkAdminRole = (req, res, next) => {
  const { role } = req.user;
  console.log('Role:', role);
  if (role === 'admin') {
    // Nếu là admin, cho phép truy cập
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
};

// Admin thêm sinh viên mới
app.post('/students', authenticateJWT, checkAdminRole, async (req, res) => {
  const { name, major, age, username } = req.body;

  try {
    const query = 'INSERT INTO students (name, major, age, username) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(query, [name, major, age, username]);
    
    res.json({ message: 'Student added successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Admin sửa thông tin sinh viên theo ID
app.put('/students/:id', authenticateJWT, checkAdminRole, async (req, res) => {
  const studentId = req.params.id;
  const { name, major, age, username } = req.body;

  try {
    const query = 'UPDATE students SET name = $1, major = $2, age = $3, username = $4 WHERE id = $5 RETURNING *';
    const result = await pool.query(query, [name, major, age, username, studentId]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Student not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
//Admin xóa thông tin sinh viên theo id
app.delete('/students/:id', authenticateJWT, checkAdminRole, async (req, res) => {
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
// Kiểm tra quyền sinh viên/admin
const checkUserRole = (req, res, next) => {
  const { role, username } = req.user;

  if (role === 'admin') {
    // Nếu là admin, cho phép truy cập
    next();
  } else if (role === 'student' && req.params.username === username) {
    // Nếu là sinh viên và xem thông tin bản thân, cho phép truy cập
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
};

//Admin trả về danh sách tất cả sinh viên 
app.get('/students/all', authenticateJWT, checkUserRole, async (req, res) => {
  try {
    console.log('Authenticated User in /students/all:', req.user);
    const result = await pool.query('SELECT * FROM students');
    res.json({ students: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
