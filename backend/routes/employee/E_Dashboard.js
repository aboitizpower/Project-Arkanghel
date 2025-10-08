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
    
    // Debug logging
    console.log('🔍 EMPLOYEE DASHBOARD ROUTE HIT');
    console.log('🔍 Request URL:', req.url);
    console.log('🔍 Request user from token:', req.user);
    console.log('🔍 Requested userId:', userId);
    
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
            
            // 2. Get workstreams with progress data (using E_Modules logic)
            const workstreamsSql = `
                SELECT 
                    w.workstream_id,
                    w.title,
                    w.description,
                    w.image_type,
                    (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE) as chapters_count,
                    (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title NOT LIKE '%Final Assessment%') as regular_chapters_count,
                    (
                        SELECT COUNT(DISTINCT a.assessment_id) 
                        FROM assessments a
                        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                        WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE
                    ) as assessments_count,
                    COALESCE((
                        SELECT 
                            CASE 
                                WHEN total_items = 0 THEN 0
                                ELSE (completed_items * 100.0) / total_items
                            END
                        FROM (
                            SELECT 
                                -- Count completed chapters
                                COALESCE((
                                    SELECT COUNT(DISTINCT up.chapter_id)
                                    FROM user_progress up
                                    JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                                    WHERE up.user_id = ? 
                                      AND mc.workstream_id = w.workstream_id 
                                      AND up.is_completed = TRUE
                                      AND mc.is_published = TRUE
                                ), 0) +
                                -- Count passed assessments (75% passing threshold)
                                COALESCE((
                                    SELECT COUNT(DISTINCT a.assessment_id)
                                    FROM assessments a
                                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                    WHERE mc.workstream_id = w.workstream_id 
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
                                -- Total chapters + assessments
                                COALESCE((
                                    SELECT COUNT(*) 
                                    FROM module_chapters mc 
                                    WHERE mc.workstream_id = w.workstream_id 
                                      AND mc.is_published = TRUE
                                ), 0) +
                                COALESCE((
                                    SELECT COUNT(DISTINCT a.assessment_id) 
                                    FROM assessments a 
                                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                                    WHERE mc.workstream_id = w.workstream_id 
                                      AND mc.is_published = TRUE
                                ), 0) as total_items
                        ) as progress_calc
                    ), 0) as progress,
                    (
                        SELECT 
                            CASE 
                                WHEN total_items = 0 THEN FALSE
                                ELSE completed_items = total_items
                            END
                        FROM (
                            SELECT 
                                -- Count completed chapters
                                COALESCE((
                                    SELECT COUNT(DISTINCT up.chapter_id)
                                    FROM user_progress up
                                    JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                                    WHERE up.user_id = ? 
                                      AND mc.workstream_id = w.workstream_id 
                                      AND up.is_completed = TRUE
                                      AND mc.is_published = TRUE
                                ), 0) +
                                -- Count passed assessments (75% passing threshold)
                                COALESCE((
                                    SELECT COUNT(DISTINCT a.assessment_id)
                                    FROM assessments a
                                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                    WHERE mc.workstream_id = w.workstream_id 
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
                                -- Total chapters + assessments
                                COALESCE((
                                    SELECT COUNT(*) 
                                    FROM module_chapters mc 
                                    WHERE mc.workstream_id = w.workstream_id 
                                      AND mc.is_published = TRUE
                                ), 0) +
                                COALESCE((
                                    SELECT COUNT(DISTINCT a.assessment_id) 
                                    FROM assessments a 
                                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                                    WHERE mc.workstream_id = w.workstream_id 
                                      AND mc.is_published = TRUE
                                ), 0) as total_items
                        ) as completion_calc
                    ) as is_completed
                FROM workstreams w
                WHERE w.is_published = TRUE
                  AND (
                    NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ?)
                    OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = ? AND uwp.workstream_id = w.workstream_id AND uwp.has_access = TRUE)
                  )
                ORDER BY w.created_at ASC
            `;
            
            req.db.query(workstreamsSql, [userId, userId, userId, userId, userId, userId], (wsErr, workstreamsResults) => {
                if (wsErr) {
                    console.error('[ERROR] Detailed error fetching workstreams:', wsErr);
                    return req.db.rollback(() => {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to fetch workstreams. Please try again.',
                            details: wsErr.message
                        });
                    });
                }
                
                console.log(`[INFO] Found ${workstreamsResults.length} workstreams for user ${userId}`);
                
                // 3. Calculate KPIs based on workstream data
                let totalWorkstreams = workstreamsResults.length;
                let completedWorkstreams = workstreamsResults.filter(ws => ws.is_completed === 1).length;
                let inProgressWorkstreams = workstreamsResults.filter(ws => ws.progress > 0 && ws.progress < 100).length;
                
                // Calculate total chapters and assessments across all workstreams
                let totalChapters = 0;
                let totalAssessments = 0;
                
                workstreamsResults.forEach(ws => {
                    totalChapters += ws.chapters_count || 0;
                    totalAssessments += ws.assessments_count || 0;
                });
                
                const totalModules = totalChapters + totalAssessments;
                
                // Calculate average progress
                let totalProgress = 0;
                let activeWorkstreams = 0;
                
                workstreamsResults.forEach(ws => {
                    if (ws.chapters_count > 0 || ws.assessments_count > 0) {
                        totalProgress += ws.progress || 0;
                        activeWorkstreams++;
                    }
                });
                
                const averageProgress = activeWorkstreams > 0 
                    ? Math.round(totalProgress / activeWorkstreams) 
                    : 0;
                
                // 4. Get recent activity
                const activitySql = `
                    SELECT 
                        up.progress_id,
                        up.chapter_id,
                        up.is_completed as status,
                        up.completion_time as completed_at,
                        up.completion_time as updated_at,
                        mc.title as chapter_title,
                        w.workstream_id,
                        w.title as workstream_title,
                        a.assessment_id
                    FROM user_progress up
                    JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                    JOIN workstreams w ON mc.workstream_id = w.workstream_id
                    LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                    WHERE up.user_id = ? AND up.is_completed = TRUE
                    ORDER BY up.completion_time DESC
                    LIMIT 5
                `;
                
                req.db.query(activitySql, [userId], (activityErr, activityResults) => {
                    if (activityErr) {
                        console.error('[ERROR] Error fetching recent activity:', activityErr);
                        // Don't fail the whole request if activity fetch fails
                        console.warn('[WARN] Continuing without recent activity data');
                    }
                    
                    // 5. Skip deadlines since assessments table doesn't have due_date column
                    const deadlineResults = [];
                    console.log('[INFO] Skipping deadlines - due_date column not available');
                    
                        // 6. Skip achievements since table doesn't exist
                        const achieveResults = [];
                        console.log('[INFO] Skipping achievements - table not available');
                            
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
                                total_workstreams: totalWorkstreams,
                                total_modules: totalModules,
                                completed_modules: 0, // This would need additional calculation if needed
                                pending_modules: 0, // This would need additional calculation if needed
                                average_progress: averageProgress,
                                active_workstreams: inProgressWorkstreams,
                                completed_workstreams: completedWorkstreams
                            },
                            workstreams: workstreamsResults.map(ws => ({
                                ...ws,
                                id: ws.workstream_id,
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

export default router;
