const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    // Get token from the Authorization header (with 'Bearer ' prefix)
    const token = req.header('Authorization') && req.header('Authorization').split(' ')[1];
    // Check if token is missing
    if (!token) {
        return res.status(403).json({ message: 'Access denied, no token provided.' });
    }

    try {
        // Verify the token using the secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '8f4c9d6e2b7a1f3e5d8c9b4a7f2e1d6c3b8a5f9e2d7c4b1a6f3e8d5c2b9a4f7');

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
