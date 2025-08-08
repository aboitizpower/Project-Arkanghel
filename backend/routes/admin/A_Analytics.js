import express from 'express';

const router = express.Router();

// Get analytics data for admin - Used by A_Analytics.jsx
router.get('/admin/analytics', (req, res) => {
    // Get overall statistics
    const statsSql = `
        SELECT 
            (SELECT COUNT(*) FROM users WHERE isAdmin = FALSE) as total_users,
            (SELECT COUNT(*) FROM workstreams) as total_workstreams,
            (SELECT COUNT(*) FROM workstreams WHERE is_published = TRUE) as published_workstreams,
            (SELECT COUNT(*) FROM module_chapters) as total_chapters,
            (SELECT COUNT(*) FROM module_chapters WHERE is_published = TRUE) as published_chapters,
            (SELECT COUNT(*) FROM assessments) as total_assessments,
            (SELECT COUNT(*) FROM assessment_results) as total_assessment_attempts,
            (SELECT AVG(score) FROM assessment_results) as average_score
    `;
    
    req.db.query(statsSql, (err, statsResults) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Get user engagement data
        const engagementSql = `
            SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                COUNT(DISTINCT up.chapter_id) as chapters_viewed,
                COUNT(DISTINCT ar.result_id) as assessments_taken,
                AVG(ar.score) as average_score,
                MAX(COALESCE(up.completed_at, ar.completed_at)) as last_activity
            FROM users u
            LEFT JOIN user_progress up ON u.user_id = up.user_id
            LEFT JOIN assessment_results ar ON u.user_id = ar.user_id
            WHERE u.isAdmin = FALSE
            GROUP BY u.user_id, u.first_name, u.last_name
            ORDER BY last_activity DESC
            LIMIT 20
        `;
        
        req.db.query(engagementSql, [], (err, engagementResults) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // Get workstream performance data
            const workstreamSql = `
                SELECT 
                    w.workstream_id,
                    w.title,
                    COUNT(DISTINCT up.user_id) as users_enrolled,
                    COUNT(DISTINCT ar.user_id) as users_assessed,
                    AVG(ar.score) as average_assessment_score,
                    COUNT(DISTINCT mc.chapter_id) as total_chapters,
                    COUNT(DISTINCT CASE WHEN mc.is_published = TRUE THEN mc.chapter_id END) as published_chapters
                FROM workstreams w
                LEFT JOIN module_chapters mc ON w.workstream_id = mc.workstream_id
                LEFT JOIN user_progress up ON mc.chapter_id = up.chapter_id
                LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                LEFT JOIN assessment_results ar ON a.assessment_id = ar.assessment_id
                GROUP BY w.workstream_id, w.title
                ORDER BY users_enrolled DESC
            `;
            
            req.db.query(workstreamSql, [], (err, workstreamResults) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                res.json({
                    overview: statsResults[0],
                    user_engagement: engagementResults,
                    workstream_performance: workstreamResults
                });
            });
        });
    });
});

export default router;
