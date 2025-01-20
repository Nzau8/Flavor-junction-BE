const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const verifyToken = require('./middleware/auth');  // Import the authentication middleware
const nodemailer = require('nodemailer');

// Initialize environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

const corsOptions = {
    origin: [
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'https://flavor-junction-fe.netlify.app',
      'https://flavor-junction-be.onrender.com',
      'flavor-junction-db-flavor-junction-db.g.aivencloud.com'
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
// Create a MySQL connection
const db = mysql.createPool({
    host: 'flavor-junction-db-flavor-junction-db.g.aivencloud.com',
    user: 'avnadmin',
    password: 'AVNS_5gJSPjQL1dbTPCNGss4',
    database: 'flavor-junction-db',
    port: 13797,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 30000 // 30 seconds
});

// Connect to the MySQL database
db.getConnection((err, connection) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err.message);
    } else {
        console.log('Connected to MySQL database');
        // Initialize database (create tables if they don't exist)
        connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                phone VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT 0
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            }
            console.log('Users Table created');
        });

        connection.query(`
            CREATE TABLE IF NOT EXISTS table_booking (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255),
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                date DATE,
                time TIME,
                number_of_people INT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating table_booking table:', err.message);
            }
        });

        connection.query(`
            CREATE TABLE IF NOT EXISTS room_booking (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255),
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                check_in_date DATE,
                check_out_date DATE,
                room_type VARCHAR(255),
                guests INT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating room_booking table:', err.message);
            }
        });

        connection.release();
    }
});

// Set the db object to be accessible from other files
global.db = db.promise();

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

        db.query('INSERT INTO users (email, phone, password) VALUES (?, ?, ?)', [email, phone, hashedPassword], function (err, results) {
            if (err) {
                return res.status(500).json({ message: 'Error registering user', error: err.message });
            }
            res.json({ message: 'User registered successfully', id: results.insertId });
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

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = results[0];

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
                    expiresIn: '15d' 

                }
            );

            res.json({ token });
        });
    });
});

// Admin Login Endpoint 
// /api/admin/auth/login
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        db.query('SELECT * FROM users WHERE email = ? AND is_admin = 1', [email], async (err, results) => {
            if (err) {
                return res.status(500).json({ message: 'Server error. Please try again later.' });
            }

            if (results.length === 0) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const user = results[0];

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id },
                process.env.JWT_SECRET,
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

// Book a Table (Protected)
app.post('/api/table-booking', verifyToken, async(req, res) => {
    const userId = req.user.id;  // Extract user ID from decoded token
    const { name,email,phone, date,time,number_of_people } = req.body;

    // Insert booking into database
    db.query('INSERT INTO table_booking (user_id,name,email,phone, date,time,number_of_people) VALUES (?, ?, ?, ?,?,?,?)',
         [userId,name,email,phone, date, time,number_of_people], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error Reserving your table', error: err.message });
            
        }
        console.log ("Table Booking in progress...");
        res.json({ message: 'Table reseravation was successful', id: this.insertId });
        
    });

});

// Book a Room (Protected)
app.post('/api/room-booking', verifyToken, async (req, res) => {
    const userId = req.user.id;  // Extract user ID from decoded token
    const { name,email,phone, check_in_date,check_out_date,room_type,guests } = req.body;

    // Insert booking into database
    db.query('INSERT INTO room_booking (user_id,name,email,phone,check_in_date,check_out_date,room_type,guests) VALUES (?, ?, ?,?,?,?,?,?)',
         [userId,name,email,phone, check_in_date, check_out_date,room_type,guests], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error Booking your room', error: err.message });
        }

        res.json({ message: 'Booking successful', id: this.insertId });
    });
});

// Get User's Profile (User Info)
app.get('/user/profile', verifyToken, (req, res) => {
    const userId = req.user.id;

    db.query('SELECT email, phone FROM users WHERE id = ?', [userId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ message: 'Error fetching user data', error: err.message });
        }

        res.json(results[0]);
    });
});

