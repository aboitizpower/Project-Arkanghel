import express from 'express';
import bcrypt from 'bcrypt';

const router = express.Router();

/**
 * @route POST /login
 * @description Authenticate a user and return user data (without password)
 * @access Public
 * @param {string} email - User's email
 * @param {string} password - User's password
 * @returns {Object} User data (without password) and success message or error
 */
router.post('/login', (req, res) => {
    console.log('Login attempt for email:', req.body.email);
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
        console.warn('Login attempt missing required fields');
        return res.status(400).json({ 
            success: false,
            error: 'Email and password are required.' 
        });
    }
    
    // Find user by email
    const sql = 'SELECT * FROM users WHERE email = ?';
    req.db.query(sql, [email], (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            return res.status(500).json({ 
                success: false,
                error: 'An error occurred during login. Please try again.' 
            });
        }
        
        // Check if user exists
        if (results.length === 0) {
            console.warn(`Login failed: No user found with email ${email}`);
            return res.status(401).json({ 
                success: false,
                error: 'Invalid email or password.' 
            });
        }
        
        const user = results[0];
        
        // Verify password
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) {
                console.error('Error comparing passwords:', err);
                return res.status(500).json({ 
                    success: false,
                    error: 'An error occurred during login. Please try again.' 
                });
            }
            
            if (!isMatch) {
                console.warn(`Login failed: Incorrect password for user ${email}`);
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid email or password.' 
                });
            }
            
            // User authenticated successfully
            console.log(`User ${user.user_id} logged in successfully`);
            
            // Remove password from user object
            const { password, ...userWithoutPassword } = user;
            
            return res.status(200).json({ 
                success: true,
                message: 'Login successful!', 
                user: userWithoutPassword 
            });
        });
    });
});

export default router;
