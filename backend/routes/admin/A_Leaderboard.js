import express from 'express';

const router = express.Router();

// Get leaderboard data for admin view - Used by A_Leaderboard.jsx
router.get('/admin/leaderboard', (req, res) => {
    const sql = `
        SELECT 
            u.user_id,
            u.first_name,
            u.last_name,
            u.email,
            u.created_at,
            COUNT(DISTINCT ar.result_id) as assessments_taken,
            AVG(ar.score) as average_score,
            SUM(CASE WHEN ar.score >= a.passing_score THEN 1 ELSE 0 END) as assessments_passed,
            COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN up.chapter_id END) as chapters_completed,
            COUNT(DISTINCT mc.workstream_id) as workstreams_engaged,
            MAX(COALESCE(up.completed_at, ar.completed_at)) as last_activity
        FROM users u
        LEFT JOIN assessment_results ar ON u.user_id = ar.user_id
        LEFT JOIN assessments a ON ar.assessment_id = a.assessment_id
        LEFT JOIN user_progress up ON u.user_id = up.user_id
        LEFT JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
        WHERE u.isAdmin = FALSE
        GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.created_at
        ORDER BY average_score DESC, assessments_passed DESC, chapters_completed DESC
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

export default router;
