const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Get token from the Authorization header (with 'Bearer ' prefix)
    const token = req.header('Authorization')?.replace('Bearer ', '');

    // Check if token is missing
    if (!token) {
        return res.status(403).json({ message: 'Access denied, no token provided.' });
    }

    try {
        // Verify the token using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-default-secret-key');

        // Attach decoded user data to the request object
        req.user = decoded;

        // Continue to the next middleware or route handler
        next();
    } catch (err) {
        // Handle different JWT errors
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token has expired' });
        }

        // Return a generic message for other errors
        console.error('JWT Error:', err.message);
        res.status(403).json({ message: 'Invalid token' });
    }
};
