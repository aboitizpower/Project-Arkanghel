import express from 'express';

const router = express.Router();

// Get KPIs data for analytics dashboard
router.get('/admin/analytics/kpis', (req, res) => {
    const { workstreamId } = req.query;
    
    try {
        // Query 1: Total Users (all users in database)
        const totalUsersQuery = `SELECT COUNT(*) as totalUsers FROM users WHERE isAdmin = FALSE`;
        
        req.db.query(totalUsersQuery, (err1, totalUsersResult) => {
            if (err1) {
                console.error('Error fetching total users:', err1);
                return res.status(500).json({ error: 'Failed to fetch total users: ' + err1.message });
            }
            
            // Query 2: Average Assessment Scores (simplified)
            const avgScoreQuery = `
                SELECT COALESCE(AVG(ans.score), 0) * 100 as averageScore
                FROM answers ans
            `;
            
            req.db.query(avgScoreQuery, (err2, avgScoreResult) => {
                if (err2) {
                    console.error('Error fetching average score:', err2);
                    return res.status(500).json({ error: 'Failed to fetch average score: ' + err2.message });
                }
                
                // Query 3: Calculate progress - simplified approach
                let progressQuery, progressParams = [];
                
                if (workstreamId && workstreamId !== 'all') {
                    // SPECIFIC WORKSTREAM: Count users who have 100% progress in THIS specific workstream
                    progressQuery = `
                        SELECT 
                            COUNT(CASE WHEN user_progress >= 100 THEN 1 END) as completed,
                            COUNT(CASE WHEN user_progress < 100 OR user_progress IS NULL THEN 1 END) as pending
                        FROM (
                            SELECT 
                                u.user_id,
                                CASE 
                                    WHEN total_items = 0 THEN 100
                                    ELSE COALESCE((completed_items * 100.0 / total_items), 0)
                                END as user_progress
                            FROM users u
                            CROSS JOIN (
                                SELECT 
                                    COUNT(DISTINCT mc.chapter_id) + COUNT(DISTINCT a.assessment_id) as total_items
                                FROM module_chapters mc
                                LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                                WHERE mc.workstream_id = ? AND mc.is_published = TRUE
                            ) totals
                            LEFT JOIN (
                                SELECT 
                                    u.user_id,
                                    COUNT(DISTINCT completed_chapters.chapter_id) + COUNT(DISTINCT passed_assessments.assessment_id) as completed_items
                                FROM users u
                                LEFT JOIN (
                                    SELECT up.user_id, up.chapter_id
                                    FROM user_progress up
                                    JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                                    WHERE up.is_completed = TRUE 
                                      AND mc.workstream_id = ? 
                                      AND mc.is_published = TRUE
                                ) completed_chapters ON u.user_id = completed_chapters.user_id
                                LEFT JOIN (
                                    SELECT DISTINCT ans.user_id, a.assessment_id
                                    FROM answers ans
                                    JOIN questions q ON ans.question_id = q.question_id
                                    JOIN assessments a ON q.assessment_id = a.assessment_id
                                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                    WHERE mc.workstream_id = ? 
                                      AND mc.is_published = TRUE
                                    GROUP BY ans.user_id, a.assessment_id
                                    HAVING (SUM(ans.score) / COUNT(q.question_id)) >= 0.75
                                ) passed_assessments ON u.user_id = passed_assessments.user_id
                                WHERE u.isAdmin = FALSE
                                GROUP BY u.user_id
                            ) progress_calc ON u.user_id = progress_calc.user_id
                            WHERE u.isAdmin = FALSE
                              AND (
                                NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id)
                                OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id AND uwp.workstream_id = ? AND uwp.has_access = TRUE)
                              )
                        ) user_workstream_progress
                    `;
                    progressParams = [workstreamId, workstreamId, workstreamId, workstreamId];
                } else {
                    // ALL WORKSTREAMS: User is completed only if they have 100% on ALL available workstreams
                    progressQuery = `
                        SELECT 
                            COUNT(CASE WHEN all_workstreams_complete = 1 THEN 1 END) as completed,
                            COUNT(CASE WHEN all_workstreams_complete = 0 THEN 1 END) as pending
                        FROM (
                            SELECT 
                                u.user_id,
                                CASE 
                                    WHEN COUNT(CASE WHEN COALESCE(workstream_progress, 0) < 100 THEN 1 END) = 0 
                                         AND COUNT(ws.workstream_id) > 0 
                                    THEN 1 
                                    ELSE 0 
                                END as all_workstreams_complete
                            FROM users u
                            LEFT JOIN (
                                SELECT 
                                    u.user_id,
                                    ws.workstream_id,
                                    CASE 
                                        WHEN total_items = 0 THEN 100
                                        ELSE COALESCE((completed_items * 100.0 / total_items), 0)
                                    END as workstream_progress
                                FROM users u
                                CROSS JOIN workstreams ws
                                LEFT JOIN (
                                    SELECT 
                                        u.user_id,
                                        ws.workstream_id,
                                        COUNT(DISTINCT completed_chapters.chapter_id) + COUNT(DISTINCT passed_assessments.assessment_id) as completed_items,
                                        (
                                            SELECT COUNT(DISTINCT mc.chapter_id) + COUNT(DISTINCT a.assessment_id)
                                            FROM module_chapters mc
                                            LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                                            WHERE mc.workstream_id = ws.workstream_id AND mc.is_published = TRUE
                                        ) as total_items
                                    FROM users u
                                    CROSS JOIN workstreams ws
                                    LEFT JOIN (
                                        SELECT up.user_id, up.chapter_id
                                        FROM user_progress up
                                        JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                                        WHERE up.is_completed = TRUE 
                                          AND mc.is_published = TRUE
                                    ) completed_chapters ON u.user_id = completed_chapters.user_id 
                                        AND EXISTS (
                                            SELECT 1 FROM module_chapters mc2 
                                            WHERE mc2.chapter_id = completed_chapters.chapter_id 
                                              AND mc2.workstream_id = ws.workstream_id
                                        )
                                    LEFT JOIN (
                                        SELECT DISTINCT ans.user_id, a.assessment_id
                                        FROM answers ans
                                        JOIN questions q ON ans.question_id = q.question_id
                                        JOIN assessments a ON q.assessment_id = a.assessment_id
                                        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                        WHERE mc.is_published = TRUE
                                        GROUP BY ans.user_id, a.assessment_id
                                        HAVING (SUM(ans.score) / COUNT(q.question_id)) >= 0.75
                                    ) passed_assessments ON u.user_id = passed_assessments.user_id
                                        AND EXISTS (
                                            SELECT 1 FROM assessments a2
                                            JOIN module_chapters mc2 ON a2.chapter_id = mc2.chapter_id
                                            WHERE a2.assessment_id = passed_assessments.assessment_id
                                              AND mc2.workstream_id = ws.workstream_id
                                        )
                                    WHERE u.isAdmin = FALSE
                                      AND ws.is_published = TRUE
                                      AND (
                                        NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id)
                                        OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id AND uwp.workstream_id = ws.workstream_id AND uwp.has_access = TRUE)
                                      )
                                    GROUP BY u.user_id, ws.workstream_id
                                ) progress_calc ON u.user_id = progress_calc.user_id AND ws.workstream_id = progress_calc.workstream_id
                                WHERE u.isAdmin = FALSE
                                  AND ws.is_published = TRUE
                                  AND (
                                    NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id)
                                    OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id AND uwp.workstream_id = ws.workstream_id AND uwp.has_access = TRUE)
                                  )
                            ) ws ON u.user_id = ws.user_id
                            WHERE u.isAdmin = FALSE
                            GROUP BY u.user_id
                        ) user_completion_status
                    `;
                }
                
                req.db.query(progressQuery, progressParams, (err3, progressResult) => {
                    if (err3) {
                        console.error('Error fetching progress data:', err3);
                        console.error('SQL Query:', progressQuery);
                        console.error('Parameters:', progressParams);
                        
                        // If query fails, return realistic values based on actual user count
                        console.error('Progress query failed, returning zero completed users');
                        return res.json({
                            totalUsers: totalUsersResult[0]?.totalUsers || 0,
                            averageScore: Math.round(avgScoreResult[0]?.averageScore || 0),
                            userProgress: {
                                completed: 0,
                                pending: totalUsersResult[0]?.totalUsers || 0
                            }
                        });
                    }
                    
                    // Debug: Check which users are being counted
                    if (workstreamId && workstreamId !== 'all') {
                        const debugQuery = `
                            SELECT 
                                u.user_id,
                                u.email,
                                u.isAdmin,
                                CASE 
                                    WHEN total_items = 0 THEN 100
                                    ELSE COALESCE((completed_items * 100.0 / total_items), 0)
                                END as user_progress
                            FROM users u
                            CROSS JOIN (
                                SELECT 
                                    COUNT(DISTINCT mc.chapter_id) + COUNT(DISTINCT a.assessment_id) as total_items
                                FROM module_chapters mc
                                LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                                WHERE mc.workstream_id = ? AND mc.is_published = TRUE
                            ) totals
                            LEFT JOIN (
                                SELECT 
                                    u.user_id,
                                    COUNT(DISTINCT CASE WHEN up.is_completed = TRUE THEN up.chapter_id END) +
                                    COUNT(DISTINCT CASE WHEN assessment_passed.assessment_id IS NOT NULL THEN assessment_passed.assessment_id END) as completed_items
                                FROM users u
                                LEFT JOIN user_progress up ON u.user_id = up.user_id
                                LEFT JOIN module_chapters mc ON up.chapter_id = mc.chapter_id AND mc.workstream_id = ? AND mc.is_published = TRUE
                                LEFT JOIN (
                                    SELECT DISTINCT
                                        ans.user_id,
                                        a.assessment_id
                                    FROM answers ans
                                    JOIN questions q ON ans.question_id = q.question_id
                                    JOIN assessments a ON q.assessment_id = a.assessment_id
                                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                    WHERE mc.workstream_id = ? AND mc.is_published = TRUE
                                    GROUP BY ans.user_id, a.assessment_id
                                    HAVING (SUM(ans.score) / COUNT(q.question_id)) >= 0.75
                                ) assessment_passed ON u.user_id = assessment_passed.user_id
                                WHERE u.isAdmin = FALSE
                                GROUP BY u.user_id
                            ) progress_calc ON u.user_id = progress_calc.user_id
                            WHERE u.isAdmin = FALSE
                              AND (
                                NOT EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id)
                                OR EXISTS (SELECT 1 FROM user_workstream_permissions uwp WHERE uwp.user_id = u.user_id AND uwp.workstream_id = ? AND uwp.has_access = TRUE)
                              )
                            ORDER BY u.user_id
                        `;
                        
                        req.db.query(debugQuery, [workstreamId, workstreamId, workstreamId, workstreamId], (debugErr, debugResult) => {
                            if (!debugErr) {
                                console.log('\n=== DEBUG: Users counted in workstream progress ===');
                                console.log('Workstream ID:', workstreamId);
                                
                                // Also get detailed breakdown
                                const detailQuery = `
                                    SELECT 
                                        u.user_id,
                                        u.email,
                                        (SELECT COUNT(DISTINCT mc.chapter_id) + COUNT(DISTINCT a.assessment_id)
                                         FROM module_chapters mc
                                         LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                                         WHERE mc.workstream_id = ? AND mc.is_published = TRUE) as total_items,
                                        COUNT(DISTINCT completed_chapters.chapter_id) + COUNT(DISTINCT passed_assessments.assessment_id) as completed_items
                                    FROM users u
                                    LEFT JOIN (
                                        SELECT up.user_id, up.chapter_id
                                        FROM user_progress up
                                        JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                                        WHERE up.is_completed = TRUE 
                                          AND mc.workstream_id = ? 
                                          AND mc.is_published = TRUE
                                    ) completed_chapters ON u.user_id = completed_chapters.user_id
                                    LEFT JOIN (
                                        SELECT DISTINCT ans.user_id, a.assessment_id
                                        FROM answers ans
                                        JOIN questions q ON ans.question_id = q.question_id
                                        JOIN assessments a ON q.assessment_id = a.assessment_id
                                        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                                        WHERE mc.workstream_id = ? 
                                          AND mc.is_published = TRUE
                                        GROUP BY ans.user_id, a.assessment_id
                                        HAVING (SUM(ans.score) / COUNT(q.question_id)) >= 0.75
                                    ) passed_assessments ON u.user_id = passed_assessments.user_id
                                    WHERE u.isAdmin = FALSE
                                    GROUP BY u.user_id, u.email
                                `;
                                
                                req.db.query(detailQuery, [workstreamId, workstreamId, workstreamId], (detailErr, detailResult) => {
                                    if (!detailErr) {
                                        debugResult.forEach(user => {
                                            const detail = detailResult.find(d => d.user_id === user.user_id);
                                            console.log(`User ${user.user_id} (${user.email}) - Admin: ${user.isAdmin} - Progress: ${user.user_progress}%`);
                                            if (detail) {
                                                console.log(`  -> Completed: ${detail.completed_items}/${detail.total_items} items`);
                                            }
                                        });
                                    }
                                });
                                console.log('===============================================\n');
                            }
                        });
                    }
                    
                    const completed = progressResult[0]?.completed;
                    const pending = progressResult[0]?.pending;
                    
                    console.log('Progress query result:', { completed, pending });
                    console.log('Raw progress result:', progressResult);
                    
                    // Handle null values properly - show actual data even if zero
                    const actualCompleted = completed || 0;
                    const actualPending = pending || 0;
                    
                    // If both are zero, it means no users have any progress yet
                    const totalNonAdminUsers = totalUsersResult[0]?.totalUsers || 0;
                    const finalPending = (actualCompleted === 0 && actualPending === 0) ? totalNonAdminUsers : actualPending;
                    
                    console.log('Actual progress result:', { completed: actualCompleted, pending: finalPending });
                    
                    res.json({
                        totalUsers: totalUsersResult[0]?.totalUsers || 0,
                        averageScore: Math.round(avgScoreResult[0]?.averageScore || 0),
                        userProgress: {
                            completed: actualCompleted,
                            pending: finalPending
                        }
                    });
                });
            });
        });
    } catch (error) {
        console.error('KPIs endpoint error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Get engagement data for analytics dashboard
router.get('/admin/analytics/engagement', (req, res) => {
    const range = req.query?.range || 'monthly';
    
    try {
        // First, get detailed activities for today
        const today = new Date().toISOString().split('T')[0];
        const detailedSql = `
            -- Chapter Completions
            SELECT 'chapter_completion' as activity_type, u.user_id, u.email, up.completion_time as timestamp
            FROM user_progress up
            JOIN users u ON up.user_id = u.user_id
            WHERE DATE(up.completion_time) = ?
            
            UNION ALL
            
            -- Question Answers
            SELECT 'question_answered' as activity_type, u.user_id, u.email, a.answered_at as timestamp
            FROM answers a
            JOIN users u ON a.user_id = u.user_id
            WHERE DATE(a.answered_at) = ?
            
            UNION ALL
            
            -- New Users
            SELECT 'new_user' as activity_type, user_id, email, created_at as timestamp
            FROM users
            WHERE isAdmin = FALSE AND DATE(created_at) = ?
            
            ORDER BY timestamp DESC
        `;
        
        // Log detailed activities
        req.db.query(detailedSql, [today, today, today], (err, activities) => {
            if (err) {
                console.error('Error fetching detailed activities:', err);
            } else {
                console.log(`\n=== Activities for ${today} ===`);
                console.log('Activity Type'.padEnd(20), 'User ID'.padEnd(10), 'Email'.padEnd(30), 'Timestamp');
                console.log('-'.repeat(70));
                
                const activityCounts = {};
                const uniqueUsers = new Set();
                
                activities.forEach(activity => {
                    console.log(
                        activity.activity_type.padEnd(20),
                        activity.user_id.toString().padEnd(10),
                        activity.email.padEnd(30),
                        activity.timestamp
                    );
                    
                    activityCounts[activity.activity_type] = (activityCounts[activity.activity_type] || 0) + 1;
                    uniqueUsers.add(activity.user_id);
                });
                
                console.log('\nActivity breakdown:');
                Object.entries(activityCounts).forEach(([type, count]) => {
                    console.log(`- ${type}: ${count} activities`);
                });
                console.log(`Unique users engaged today: ${uniqueUsers.size}`);
                console.log('==========================================\n');
            }
        });
        
        // Determine date range and format based on the requested range
        let dateInterval, dateFormat, groupByFormat;
        
        switch (range) {
            case 'weekly':
                dateInterval = '7 DAY';
                dateFormat = '%Y-%m-%d';
                groupByFormat = '%Y-%m-%d';
                break;
            case 'monthly':
                dateInterval = '30 DAY';
                dateFormat = '%Y-%m-%d';
                groupByFormat = '%Y-%m-%d';
                break;
            case 'quarterly':
                dateInterval = '3 MONTH';
                dateFormat = '%Y-%m';
                groupByFormat = '%Y-%m';
                break;
            case 'yearly':
                dateInterval = '12 MONTH';
                dateFormat = '%Y-%m';
                groupByFormat = '%Y-%m';
                break;
            default:
                dateInterval = '30 DAY';
                dateFormat = '%Y-%m-%d';
                groupByFormat = '%Y-%m-%d';
        }
        
        const sql = `
            SELECT 
                DATE_FORMAT(activity_date, '${dateFormat}') as date,
                COUNT(*) as value
            FROM (
                -- Chapter Completions
                SELECT up.completion_time as activity_date
                FROM user_progress up
                JOIN users u ON up.user_id = u.user_id
                WHERE u.isAdmin = FALSE 
                  AND up.completion_time >= DATE_SUB(NOW(), INTERVAL ${dateInterval})
                  AND up.completion_time IS NOT NULL
                
                UNION ALL
                
                -- Assessment Completions (one per assessment, not per question)
                SELECT MIN(ans.answered_at) as activity_date
                FROM answers ans
                JOIN questions q ON ans.question_id = q.question_id
                JOIN users u ON ans.user_id = u.user_id
                WHERE u.isAdmin = FALSE 
                  AND ans.answered_at >= DATE_SUB(NOW(), INTERVAL ${dateInterval})
                  AND ans.answered_at IS NOT NULL
                GROUP BY ans.user_id, q.assessment_id
                
                UNION ALL
                
                -- New User Registrations
                SELECT u.created_at as activity_date
                FROM users u
                WHERE u.isAdmin = FALSE 
                  AND u.created_at >= DATE_SUB(NOW(), INTERVAL ${dateInterval})
            ) activities
            GROUP BY DATE_FORMAT(activity_date, '${groupByFormat}')
            ORDER BY date ASC
        `;
        
        console.log(`\nEngagement query for range '${range}':`);
        console.log(`Date interval: ${dateInterval}, Format: ${dateFormat}`);
        
        req.db.query(sql, (err, results) => {
            if (err) {
                console.error('Error fetching engagement data:', err);
                return res.status(500).json({ error: 'Failed to fetch engagement data: ' + err.message });
            }
            
            console.log(`Engagement results for ${range}:`, results);
            
            // Log today's specific count if it exists
            const todayResult = results.find(r => r.date === today || r.date.includes(today.substring(0, 7)));
            if (todayResult) {
                console.log(`Today's engagement count (${todayResult.date}): ${todayResult.value}`);
            }
            
            res.json(results || []);
        });
    } catch (error) {
        console.error('Engagement endpoint error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

// Get assessment tracker data
router.get('/admin/analytics/assessment-tracker', (req, res) => {
    const sql = `
        SELECT 
            w.title,
            COALESCE(COUNT(CASE WHEN (best_scores.best_percentage >= 75) THEN 1 END), 0) as passed,
            COALESCE(COUNT(CASE WHEN (best_scores.best_percentage < 75 AND best_scores.best_percentage IS NOT NULL) THEN 1 END), 0) as failed
        FROM workstreams w
        JOIN module_chapters mc ON w.workstream_id = mc.workstream_id
        JOIN assessments a ON mc.chapter_id = a.chapter_id
        LEFT JOIN (
            SELECT 
                assessment_id,
                user_id,
                MAX(attempt_percentage) as best_percentage
            FROM (
                SELECT 
                    q.assessment_id,
                    ans.user_id,
                    ans.answered_at,
                    (SUM(ans.score) * 100.0 / COUNT(q.question_id)) as attempt_percentage
                FROM answers ans
                JOIN questions q ON ans.question_id = q.question_id
                JOIN assessments a ON q.assessment_id = a.assessment_id
                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                WHERE mc.title LIKE '%Final Assessment%'
                GROUP BY q.assessment_id, ans.user_id, ans.answered_at
            ) user_attempts
            GROUP BY assessment_id, user_id
        ) best_scores ON a.assessment_id = best_scores.assessment_id
        WHERE w.is_published = TRUE 
          AND mc.is_published = TRUE 
          AND mc.title LIKE '%Final Assessment%'
        GROUP BY w.workstream_id, w.title
        HAVING (passed + failed) > 0
        ORDER BY w.title
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching assessment tracker:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json(results || []);
    });
});

// Get critical learning areas
router.get('/admin/analytics/critical-areas', (req, res) => {
    const sql = `
        SELECT 
            w.title as area,
            AVG(ans_summary.avg_score * 100) as avg_percentage
        FROM workstreams w
        JOIN module_chapters mc ON w.workstream_id = mc.workstream_id
        JOIN assessments a ON mc.chapter_id = a.chapter_id
        LEFT JOIN (
            SELECT 
                q.assessment_id,
                AVG(ans.score) as avg_score,
                COUNT(DISTINCT ans.user_id) as user_count
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            GROUP BY q.assessment_id
        ) ans_summary ON a.assessment_id = ans_summary.assessment_id
        WHERE w.is_published = TRUE 
          AND mc.is_published = TRUE
          AND ans_summary.user_count >= 2
          AND ans_summary.avg_score IS NOT NULL
        GROUP BY w.workstream_id, w.title
        HAVING avg_percentage < 70
        ORDER BY avg_percentage ASC
        LIMIT 5
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching critical areas:', err);
            return res.status(500).json({ error: err.message });
        }
        
        const areas = results.map(row => row.area);
        res.json(areas);
    });
});

// Get analytics data for admin - Used by A_Analytics.jsx (legacy endpoint)
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
            COALESCE((
                SELECT AVG(percentage_score)
                FROM (
                    SELECT 
                        (SUM(ans.score) * 100.0 / COUNT(q.question_id)) as percentage_score
                    FROM answers ans
                    JOIN questions q ON ans.question_id = q.question_id
                    GROUP BY ans.user_id, q.assessment_id
                ) as user_assessments
            ), 0) as average_score
    `;
    
    req.db.query(statsSql, (err, statsResults) => {
        if (err) {
            console.error('Error fetching analytics stats:', err);
            return res.status(500).json({ error: err.message });
        }
        
        // Get user engagement data
        const engagementSql = `
            SELECT 
                u.user_id,
                u.first_name,
                u.last_name,
                COUNT(DISTINCT up.chapter_id) as chapters_viewed,
                COUNT(DISTINCT ans.question_id) as questions_answered,
                COALESCE(AVG(ans.score), 0) as average_score,
                MAX(COALESCE(up.completion_time, ans.answered_at)) as last_activity
            FROM users u
            LEFT JOIN user_progress up ON u.user_id = up.user_id
            LEFT JOIN answers ans ON u.user_id = ans.user_id
            WHERE u.isAdmin = FALSE
            GROUP BY u.user_id, u.first_name, u.last_name
            ORDER BY last_activity DESC
            LIMIT 20
        `;
        
        req.db.query(engagementSql, [], (err, engagementResults) => {
            if (err) {
                console.error('Error fetching engagement data:', err);
                return res.status(500).json({ error: err.message });
            }
            
            // Get workstream performance data
            const workstreamSql = `
                SELECT 
                    w.workstream_id,
                    w.title,
                    COUNT(DISTINCT up.user_id) as users_enrolled,
                    COUNT(DISTINCT ans.user_id) as users_assessed,
                    COALESCE(AVG(ans.score), 0) as average_assessment_score,
                    COUNT(DISTINCT mc.chapter_id) as total_chapters,
                    COUNT(DISTINCT CASE WHEN mc.is_published = TRUE THEN mc.chapter_id END) as published_chapters
                FROM workstreams w
                LEFT JOIN module_chapters mc ON w.workstream_id = mc.workstream_id
                LEFT JOIN user_progress up ON mc.chapter_id = up.chapter_id
                LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id
                LEFT JOIN answers ans ON a.assessment_id = (SELECT q.assessment_id FROM questions q WHERE q.question_id = ans.question_id LIMIT 1)
                GROUP BY w.workstream_id, w.title
                ORDER BY users_enrolled DESC
            `;
            
            req.db.query(workstreamSql, [], (err, workstreamResults) => {
                if (err) {
                    console.error('Error fetching workstream performance:', err);
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
