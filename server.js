const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const verifyToken = require('./middleware/auth');  // Import the authentication middleware
// const nodemailer = require("nodemailer");

// Initialize an SMTP service
// const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST, // Replace with your SMTP server
//     port: process.env.SMTP_PORT, // Common port for SMTP
//     secure: true, // true for 465, false for other ports
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//     }
// });

// Initialize environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());

const corsOptions = {
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3001',
      "smtp.gmail.com",
    ],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
  };
  
  // Apply CORS middleware before routes
  app.use(cors(corsOptions));
  
  // Add CORS headers to all responses
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', true);
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

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
            CREATE TABLE IF NOT EXISTS table_booking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                date DATE,
                time TIME,
                number_of_people INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);


        db.run(`
            CREATE TABLE IF NOT EXISTS room_booking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                check_in_date DATE,
                check_out_date DATE,
                room_type TEXT,
                guests INTEGER NOT NULL,
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
    app.post('/logout', (_req, res) => {
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
            const token = jwt.sign(
                { 
                    id: user.id, 
                    email: user.email 
                }, 
                process.env.JWT_SECRET, 
                { 
                    expiresIn: '3600s' 

                }
            );

            res.json({ token });
        });
    });
});

// Book a Table (Protected)
app.post('/api/table-booking', verifyToken, (req, res) => {
    const userId = req.user.id;  // Extract user ID from decoded token
    const { name,email,phone, date,time,number_of_people } = req.body;

    // Insert booking into database
    db.run('INSERT INTO table_booking (user_id,name,email,phone, date,time,number_of_people) VALUES (?, ?, ?, ?,?,?,?)',
         [userId,name,email,phone, date, time,number_of_people], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error Reserving your table', error: err.message });
            
        }
        console.log ("Table Booking in progress...");
        res.json({ message: 'Table reseravation was successful', id: this.lastID });

    });
});

// Book a Room (Protected)
app.post('/api/room-booking', verifyToken, (req, res) => {
    const userId = req.user.id;  // Extract user ID from decoded token
    const { name,email,phone, check_in_date,check_out_date,room_type,guests } = req.body;

    // Insert booking into database
    db.run('INSERT INTO room_booking (user_id,name,email,phone,check_in_date,check_out_date,room_type,guests) VALUES (?, ?, ?,?,?,?,?,?)',
         [userId,name,email,phone, check_in_date, check_out_date,room_type,guests], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error Booking your room', error: err.message });
        }

        res.json({ message: 'Booking successful', id: this.lastID });
    });

    // Email options
    // const mailOptions = {
    //     from: process.env.EMAIL_USER,
    //     to: email,
    //     subject: 'Room Booking Confirmation',
    //     html: `
    //     <h3><b>Dear ${name}</b></h3>
    //     <p>Your room booking has been confirmed.</p>
    //     <p><strong>Check-in Date:</strong> ${check_in_date}</p>
    //     <p><strong>Check-out Date:</strong> ${check_out_date}</p>
    //     <p><strong>Room Type:</strong> ${room_type}</p>
    //     <p><strong>Number of Guests:</strong> ${guests}</p><br>
    //     <p>Best regards,</P>
    //     <p>Patrick Alunya</p>
    //     <p>Customer Success Management</p>
    //     `
    // };

    // Send email
    // transporter.sendMail(mailOptions, (error, info) => {
    //     if (error) {
    //       console.log(error);
    //     }
    //     console.log(info);
    //   });
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
app.use((_req, res) => {
    res.status(404).send('Page not found');
});

// Handle server errors
app.use((err, _req, res, _next) => {
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
