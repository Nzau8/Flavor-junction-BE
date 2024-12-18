const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database
const { initializeDb } = require('./config/database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.use('/public', express.static(path.join(__dirname, 'public')));

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Initialize database before starting the server
initializeDb().then(() => {
    console.log('Database initialized');
    
    // Routes

    // Route to handle login and registration of users into the system
    app.use('/api/auth', require('./routes/auth'));

    // Route to handle payment for users who make payment via online
    app.use('/api/payments', require('./routes/payments'));

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
}); 