import express from 'express';
import bcrypt from 'bcrypt';
import validator from 'validator';

const router = express.Router();
const saltRounds = 10;

/**
 * @route POST /register
 * @description Register a new user
 * @access Public
 * @param {string} first_name - User's first name
 * @param {string} last_name - User's last name
 * @param {string} email - User's email address
 * @param {string} password - User's password (min 8 characters)
 * @returns {Object} Success message or error details
 */
router.post("/register", (req, res) => {
    console.log('Registration attempt for email:', req.body.email);
    const { first_name, last_name, email, password } = req.body;
    
    // Input validation
    if (!first_name || !last_name || !email || !password) {
        console.warn('Registration attempt missing required fields');
        return res.status(400).json({ 
            success: false,
            error: 'All fields are required.' 
        });
    }
    
    // Validate email format
    if (!validator.isEmail(email)) {
        console.warn('Invalid email format provided:', email);
        return res.status(400).json({ 
            success: false,
            error: 'Please provide a valid email address.' 
        });
    }
    
    // Validate password strength
    if (password.length < 8) {
        console.warn('Password too short');
        return res.status(400).json({ 
            success: false,
            error: 'Password must be at least 8 characters long.' 
        });
    }
    
    // Hash the password
    bcrypt.hash(password, saltRounds, (hashErr, hash) => {
        if (hashErr) {
            console.error('Error hashing password:', hashErr);
            return res.status(500).json({ 
                success: false,
                error: 'Error processing your registration. Please try again.' 
            });
        }
        
        // Insert the new user into the database
        const sql = `
            INSERT INTO users 
            (first_name, last_name, email, password, isAdmin, created_at) 
            VALUES (?, ?, ?, ?, FALSE, NOW())
        `;
        
        req.db.query(sql, [first_name, last_name, email, hash], (dbErr, result) => {
            if (dbErr) {
                // Handle duplicate email error
                if (dbErr.code === 'ER_DUP_ENTRY') {
                    console.warn(`Registration failed: Email ${email} already exists`);
                    return res.status(409).json({ 
                        success: false,
                        error: 'This email is already registered. Please use a different email or log in.' 
                    });
                }
                
                // Handle other database errors
                console.error('Database error during registration:', dbErr);
                return res.status(500).json({ 
                    success: false,
                    error: 'An error occurred during registration. Please try again.' 
                });
            }
            
            // Registration successful
            console.log(`New user registered with ID: ${result.insertId}`);
            return res.status(201).json({ 
                success: true,
                message: 'Registration successful! You can now log in.',
                userId: result.insertId
            });
        });
    });
});

export default router;
