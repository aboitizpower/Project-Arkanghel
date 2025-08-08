import express from 'express';

const router = express.Router();

// Get leaderboard data for employees - Used by E_Leaderboard.jsx
router.get('/employee/leaderboard', (req, res) => {
    const sql = `
        SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            COUNT(DISTINCT ar.result_id) as assessments_taken,
            AVG(ar.score) as average_score,
            SUM(CASE WHEN ar.score >= a.passing_score THEN 1 ELSE 0 END) as assessments_passed,
            COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.chapter_id END) as chapters_completed
        FROM users u
        LEFT JOIN assessment_results ar ON u.user_id = ar.user_id
        LEFT JOIN assessments a ON ar.assessment_id = a.assessment_id
        LEFT JOIN user_progress up ON u.user_id = up.user_id
        WHERE u.isAdmin = FALSE
        GROUP BY u.user_id, u.first_name, u.last_name
        HAVING assessments_taken > 0
        ORDER BY average_score DESC, assessments_passed DESC, chapters_completed DESC
        LIMIT 50
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

export default router;
