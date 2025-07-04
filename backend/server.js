import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'
import bcrypt from 'bcrypt'

const app = express()

app.use(express.json())
app.use(cors())

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "arkanghel_db"
})

const saltRounds = 10;

// Register endpoint
app.post("/register", (req,res)=>{
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Error hashing password.' });
        const sql = 'INSERT INTO users (first_name, last_name, email, password, isAdmin) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [first_name, last_name, email, hash, false], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Email already exists.' });
                }
                return res.status(500).json({ error: err.message });
            }
            return res.status(201).json({ success: 'User registered successfully!' });
        });
    });
})

// Login endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password.' });
            }
            // Do not send password back
            const { password, ...userWithoutPassword } = user;
            return res.status(200).json({ success: 'Login successful!', user: userWithoutPassword });
        });
    });
});

// Get all users endpoint
app.get('/users', (req, res) => {
    db.query('SELECT user_id, first_name, last_name, email, isAdmin, created_at FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        // For frontend compatibility, map user_id to id
        const users = results.map(u => ({
            ...u,
            id: u.user_id
        }));
        res.json({ users });
    });
});

// Update user role endpoint
app.put('/users/:id/role', (req, res) => {
    const { isAdmin } = req.body;
    const { id } = req.params;
    db.query(
        'UPDATE users SET isAdmin = ? WHERE user_id = ?',
        [isAdmin ? 1 : 0, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

app.listen(8081, ()=>{
    console.log('Server is running on port 8081')
})