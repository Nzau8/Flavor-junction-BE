const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ensure database directory exists
const dbDir = path.resolve(__dirname, '../database');
const fs = require('fs');
if (!fs.existsSync(dbDir)){
    fs.mkdirSync(dbDir);
}

const dbPath = path.resolve(dbDir, 'flavor-junction.sqlite3');

// Create database connection
const db = new sqlite3.Database(dbPath);

// Initialize database
async function initializeDb() {
    return new Promise((resolve, _reject) => {
        db.serialize(async () => {

            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');

            // Create users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);

            // Create Bookings  table
            db.run(`CREATE TABLE IF NOT EXISTS room_booking (
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


            // Create table_booking table
            db.run(`CREATE TABLE IF NOT EXISTS table_booking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER,
                name TEXT,
                email VARCHAR(255) UNIQUE NOT NULL,
                phone VARCHAR(20),
                reservation_date DATE NOT NULL,
                reservation_time TIME NOT NULL,
                number_of_guests INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`)

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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        });

        console.log('Connected to SQLite database');
        resolve(db);
    });
}

module.exports = { initializeDb, db };