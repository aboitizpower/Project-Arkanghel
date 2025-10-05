import express from 'express';

const router = express.Router();

// POST /employee/feedback - Submit new feedback
router.post('/feedback', (req, res) => {
    const { userId, subject, message } = req.body;

    if (!userId || !subject || !message) {
        return res.status(400).send('Missing required fields: userId, subject, and message.');
    }

    const query = 'INSERT INTO feedback (employee_id, subject, message) VALUES (?, ?, ?)';
    req.db.query(query, [userId, subject, message], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Failed to submit feedback.');
        }
        res.status(201).send({ id: result.insertId, message: 'Feedback submitted successfully.' });
    });
});

export default router;