// Get User's Bookings
app.get('/api/roomBookings', verifyToken, (req, res) => {
    const userId = req.user.id;
    // const userId = req.user.id;
    // const name = req.room_booking.name;
    // const email = req.room_booking.email;
    // const phone = req.room_booking.phone;
    // const check_in_date = req.room_booking.check_in_date;
    // const check_out_date = req.room_booking.check_out_date;
    // const room_type = req.room_booking.room_type;
    // const guests = req.room_booking.guests;

    db.query('SELECT * FROM room_booking WHERE user_id=?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching bookings', error: err.message });
        }

        res.json(results);
    });
});

// Get User's Bookings
app.get('/api/tableBookings', verifyToken, (req, res) => {
    const userId = req.user.id;
    // const userId = req.user.id;
    // const name = req.room_booking.name;
    // const email = req.room_booking.email;
    // const phone = req.room_booking.phone;
    // const check_in_date = req.room_booking.check_in_date;
    // const check_out_date = req.room_booking.check_out_date;
    // const room_type = req.room_booking.room_type;
    // const guests = req.room_booking.guests;

    db.query('SELECT * FROM table_booking WHERE user_id=?', [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching bookings', error: err.message });
        }

        res.json(results);
    });
});

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  // Verify transporter
  transporter.verify(function(error, _success) {
    if (error) {
      console.log('Server error:', error);
    } else {
      console.log('Server is ready to take our messages');
    }
  });
  

  
// Contact form endpoint with validation
app.post('/api/sendEmail', verifyToken, async (req, res) => {
  try {
    const { name, email, checkInDate, checkOutDate, roomType, guests } = req.body;

    // Validate required fields
    if (!name || !email || !checkInDate || !checkOutDate || !roomType || !guests) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Email content
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Flavor Hotel Booking Confirmation',
      html: `
        <h3>Hotel Booking Confirmation</h3>
        <p><strong>Dear</strong> ${name}</p>
        <p><strong>You are receiving this email from Flavor-Junction Hotel Because you requested to reserve a room with us.</strong></p>
        <p><strong>Please find below the details for follow up:</strong></p>
        <p><strong>Check In Date:</strong> ${checkInDate}</p>
        <p><strong>Check Out Date:</strong> ${checkOutDate}</p>
        <p><strong>Room Type:</strong> ${roomType}</p>
        <p><strong>Expected Guest:</strong> ${guests}</p>
      `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Booking confirmation sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Error sending booking confirmation', error: error.message });
  }
});

// Contact form endpoint with validation
app.post('/api/tableBookingSendEmail', verifyToken, async (req, res) => {
    try {
      const { id, user_id, name, email, phone, date, time, number_of_people } = req.body;
  
      // Validate required fields
      if ( !id || !user_id || !name || !email || !phone || !date || !time || !number_of_people ) {
        return res.status(400).json({ message: 'All fields are required' });
      }
  
      // Email content
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Flavor Hotel Booking Confirmation',
        html: `
          <h3>Hotel Booking Confirmation</h3>
          <p><strong>Dear</strong> ${name}</p>
          <p><strong>You are receiving this email from Flavor-Junction Hotel Because you requested to reserve a room with us.</strong></p>
          <p><strong>Please find below the details for follow up:</strong></p>
          <p><strong>Reservation Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Expected Guest:</strong> ${number_of_people}</p>
        `
      };
  
      // Send email
      await transporter.sendMail(mailOptions);
  
      res.status(200).json({ message: 'Booking confirmation sent successfully' });
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ message: 'Error sending booking confirmation', error: error.message });
    }
  });

// Update User Profile (Optional)
app.put('/profile', verifyToken, (req, res) => {
    const userId = req.user.id;
    const { email, phone } = req.body;

    db.query('UPDATE users SET email = ?, phone = ? WHERE id = ?', [email, phone, userId], function (err) {
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
