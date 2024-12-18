const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Ensure database directory exists
const dbDir = path.resolve(__dirname, '../database');
const fs = require('fs');
if (!fs.existsSync(dbDir)){
    fs.mkdirSync(dbDir);
}

const dbPath = path.resolve(dbDir, 'flavor-junction.sqlite');

// Create database connection
const db = new sqlite3.Database(dbPath);

// Initialize database
async function initializeDb() {
    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');

            // Create users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                is_admin BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Create default admin user if it doesn't exist
            try {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash('admin123', salt);
                
                db.get('SELECT * FROM users WHERE email = ?', ['admin@flavor-junction.com'], (err, user) => {
                    if (err) {
                        console.error('Error checking for admin:', err);
                    } else if (!user) {
                        // Insert default admin
                        db.run(`
                            INSERT INTO users (username, email, password, phone, is_admin)
                            VALUES (?, ?, ?, ?, ?)
                        `, [
                            'admin',
                            'admin@flavor-junction.com',
                            hashedPassword,
                            '1234567890',
                            1
                        ], (err) => {
                            if (err) {
                                console.error('Error creating default admin:', err);
                            } else {
                                console.log('Default admin user created successfully');
                                console.log('Email: admin@tshirtstore.com');
                                console.log('Password: admin123');
                            }
                        });
                    }
                });
            } catch (error) {
                console.error('Error creating admin user:', error);
            }

            // Create Bookings  table
            db.run(`CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER,
                name TEXT,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                check_in_date DATE NOT NULL,
                check_out_date DATE NOT NULL,
                room_type TEXT,
                number_of_guests INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Create confirmed bookings table
            db.run(`CREATE TABLE IF NOT EXISTS confirmed_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                booking_id INTEGER,
                total_amount DECIMAL(10,2),
                status TEXT DEFAULT 'pending',
                payment_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(booking_id) REFERENCES bookings(id),
            )`);

            // Add this to your database initialization
            db.run(`CREATE TABLE IF NOT EXISTS payment_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER,
                checkout_request_id TEXT,
                merchant_request_id TEXT,
                amount DECIMAL(10,2),
                phone_number TEXT,
                status TEXT,
                mpesa_receipt TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(booking_id) REFERENCES confirmed_bookings(id)
            )`);
        });

        console.log('Connected to SQLite database');
        resolve(db);
    });
}

module.exports = { initializeDb, db }; 