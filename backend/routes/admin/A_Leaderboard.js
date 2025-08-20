import express from 'express';

const router = express.Router();

// Get leaderboard data for admin view - Used by A_Leaderboard.jsx
router.get('/admin/leaderboard', (req, res) => {
    // First check if we have any users at all
    const checkUsersSQL = 'SELECT COUNT(*) as total_users, COUNT(CASE WHEN isAdmin = FALSE THEN 1 END) as non_admin_users FROM users';
    
    req.db.query(checkUsersSQL, (err, checkResults) => {
        if (err) {
            console.error('Error checking users:', err);
            return res.status(500).json({ error: 'Database error checking users' });
        }
        
        console.log('User count check:', checkResults[0]);
        
        // If no non-admin users, return empty array
        if (checkResults[0].non_admin_users === 0) {
            console.log('No non-admin users found, returning empty array');
            return res.json([]);
        }
        
        // First get basic user data, then calculate progress separately
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
                console.error('Leaderboard SQL error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Calculate average progress for each user across their accessible workstreams
            const usersWithProgress = await Promise.all(results.map(async (user) => {
                return new Promise((resolve) => {
                    // Get workstreams accessible to this user
                    const workstreamAccessSQL = `
                        SELECT DISTINCT w.workstream_id
                        FROM workstreams w
                        WHERE w.is_published = TRUE
                          AND (
                            NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ?)
                            OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ? AND uwp.workstream_id = w.workstream_id AND uwp.has_access = TRUE)
                          )
                    `;
                    
                    req.db.query(workstreamAccessSQL, [user.user_id, user.user_id], (err, workstreams) => {
                        if (err) {
                            console.error('Error getting workstream access:', err);
                            resolve({ ...user, average_progress: 0, total_workstreams: 0, workstreams_with_progress: 0 });
                            return;
                        }
                        
                        if (workstreams.length === 0) {
                            resolve({ ...user, average_progress: 0, total_workstreams: 0, workstreams_with_progress: 0 });
                            return;
                        }
                        
                        // Calculate progress for each accessible workstream
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
                            console.log(`Progress values for user ${user.user_id}:`, progressValues);
                            
                            // Filter out null/undefined values and convert to numbers
                            const validProgress = progressValues
                                .filter(p => p !== null && p !== undefined && !isNaN(p))
                                .map(p => Number(p));
                            
                            const averageProgress = validProgress.length > 0 ? 
                                validProgress.reduce((sum, p) => sum + p, 0) / validProgress.length : 0;
                            
                            // Count workstreams that are 100% completed
                            const completedWorkstreams = validProgress.filter(p => p >= 100).length;
                            
                            console.log(`User ${user.user_id} - Average: ${averageProgress}, Completed: ${completedWorkstreams}/${workstreams.length}`);
                            
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
            
            console.log('Leaderboard with progress:', usersWithProgress);
            res.json(usersWithProgress);
        });
    });
});

// Get leaderboard data filtered by specific workstream
router.get('/admin/leaderboard/workstream/:workstreamId', (req, res) => {
    const { workstreamId } = req.params;
    
    // First check if we have any users at all
    const checkUsersSQL = 'SELECT COUNT(*) as total_users, COUNT(CASE WHEN isAdmin = FALSE THEN 1 END) as non_admin_users FROM users';
    
    req.db.query(checkUsersSQL, (err, checkResults) => {
        if (err) {
            console.error('Error checking users:', err);
            return res.status(500).json({ error: 'Database error checking users' });
        }
        
        console.log('User count check for workstream filter:', checkResults[0]);
        
        // If no non-admin users, return empty array
        if (checkResults[0].non_admin_users === 0) {
            console.log('No non-admin users found, returning empty array');
            return res.json([]);
        }
        
        // Get basic user data, then calculate progress for specific workstream
        const sql = `
            SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                u.email,
                u.created_at,
                COUNT(DISTINCT CASE WHEN ans.score IS NOT NULL AND q.assessment_id IN (
                    SELECT a.assessment_id FROM assessments a 
                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                    WHERE mc.workstream_id = ?
                ) THEN q.assessment_id END) as assessments_taken,
                AVG(CASE WHEN q.assessment_id IN (
                    SELECT a.assessment_id FROM assessments a 
                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                    WHERE mc.workstream_id = ?
                ) THEN ans.score END) as average_score,
                COUNT(DISTINCT CASE WHEN up.is_completed = 1 AND mc.workstream_id = ? THEN up.chapter_id END) as chapters_completed,
                MAX(COALESCE(up.completion_time, ans.answered_at)) as last_activity
            FROM users u
            LEFT JOIN answers ans ON u.user_id = ans.user_id
            LEFT JOIN questions q ON ans.question_id = q.question_id
            LEFT JOIN user_progress up ON u.user_id = up.user_id
            LEFT JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
            WHERE u.isAdmin = FALSE
              AND (
                NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id)
                OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id AND uwp.workstream_id = ? AND uwp.has_access = TRUE)
              )
            GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.created_at
            ORDER BY chapters_completed DESC, last_activity DESC
        `;
    
        req.db.query(sql, [workstreamId, workstreamId, workstreamId, workstreamId], async (err, results) => {
            if (err) {
                console.error('Workstream leaderboard SQL error:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Calculate progress for the specific workstream for each user
            const usersWithProgress = await Promise.all(results.map(async (user) => {
                return new Promise((resolve) => {
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
                    
                    req.db.query(progressSQL, [user.user_id, workstreamId, workstreamId, user.user_id, workstreamId, workstreamId], (err, progressResult) => {
                        if (err) {
                            console.error('Error calculating workstream progress:', err);
                            resolve({
                                ...user,
                                progress_percent: 0,
                                status: 'Pending',
                                total_workstreams: 1,
                                workstreams_with_progress: 0
                            });
                        } else {
                            const progress = progressResult[0]?.progress || 0;
                            const status = progress >= 100 ? 'Completed' : 'Pending';
                            
                            resolve({
                                ...user,
                                progress_percent: progress,
                                status: status,
                                total_workstreams: 1,
                                workstreams_with_progress: progress >= 100 ? 1 : 0
                            });
                        }
                    });
                });
            }));
            
            // Sort by progress for specific workstream
            usersWithProgress.sort((a, b) => b.progress_percent - a.progress_percent);
            
            console.log('Workstream leaderboard with progress:', usersWithProgress);
            res.json(usersWithProgress);
        });
    });
});

export default router;
