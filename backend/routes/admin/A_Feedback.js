import express from 'express';

const router = express.Router();

// GET /admin/feedback - Fetch all feedback
router.get('/admin/feedback', (req, res) => {
    const query = `
        SELECT 
            f.id, 
            f.subject,
            f.message, 
            f.created_at, 
            u.first_name, 
            u.last_name 
        FROM feedback f
        JOIN users u ON f.employee_id = u.user_id
        ORDER BY f.created_at DESC
    `;

    req.db.query(query, (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Failed to fetch feedback.');
        }
        res.json(results);
    });
});

export default router;