const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const con = require("../config/db");
const JWT_SECRET = 'my_secret_key';  

// ฟังก์ชันเข้าสู่ระบบ
const login = (req, res) => {
  const { username, password } = req.body;  // รับข้อมูลชื่อผู้ใช้และรหัสผ่านจาก body
  const sql = "SELECT id, role, password FROM users WHERE username=?";  // คำสั่ง SQL สำหรับค้นหาผู้ใช้จากฐานข้อมูล

  con.query(sql, [username], function (err, results) {
    if (err) {
      console.error(err);
      return res.status(500).send("เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล");
    }

    if (results.length !== 1) {
      return res.status(401).send("ชื่อผู้ใช้ไม่ถูกต้อง");
    }

    // ตรวจสอบรหัสผ่านโดยใช้ bcrypt
    bcrypt.compare(password, results[0].password, function (err, same) {
      if (err) {
        return res.status(500).send("เกิดข้อผิดพลาดในระบบ");
      }

      if (same) {
        const user = {
          userID: results[0].id,
          username: username,
          role: results[0].role
        };

        // สร้าง JWT Token
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });  // Token จะหมดอายุหลังจาก 1 วัน

        res.json({ token });  // ส่ง token กลับให้ผู้ใช้
      } else {
        res.status(401).send("รหัสผ่านไม่ถูกต้อง");
      }
    });
  });
};

//----------------------------------------------------------------------------------------//

// Register 
const register = (req, res) => {
  const { fullname, username, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }
  bcrypt.hash(password, 10, function (err, hash) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Error while connecting to the database" });
    }
    const sql = "INSERT INTO users (fullname, password, username, role) VALUES (?, ?, ?, 1)";
    con.query(sql, [fullname, hash, username], function (err, _result) {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
      res.send('Register successful!');
    });
  });
};

module.exports = { login, register };