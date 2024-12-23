const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || '8f4c9d6e2b7a1f3e5d8c9b4a7f2e1d6c3b8a5f9e2d7c4b1a6f3e8d5c2b9a4f7';

// Registration Route
router.post('/register', async (req, res) => {
    const { email, phone, password } = req.body;

    if (!email || !phone || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, existingUser) => {
            if (err) {
                return res.status(500).json({ message: 'Server error. Please try again later.' });
            }

            if (existingUser) {
                return res.status(400).json({ message: 'Email is already registered.' });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            db.run('INSERT INTO users (email, phone, password) VALUES (?, ?, ?)', [email, phone, hashedPassword], function (err) {
                if (err) {
                    return res.status(500).json({ message: 'Server error. Please try again later.' });
                }

                res.status(201).json({ message: 'Registration successful' });
            });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'Server error. Please try again later.' });
            }

            if (!user) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id },
                JWT_SECRET,
                { expiresIn: '15d' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    is_admin: user.is_admin || false
                }
            });
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error. Please try again later.' });
    }
});


//lo
router.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.redirect('/'); // 
});

module.exports = router;


module.exports = router;

