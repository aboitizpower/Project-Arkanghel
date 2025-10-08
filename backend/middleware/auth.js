import jwt from 'jsonwebtoken';
import 'dotenv/config';

/**
 * Authentication middleware to verify JWT tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    console.log('🔐 Auth middleware - Request URL:', req.url);
    console.log('🔐 Auth middleware - Auth header:', authHeader ? 'Present' : 'Missing');
    console.log('🔐 Auth middleware - Token:', token ? 'Present' : 'Missing');

    if (!token) {
        console.log('❌ Auth middleware - No token provided');
        return res.status(401).json({
            success: false,
            error: 'Access token is required'
        });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('❌ Token verification failed:', err.message);
            console.error('❌ Token that failed:', token.substring(0, 20) + '...');
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        console.log('✅ Auth middleware - User details:', { id: user.id, email: user.email, isAdmin: user.isAdmin });
        // Add user information to request object
        req.user = user;
        next();
    });
};

/**
 * Authorization middleware to check if user is admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (!req.user.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }

    next();
};

/**
 * Authorization middleware to check if user is employee (non-admin)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireEmployee = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (req.user.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Employee access only'
        });
    }

    next();
};

/**
 * Middleware to check if user can access their own data or admin can access any data
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireOwnershipOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    const requestedUserId = req.params.userId || req.query.userId || req.body.userId;
    
    // Admin can access any user's data
    if (req.user.isAdmin) {
        return next();
    }

    // User can only access their own data
    if (requestedUserId && parseInt(requestedUserId) === parseInt(req.user.id)) {
        return next();
    }

    return res.status(403).json({
        success: false,
        error: 'Access denied. You can only access your own data.'
    });
};

export default {
    authenticateToken,
    requireAdmin,
    requireEmployee,
    requireOwnershipOrAdmin
};
