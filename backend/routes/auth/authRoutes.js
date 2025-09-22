import express from 'express';
import jwt from 'jsonwebtoken';
import { msalInstance } from '../../config/msalConfig.js';
import 'dotenv/config';

const router = express.Router();

// This new endpoint will be called by the frontend after a successful MSAL login
router.post('/api/auth/verify', async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: 'ID token is required.' });
    }

    try {
        // Decode the token to get user claims without verification first
        const decodedToken = jwt.decode(idToken);
        if (!decodedToken) {
            return res.status(400).json({ message: 'Invalid token' });
        }

        // TODO: Add proper JWT signature verification here for production using a library like jwks-rsa

        const email = decodedToken.email || decodedToken.preferred_username;
        const firstName = decodedToken.given_name;
        const lastName = decodedToken.family_name;
        const isAdmin = decodedToken.roles?.includes('Admin') || false;

        // TODO: Re-enable this domain restriction for production
        // if (!email.endsWith('@aboitiz.com')) {
        //     return res.status(403).json({ message: 'Access denied. Only @aboitiz.com users are allowed.' });
        // }

        const [userExists] = await req.db.promise().query('SELECT * FROM users WHERE email = ?', [email]);

        let user;
        if (userExists.length === 0) {
            // User does not exist, create them
            const newUser = { first_name: firstName, last_name: lastName, email, password: 'azuread_user', isAdmin };
            const [result] = await req.db.promise().query('INSERT INTO users SET ?', newUser);
            user = { user_id: result.insertId, ...newUser };
        } else {
            // User exists, use their data
            user = userExists[0];
        }

        // Create our own application session token
        const appToken = jwt.sign(
            { id: user.user_id, email: user.email, isAdmin: user.isAdmin, first_name: user.first_name, last_name: user.last_name },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ token: appToken });

    } catch (error) {
        console.error('Error during token verification:', error);
        res.status(500).json({ message: 'Server error during authentication.' });
    }
});

// Route to handle logout
router.get('/auth/logout', (req, res) => {
    res.redirect(process.env.POST_LOGOUT_REDIRECT_URI);
});

export default router;
