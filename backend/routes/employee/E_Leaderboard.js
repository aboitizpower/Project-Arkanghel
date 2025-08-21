import express from 'express';

const router = express.Router();

// Get leaderboard data for employees - Used by E_Leaderboard.jsx
router.get('/employee/leaderboard', (req, res) => {
    // First check if we have any users at all
    const checkUsersSQL = 'SELECT COUNT(*) as total_users, COUNT(CASE WHEN isAdmin = FALSE THEN 1 END) as non_admin_users FROM users';
    
    req.db.query(checkUsersSQL, (err, checkResults) => {
        if (err) {
            console.error('Error checking users:', err);
            return res.status(500).json({ error: 'Database error checking users' });
        }
        
        console.log('Employee leaderboard - User count check:', checkResults[0]);
        
        // If no non-admin users, return empty array
        if (checkResults[0].non_admin_users === 0) {
            console.log('No non-admin users found, returning empty array');
            return res.json([]);
        }
        
        // Get basic user data using the same structure as admin leaderboard
        const sql = `
            SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.created_at,
                COUNT(DISTINCT CASE WHEN ans.score IS NOT NULL THEN q.assessment_id END) as assessments_taken,
                AVG(ans.score) as average_score,
                COUNT(DISTINCT CASE WHEN up.is_completed = 1 THEN up.chapter_id END) as chapters_completed,
                COUNT(DISTINCT mc.workstream_id) as workstreams_engaged,
                MAX(COALESCE(up.completion_time, ans.answered_at)) as last_activity
            FROM users u
            LEFT JOIN answers ans ON u.user_id = ans.user_id
            LEFT JOIN questions q ON ans.question_id = q.question_id
            LEFT JOIN user_progress up ON u.user_id = up.user_id
            LEFT JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
            WHERE u.isAdmin = FALSE
            GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.created_at
            ORDER BY chapters_completed DESC, last_activity DESC
        `;
    
        req.db.query(sql, async (err, results) => {
            if (err) {
                console.error('Employee leaderboard SQL error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Calculate average progress for each user across ALL workstreams (no filtering)
            const usersWithProgress = await Promise.all(results.map(async (user) => {
                return new Promise((resolve) => {
                    // Get all published workstreams (no access restrictions for employees)
                    const workstreamAccessSQL = `
                        SELECT DISTINCT w.workstream_id
                        FROM workstreams w
                        WHERE w.is_published = TRUE
                    `;
                    
                    req.db.query(workstreamAccessSQL, [], (err, workstreams) => {
                        if (err) {
                            console.error('Error getting workstreams:', err);
                            resolve({ ...user, average_progress: 0, total_workstreams: 0, workstreams_with_progress: 0 });
                            return;
                        }
                        
                        if (workstreams.length === 0) {
                            resolve({ ...user, average_progress: 0, total_workstreams: 0, workstreams_with_progress: 0 });
                            return;
                        }
                        
                        // Calculate progress for each workstream
                        const progressPromises = workstreams.map(ws => {
                            return new Promise((resolveProgress) => {
                                const progressSQL = `
                                    SELECT 
                                        CASE 
                                            WHEN total_items = 0 THEN 0
                                            ELSE (completed_items * 100.0) / total_items
                                        END as progress
                                    FROM (
                                        SELECT 
                                            COALESCE((
                                                SELECT COUNT(DISTINCT up.chapter_id)
                                                FROM user_progress up
                                                JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                                                WHERE up.user_id = ? 
                                                  AND mc.workstream_id = ?
                                                  AND up.is_completed = TRUE
                                                  AND mc.is_published = TRUE
                                            ), 0) +
                                            COALESCE((
                                                SELECT COUNT(DISTINCT a.assessment_id)
                                                FROM assessments a
                                                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                                WHERE mc.workstream_id = ?
                                                  AND mc.is_published = TRUE
                                                  AND EXISTS (
                                                      SELECT 1
                                                      FROM answers ans
                                                      JOIN questions q ON ans.question_id = q.question_id
                                                      WHERE q.assessment_id = a.assessment_id 
                                                        AND ans.user_id = ?
                                                      GROUP BY q.assessment_id
                                                      HAVING (SUM(ans.score) * 100.0 / COUNT(q.question_id)) >= 75
                                                  )
                                            ), 0) as completed_items,
                                            COALESCE((
                                                SELECT COUNT(*) 
                                                FROM module_chapters mc 
                                                WHERE mc.workstream_id = ?
                                                  AND mc.is_published = TRUE
                                            ), 0) +
                                            COALESCE((
                                                SELECT COUNT(DISTINCT a.assessment_id) 
                                                FROM assessments a 
                                                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                                                WHERE mc.workstream_id = ?
                                                  AND mc.is_published = TRUE
                                            ), 0) as total_items
                                    ) as progress_calc
                                `;
                                
                                req.db.query(progressSQL, [user.user_id, ws.workstream_id, ws.workstream_id, user.user_id, ws.workstream_id, ws.workstream_id], (err, progressResult) => {
                                    if (err) {
                                        console.error('Error calculating progress:', err);
                                        resolveProgress(0);
                                    } else {
                                        resolveProgress(progressResult[0]?.progress || 0);
                                    }
                                });
                            });
                        });
                        
                        Promise.all(progressPromises).then(progressValues => {
                            // Filter out null/undefined values and convert to numbers
                            const validProgress = progressValues
                                .filter(p => p !== null && p !== undefined && !isNaN(p))
                                .map(p => Number(p));
                            
                            const averageProgress = validProgress.length > 0 ? 
                                validProgress.reduce((sum, p) => sum + p, 0) / validProgress.length : 0;
                            
                            // Count workstreams that are 100% completed
                            const completedWorkstreams = validProgress.filter(p => p >= 100).length;
                            
                            // Determine status based on completion
                            const status = completedWorkstreams === workstreams.length && workstreams.length > 0 ? 'Completed' : 'Pending';
                            
                            resolve({
                                ...user,
                                average_progress: averageProgress,
                                total_workstreams: workstreams.length,
                                workstreams_with_progress: completedWorkstreams,
                                status: status
                            });
                        });
                    });
                });
            }));
            
            // Sort by average progress
            usersWithProgress.sort((a, b) => b.average_progress - a.average_progress);
            
            console.log('Employee leaderboard with progress:', usersWithProgress);
            res.json(usersWithProgress);
        });
    });
});

export default router;
