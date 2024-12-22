const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const verifyToken = require('./middleware/auth');  // Import the authentication middleware

// Initialize environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware setup
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(bodyParser.json()); // Parse incoming JSON data

// Initialize SQLite database
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database');
        // Initialize database (create tables if they don't exist)
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                phone TEXT NOT NULL,
                password TEXT NOT NULL
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                booking_type TEXT,
                date TEXT,
                status TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
    }
});

// Set the db object to be accessible from other files
global.db = db;

// Import Routes
const authRoutes = require('./routes/auth');

// Use Routes
app.use('/api/auth', authRoutes); // This will handle requests for registration and login

// User Registration (Sign Up)
app.post('/auth/register', async (req, res) => {
    const { email, phone, password } = req.body;

    // Validate user input
    if (!email || !phone || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Hash password before saving to the database
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run('INSERT INTO users (email, phone, password) VALUES (?, ?, ?)', [email, phone, hashedPassword], function (err) {
            if (err) {
                return res.status(500).json({ message: 'Error registering user', error: err.message });
            }
            res.json({ message: 'User registered successfully' });
        });
    } catch (err) {
        return res.status(500).json({ message: 'Error hashing password', error: err.message });
    }
});

// User Login (Sign In)
app.post('/auth/login', (req, res) => {
    const { email, password } = req.body;

// Logout
    app.post('/logout', (req, res) => {
        res.clearCookie('token');
        res.redirect('/index.html');
    });
    

    // Validate user input
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Compare password with the stored hash
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err || !isMatch) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            // Create JWT token
            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

            res.json({ token });
        });
    });
});

// Book a Room/Table (Protected)
app.post('/bookings', verifyToken, (req, res) => {
    const userId = req.user.id;  // Extract user ID from decoded token
    const { booking_type, date } = req.body;

    // Insert booking into database
    db.run('INSERT INTO bookings (user_id, booking_type, date, status) VALUES (?, ?, ?, ?)', [userId, booking_type, date, 'Pending'], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error creating booking', error: err.message });
        }

        res.json({ message: 'Booking successful', bookingId: this.lastID });
    });
});

// Get User's Profile (User Info)
app.get('/user/profile', verifyToken, (req, res) => {
    const userId = req.user.id;

    db.get('SELECT email, phone FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ message: 'Error fetching user data', error: err.message });
        }

        res.json(user);
    });
});

// Get User's Bookings
app.get('/user/bookings', verifyToken, (req, res) => {
    const userId = req.user.id;

    db.all('SELECT * FROM bookings WHERE user_id = ?', [userId], (err, bookings) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching bookings', error: err.message });
        }

        res.json(bookings);
    });
});

// Update User Profile (Optional)
app.put('/profile', verifyToken, (req, res) => {
    const userId = req.user.id;
    const { email, phone } = req.body;

    db.run('UPDATE users SET email = ?, phone = ? WHERE id = ?', [email, phone, userId], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error updating profile', error: err.message });
        }

        res.json({ message: 'Profile updated successfully' });
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle 404 errors
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Handle server errors
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Server error');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Close the database connection when the server is closed
process.on('SIGINT', () => {});

process.on('SIGTERM', () => {
    db.close(() => {
        console.log('Database connection closed');
        process.exit(0);
    });
});

module.exports = app;
