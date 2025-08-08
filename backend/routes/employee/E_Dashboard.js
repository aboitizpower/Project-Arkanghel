import express from 'express';

const router = express.Router();

/**
 * @route GET /employee/dashboard/:userId
 * @description Get dashboard data for an employee
 * @access Private (Employee)
 * @param {string} userId - The ID of the employee
 * @returns {Object} Dashboard data including KPIs, workstreams, progress, and recent activity
 */
router.get('/dashboard/:userId', (req, res) => {
    const { userId } = req.params;
    
    // Input validation
    if (!userId || isNaN(parseInt(userId))) {
        console.error(`[ERROR] Invalid user ID provided: ${userId}`);
        return res.status(400).json({ 
            success: false,
            error: 'A valid user ID is required.'
        });
    }

    console.log(`[INFO] Fetching dashboard data for user ID: ${userId}`);
    
    // Start a transaction to ensure data consistency
    req.db.beginTransaction(err => {
        if (err) {
            console.error('[ERROR] Error beginning transaction:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to initialize dashboard. Please try again.'
            });
        }
        
        // 1. Get user details first
        const userSql = 'SELECT first_name, last_name, email, created_at FROM users WHERE user_id = ?';
        
        req.db.query(userSql, [userId], (userErr, userResults) => {
            if (userErr) {
                console.error('[ERROR] Error fetching user details:', userErr);
                return req.db.rollback(() => {
                    res.status(500).json({
                        success: false,
                        error: 'Failed to fetch user details. Please try again.'
                    });
                });
            }
            
            if (userResults.length === 0) {
                return req.db.rollback(() => {
                    res.status(404).json({
                        success: false,
                        error: 'User not found.'
                    });
                });
            }
            
            const user = userResults[0];
            
            // 2. Get workstreams with progress data
            const workstreamsSql = `
                SELECT 
                    w.workstream_id as id,
                    w.title,
                    w.description,
                    w.image_type,
                    w.created_at,
                    COUNT(DISTINCT mc.chapter_id) as total_chapters,
                    COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN mc.chapter_id END) as completed_chapters,
                    CASE 
                        WHEN COUNT(DISTINCT mc.chapter_id) = 0 THEN 0
                        ELSE ROUND((COUNT(DISTINCT CASE WHEN up.status = 'completed' THEN mc.chapter_id END) * 100.0) / 
                               COUNT(DISTINCT mc.chapter_id), 2)
                    END as progress,
                    MAX(up.updated_at) as last_activity
                FROM workstreams w
                LEFT JOIN module_chapters mc ON w.workstream_id = mc.workstream_id 
                    AND mc.is_published = TRUE
                    AND mc.title NOT LIKE '%Final Assessment%'
                LEFT JOIN user_progress up ON (mc.chapter_id = up.chapter_id AND up.user_id = ?)
                WHERE w.is_published = TRUE
                GROUP BY w.workstream_id, w.title, w.description, w.image_type, w.created_at
                ORDER BY last_activity DESC, w.title ASC
            `;
            
            req.db.query(workstreamsSql, [userId], (wsErr, workstreamsResults) => {
                if (wsErr) {
                    console.error('[ERROR] Error fetching workstreams:', wsErr);
                    return req.db.rollback(() => {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to fetch workstreams. Please try again.'
                        });
                    });
                }
                
                console.log(`[INFO] Found ${workstreamsResults.length} workstreams for user ${userId}`);
                
                // 3. Calculate KPIs
                let totalModules = 0;
                let completedModules = 0;
                let totalProgress = 0;
                let activeWorkstreams = 0;
                
                workstreamsResults.forEach(ws => {
                    totalModules += ws.total_chapters || 0;
                    completedModules += ws.completed_chapters || 0;
                    if (ws.total_chapters > 0) {
                        totalProgress += ws.progress || 0;
                        activeWorkstreams++;
                    }
                });
                
                const averageProgress = activeWorkstreams > 0 
                    ? Math.round(totalProgress / activeWorkstreams) 
                    : 0;
                
                const pendingModules = Math.max(0, totalModules - completedModules);
                
                // 4. Get recent activity
                const activitySql = `
                    SELECT 
                        up.progress_id,
                        up.chapter_id,
                        up.status,
                        up.completed_at,
                        up.updated_at,
                        mc.title as chapter_title,
                        w.workstream_id,
                        w.title as workstream_title,
                        a.assessment_id
                    FROM user_progress up
                    JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                    JOIN workstreams w ON mc.workstream_id = w.workstream_id
                    LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                    WHERE up.user_id = ?
                    ORDER BY up.updated_at DESC
                    LIMIT 5
                `;
                
                req.db.query(activitySql, [userId], (activityErr, activityResults) => {
                    if (activityErr) {
                        console.error('[ERROR] Error fetching recent activity:', activityErr);
                        // Don't fail the whole request if activity fetch fails
                        console.warn('[WARN] Continuing without recent activity data');
                    }
                    
                    // 5. Get upcoming deadlines (e.g., assessments due soon)
                    const deadlinesSql = `
                        SELECT 
                            a.assessment_id,
                            a.title,
                            a.due_date,
                            mc.title as chapter_title,
                            w.workstream_id,
                            w.title as workstream_title,
                            DATEDIFF(a.due_date, CURDATE()) as days_remaining
                        FROM assessments a
                        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                        JOIN workstreams w ON mc.workstream_id = w.workstream_id
                        LEFT JOIN user_progress up ON (a.chapter_id = up.chapter_id AND up.user_id = ?)
                        WHERE a.due_date IS NOT NULL 
                            AND a.due_date >= CURDATE()
                            AND (up.status IS NULL OR up.status != 'completed')
                            AND w.is_published = TRUE
                            AND mc.is_published = TRUE
                        ORDER BY a.due_date ASC
                        LIMIT 3
                    `;
                    
                    req.db.query(deadlinesSql, [userId], (deadlineErr, deadlineResults) => {
                        if (deadlineErr) {
                            console.error('[ERROR] Error fetching deadlines:', deadlineErr);
                            // Don't fail the whole request if deadlines fetch fails
                            console.warn('[WARN] Continuing without deadline data');
                        }
                        
                        // 6. Get user's achievements or badges (if applicable)
                        const achievementsSql = `
                            SELECT 
                                a.achievement_id,
                                a.name,
                                a.description,
                                a.icon_url,
                                a.completion_requirement,
                                ua.earned_at
                            FROM achievements a
                            JOIN user_achievements ua ON a.achievement_id = ua.achievement_id
                            WHERE ua.user_id = ?
                            ORDER BY ua.earned_at DESC
                            LIMIT 3
                        `;
                        
                        req.db.query(achievementsSql, [userId], (achieveErr, achieveResults) => {
                            if (achieveErr) {
                                console.error('[ERROR] Error fetching achievements:', achieveErr);
                                // Don't fail the whole request if achievements fetch fails
                                console.warn('[WARN] Continuing without achievement data');
                            }
                            
                            // Prepare the response object
                            const responseData = {
                                success: true,
                                user: {
                                    id: parseInt(userId),
                                    name: `${user.first_name} ${user.last_name}`,
                                    email: user.email,
                                    member_since: user.created_at
                                },
                                kpis: {
                                    total_workstreams: workstreamsResults.length,
                                    total_modules: totalModules,
                                    completed_modules: completedModules,
                                    pending_modules: pendingModules,
                                    average_progress: averageProgress,
                                    active_workstreams: activeWorkstreams
                                },
                                workstreams: workstreamsResults.map(ws => ({
                                    ...ws,
                                    id: ws.id,
                                    image_url: ws.image_type ? `/workstreams/${ws.id}/image` : null,
                                    last_activity: ws.last_activity || null,
                                    is_started: ws.completed_chapters > 0
                                })),
                                recent_activity: activityResults || [],
                                upcoming_deadlines: deadlineResults || [],
                                recent_achievements: achieveResults || []
                            };
                            
                            // Commit the transaction
                            req.db.commit(commitErr => {
                                if (commitErr) {
                                    console.error('[ERROR] Error committing transaction:', commitErr);
                                    return req.db.rollback(() => {
                                        res.status(500).json({
                                            success: false,
                                            error: 'Failed to complete dashboard request. Please try again.'
                                        });
                                    });
                                }
                                
                                console.log(`[INFO] Successfully fetched dashboard data for user ${userId}`);
                                res.json(responseData);
                            });
                        });
                    });
                });
            });
        });
    });
});

export default router;
