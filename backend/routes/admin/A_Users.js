import express from 'express';
import bcrypt from 'bcrypt';

const router = express.Router();

/**
 * Get detailed assessment results for a specific user
 * @param {Object} db - Database connection object
 * @param {number} userId - ID of the user
 * @param {Function} callback - Callback function (err, results)
 */
function getAssessmentResultsForUser(db, userId, callback) {
    console.log(`Admin fetching assessment results for user ID: ${userId}`);
    
    const sql = `
        WITH LatestScores AS (
            SELECT
                ans.user_id,
                q.assessment_id,
                ans.answered_at,
                SUM(ans.score) AS user_score,
                ROW_NUMBER() OVER(PARTITION BY ans.user_id, q.assessment_id ORDER BY ans.answered_at DESC) as rn
            FROM answers AS ans
            JOIN questions AS q ON ans.question_id = q.question_id
            WHERE ans.user_id = ?
            GROUP BY ans.user_id, q.assessment_id, ans.answered_at
        ),
        AttemptCounts AS (
            SELECT user_id, assessment_id, COUNT(*) AS total_attempts
            FROM LatestScores
            GROUP BY user_id, assessment_id
        )
        SELECT
            CONCAT(ls.user_id, '-', ls.assessment_id) AS result_id,
            ls.user_id,
            a.assessment_id,
            ls.user_score as score,
            a.total_points as total_questions,
            ls.answered_at AS completed_at,
            a.title AS assessment_title,
            a.total_points,
            a.passing_score,
            mc.title AS chapter_title,
            w.title AS workstream_title,
            (ls.user_score >= a.passing_score) AS passed,
            ac.total_attempts
        FROM LatestScores AS ls
        JOIN assessments AS a ON ls.assessment_id = a.assessment_id
        LEFT JOIN module_chapters AS mc ON a.chapter_id = mc.chapter_id
        LEFT JOIN workstreams AS w ON mc.workstream_id = w.workstream_id
        JOIN AttemptCounts AS ac ON ls.user_id = ac.user_id AND ls.assessment_id = ac.assessment_id
        WHERE ls.rn = 1
        ORDER BY ls.answered_at DESC
    `;
    
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(`Error fetching assessment results for user ${userId}:`, err);
            return callback(err, null);
        }
        console.log(`Found ${results.length} assessment results for user ${userId}`);
        callback(null, results);
    });
}

/**
 * @route GET /admin/users
 * @description Get all users (admin only)
 * @access Private (Admin)
 * @returns {Object} List of all users (without passwords)
 */
router.get('/users', (req, res) => {
    console.log('Admin fetching all users');
    
    const sql = `
        SELECT 
            u.user_id as id, 
            u.first_name, 
            u.last_name, 
            u.email, 
            u.isAdmin, 
            DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
            GROUP_CONCAT(uwp.workstream_id) as workstream_ids
        FROM users u
        LEFT JOIN user_workstream_permissions uwp ON u.user_id = uwp.user_id AND uwp.has_access = TRUE
        GROUP BY u.user_id, u.first_name, u.last_name, u.email, u.isAdmin, u.created_at
        ORDER BY u.created_at DESC
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch users. Please try again later.' 
            });
        }
        
        // Process workstream_ids to convert comma-separated string to array
        const processedResults = results.map(user => ({
            ...user,
            workstream_ids: user.workstream_ids ? 
                user.workstream_ids.split(',').map(id => parseInt(id)) : 
                []
        }));
        
        console.log(`Fetched ${results.length} users`);
        res.json({ 
            success: true, 
            users: processedResults 
        });
    });
});

/**
 * @route GET /admin/users/:userId/assessment-results
 * @description Get assessment results for a specific user (admin only)
 * @access Private (Admin)
 * @param {string} userId - ID of the user to get results for
 * @returns {Array} List of assessment results for the user
 */
router.get('/users/:userId/assessment-results', (req, res) => {
    const { userId } = req.params;
    console.log(`Admin fetching assessment results for user ID: ${userId}`);
    
    if (!userId || isNaN(parseInt(userId))) {
        console.warn('Invalid user ID provided:', userId);
        return res.status(400).json({
            success: false,
            error: 'A valid user ID is required.'
        });
    }
    
    getAssessmentResultsForUser(req.db, userId, (err, results) => {
        if (err) {
            console.error(`Error fetching assessment results for user ${userId}:`, err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch assessment results. Please try again later.'
            });
        }
        
        res.json({
            success: true,
            results
        });
    });
});

/**
 * @route PUT /admin/users/:id/role
 * @description Update a user's admin status (admin only)
 * @access Private (Admin)
 * @param {string} id - User ID to update
 * @param {boolean} isAdmin - Whether the user should be an admin
 * @returns {Object} Success or error message
 */
router.put('/users/:id/role', (req, res) => {
    const { id } = req.params;
    const { isAdmin } = req.body;

    console.log(`Updating role for user ${id}, isAdmin: ${isAdmin}`);

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ success: false, error: 'A valid user ID is required.' });
    }

    const performUpdate = () => {
        const sql = 'UPDATE users SET isAdmin = ? WHERE user_id = ?';
        req.db.query(sql, [isAdmin, id], (err, result) => {
            if (err) {
                console.error(`Error updating role for user ${id}:`, err);
                return res.status(500).json({ success: false, error: 'A database error occurred.' });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'User not found.' });
            }
            console.log(`Successfully updated role for user ${id}`);
            res.json({ success: true, message: 'User role updated successfully.' });
        });
    };

    // If demoting a user, first check if they are the last admin.
    if (isAdmin === false || isAdmin === 0) {
        const checkAdminCountSql = 'SELECT COUNT(*) as adminCount FROM users WHERE isAdmin = TRUE';
        req.db.query(checkAdminCountSql, (err, results) => {
            if (err) {
                console.error('Error checking admin count:', err);
                return res.status(500).json({ success: false, error: 'A database error occurred while verifying admin status.' });
            }

            const adminCount = results[0].adminCount;
            // Check if the user being demoted is currently an admin
            const checkCurrentUserSql = 'SELECT isAdmin FROM users WHERE user_id = ?';
            req.db.query(checkCurrentUserSql, [id], (err, userResult) => {
                if (err) {
                     return res.status(500).json({ success: false, error: 'A database error occurred while verifying user.' });
                }
                if (userResult.length > 0 && userResult[0].isAdmin && adminCount <= 1) {
                    console.warn(`Attempt to demote the last admin (user ID: ${id})`);
                    return res.status(403).json({ success: false, error: 'Cannot demote the last admin.' });
                }
                // If not the last admin, or not an admin at all, proceed with update.
                performUpdate();
            });
        });
    } else {
        // If promoting to admin, no special check is needed.
        performUpdate();
    }
});

/**
 * @route DELETE /admin/users/:id
 * @description Delete a user (admin only)
 * @access Private (Admin)
 * @param {string} id - ID of the user to delete
 * @returns {Object} Success or error message
 */
router.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    const requestingUserId = req.user?.user_id; // Assuming user is authenticated and user info is in req.user
    
    console.log(`Attempting to delete user ID: ${id}`);
    
    // Input validation
    if (isNaN(parseInt(id))) {
        console.warn('Invalid user ID provided for deletion:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid user ID is required.'
        });
    }
    
    // Prevent deleting own account
    if (parseInt(id) === parseInt(requestingUserId)) {
        console.warn('User attempted to delete their own account:', id);
        return res.status(400).json({
            success: false,
            error: 'You cannot delete your own account.'
        });
    }
    
    // First, check if the user is the last admin
    const checkAdminSql = 'SELECT isAdmin FROM users WHERE user_id = ?';
    req.db.query(checkAdminSql, [id], (err, results) => {
        if (err) {
            console.error('Error checking user admin status:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to verify user status. Please try again.'
            });
        }
        
        if (results.length === 0) {
            console.warn('User not found for deletion:', id);
            return res.status(404).json({
                success: false,
                error: 'User not found.'
            });
        }
        
        const userToDelete = results[0];
        
        // If the user is an admin, check if they're the last one
        if (userToDelete.isAdmin) {
            const checkAdminCountSql = 'SELECT COUNT(*) as adminCount FROM users WHERE isAdmin = TRUE';
            req.db.query(checkAdminCountSql, (err, countResults) => {
                if (err) {
                    console.error('Error checking admin count:', err);
                    return res.status(500).json({
                        success: false,
                        error: 'Failed to verify admin status. Please try again.'
                    });
                }
                
                if (countResults[0].adminCount <= 1) {
                    console.warn('Attempt to delete the last admin');
                    return res.status(400).json({
                        success: false,
                        error: 'Cannot delete the last admin. Please assign another admin first.'
                    });
                }
                
                // Proceed with deletion if there are other admins
                deleteUser();
            });
        } else {
            // Proceed with deletion for non-admin users
            deleteUser();
        }
    });
    
    function deleteUser() {
        // Use transactions to ensure data consistency
        req.db.beginTransaction(err => {
            if (err) {
                console.error('Error beginning transaction for user deletion:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to initiate user deletion. Please try again.'
                });
            }
            
            // Delete user's answers first (due to foreign key constraints)
            const deleteAnswersSql = 'DELETE FROM answers WHERE user_id = ?';
            req.db.query(deleteAnswersSql, [id], (err) => {
                if (err) {
                    console.error('Error deleting user answers:', err);
                    return req.db.rollback(() => {
                        res.status(500).json({
                            success: false,
                            error: 'Failed to delete user data. Please try again.'
                        });
                    });
                }
                
                // Finally, delete the user (no assessment_results table to clear)
                const deleteUserSql = 'DELETE FROM users WHERE user_id = ?';
                req.db.query(deleteUserSql, [id], (err, result) => {
                        if (err) {
                            console.error('Error deleting user:', err);
                            return req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to delete user. Please try again.'
                                });
                            });
                        }
                        
                        if (result.affectedRows === 0) {
                            return req.db.rollback(() => {
                                res.status(404).json({
                                    success: false,
                                    error: 'User not found.'
                                });
                            });
                        }
                        
                        // Commit the transaction
                        req.db.commit(err => {
                            if (err) {
                                console.error('Error committing transaction:', err);
                                return req.db.rollback(() => {
                                    res.status(500).json({
                                        success: false,
                                        error: 'Failed to complete user deletion. Please try again.'
                                    });
                                });
                            }
                            
                            console.log(`Successfully deleted user with ID: ${id}`);
                            res.json({
                                success: true,
                                message: 'User deleted successfully.',
                                userId: id
                            });
                        });
                    });
                });
        });
    }
});


/**
 * @route GET /users/:userId/workstreams
 * @description Get the workstreams a specific user has access to.
 * @access Private (Admin)
 * @returns {object} An object containing an array of workstream IDs.
 */
router.get('/users/:id/workstreams', (req, res) => {
    const { id } = req.params;
    console.log(`Fetching workstream access for user ID: ${id}`);

    const sql = 'SELECT workstream_id FROM user_workstream_permissions WHERE user_id = ? AND has_access = TRUE';
    
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(`Error fetching workstream access for user ${id}:`, err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch workstream permissions.'
            });
        }
        
        const workstream_ids = results.map(row => row.workstream_id);
        console.log(`User ${id} has access to workstream IDs:`, workstream_ids);
        res.json({ success: true, workstream_ids });
    });
});

/**
 * @route PUT /users/:id/workstreams
 * @description Update the workstreams a specific user has access to.
 * @access Private (Admin)
 * @param {array} workstream_ids - An array of workstream IDs the user should have access to. An empty array means access to all.
 * @returns {object} Success or error message.
 */
router.put('/users/:id/workstreams', (req, res) => {
    const { id } = req.params;
    const { workstream_ids } = req.body;

    console.log(`Updating workstream access for user ID: ${id} with workstreams:`, workstream_ids);

    if (!Array.isArray(workstream_ids)) {
        return res.status(400).json({ 
            success: false, 
            error: 'workstream_ids must be an array.' 
        });
    }

    req.db.beginTransaction(err => {
        if (err) {
            console.error('Error starting transaction for workstream access:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to update permissions.' 
            });
        }

        const deleteSql = 'DELETE FROM user_workstream_permissions WHERE user_id = ?';

        req.db.query(deleteSql, [id], (err, result) => {
            if (err) {
                console.error('Error deleting old workstream permissions:', err);
                return req.db.rollback(() => {
                    res.status(500).json({ 
                        success: false, 
                        error: 'Failed to update permissions.' 
                    });
                });
            }

            if (workstream_ids.length > 0) {
                const insertSql = 'INSERT INTO user_workstream_permissions (user_id, workstream_id, has_access) VALUES ?';
                const values = workstream_ids.map(ws_id => [id, ws_id, true]);

                req.db.query(insertSql, [values], (err, result) => {
                    if (err) {
                        console.error('Error inserting new workstream permissions:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({ 
                                success: false, 
                                error: 'Failed to update permissions.' 
                            });
                        });
                    }
                    
                    commitTransaction();
                });
            } else {
                // If the array is empty, it means the user has access to all workstreams, so we just commit after deleting the specific permissions.
                commitTransaction();
            }
        });

        const commitTransaction = () => {
            req.db.commit(err => {
                if (err) {
                    console.error('Error committing transaction for workstream access:', err);
                    return req.db.rollback(() => {
                        res.status(500).json({ 
                            success: false, 
                            error: 'Failed to save permissions.' 
                        });
                    });
                }
                console.log(`Successfully updated workstream access for user ID: ${id}`);
                res.json({ 
                    success: true, 
                    message: 'Workstream permissions updated successfully.' 
                });
            });
        };
    });
});

/**
 * @route GET /users/:id/progress-options
 * @description Get available workstreams and assessments for progress clearing options
 * @access Private (Admin)
 * @param {string} id - ID of the user
 * @returns {Object} Available workstreams and assessments for the user
 */
router.get('/users/:id/progress-options', (req, res) => {
    const { id } = req.params;
    
    console.log(`Fetching progress options for user ID: ${id}`);
    
    // Input validation
    if (isNaN(parseInt(id))) {
        console.warn('Invalid user ID provided for progress options:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid user ID is required.'
        });
    }
    
    // Get workstreams with user progress
    const workstreamsQuery = `
        SELECT DISTINCT w.workstream_id, w.title, w.description,
               COUNT(DISTINCT up.progress_id) as chapter_progress_count,
               COUNT(DISTINCT ans.answer_id) as answer_count
        FROM workstreams w
        LEFT JOIN module_chapters mc ON w.workstream_id = mc.workstream_id
        LEFT JOIN user_progress up ON mc.chapter_id = up.chapter_id AND up.user_id = ?
        LEFT JOIN assessments a ON mc.chapter_id = a.chapter_id OR w.workstream_id = a.workstream_id
        LEFT JOIN questions q ON a.assessment_id = q.assessment_id
        LEFT JOIN answers ans ON q.question_id = ans.question_id AND ans.user_id = ?
        WHERE w.is_published = TRUE
        GROUP BY w.workstream_id, w.title, w.description
        HAVING chapter_progress_count > 0 OR answer_count > 0
        ORDER BY w.title
    `;
    
    // Get assessments with user attempts
    const assessmentsQuery = `
        SELECT DISTINCT a.assessment_id, a.title, a.description, w.title as workstream_title,
               mc.title as chapter_title, COUNT(DISTINCT ans.answer_id) as answer_count
        FROM assessments a
        LEFT JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        LEFT JOIN workstreams w ON mc.workstream_id = w.workstream_id OR a.workstream_id = w.workstream_id
        LEFT JOIN questions q ON a.assessment_id = q.assessment_id
        LEFT JOIN answers ans ON q.question_id = ans.question_id AND ans.user_id = ?
        WHERE ans.answer_id IS NOT NULL
        GROUP BY a.assessment_id, a.title, a.description, w.title, mc.title
        ORDER BY w.title, a.title
    `;
    
    req.db.query(workstreamsQuery, [id, id], (err, workstreams) => {
        if (err) {
            console.error('Error fetching workstreams for progress options:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch workstream options. Please try again.'
            });
        }
        
        req.db.query(assessmentsQuery, [id], (err, assessments) => {
            if (err) {
                console.error('Error fetching assessments for progress options:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch assessment options. Please try again.'
                });
            }
            
            console.log(`Found ${workstreams.length} workstreams and ${assessments.length} assessments with progress for user ${id}`);
            
            res.json({
                success: true,
                workstreams,
                assessments
            });
        });
    });
});

/**
 * @route DELETE /users/:id/progress
 * @description Clear progress for a specific user with granular options (admin only)
 * @access Private (Admin)
 * @param {string} id - ID of the user to clear progress for
 * @param {string} clearType - Type of clearing: 'all', 'assessments', 'workstream', 'assessment'
 * @param {number} workstreamId - ID of specific workstream (for workstream clearing)
 * @param {number} assessmentId - ID of specific assessment (for assessment clearing)
 * @returns {Object} Success or error message
 */
router.delete('/users/:id/progress', (req, res) => {
    const { id } = req.params;
    const { clearType = 'all', workstreamId, assessmentId } = req.body;
    
    console.log(`Attempting to clear progress for user ID: ${id}, type: ${clearType}`);
    
    // Input validation
    if (isNaN(parseInt(id))) {
        console.warn('Invalid user ID provided for progress clearing:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid user ID is required.'
        });
    }
    
    // Validate clearType
    const validClearTypes = ['all', 'assessments', 'workstream', 'assessment'];
    if (!validClearTypes.includes(clearType)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid clear type. Must be one of: all, assessments, workstream, assessment'
        });
    }
    
    // Validate required parameters for specific clear types
    if (clearType === 'workstream' && !workstreamId) {
        return res.status(400).json({
            success: false,
            error: 'Workstream ID is required for workstream clearing.'
        });
    }
    
    if (clearType === 'assessment' && !assessmentId) {
        return res.status(400).json({
            success: false,
            error: 'Assessment ID is required for assessment clearing.'
        });
    }
    
    // First, check if the user exists
    const checkUserSql = 'SELECT user_id, first_name, last_name FROM users WHERE user_id = ?';
    req.db.query(checkUserSql, [id], (err, results) => {
        if (err) {
            console.error('Error checking user existence:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to verify user. Please try again.'
            });
        }
        
        if (results.length === 0) {
            console.warn('User not found for progress clearing:', id);
            return res.status(404).json({
                success: false,
                error: 'User not found.'
            });
        }
        
        const user = results[0];
        console.log(`Clearing ${clearType} progress for user: ${user.first_name} ${user.last_name} (ID: ${id})`);
        
        // Use transactions to ensure data consistency
        req.db.beginTransaction(err => {
            if (err) {
                console.error('Error beginning transaction for progress clearing:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to initiate progress clearing. Please try again.'
                });
            }
            
            // Define clearing functions based on clearType
            switch (clearType) {
                case 'all':
                    clearAllProgress();
                    break;
                case 'assessments':
                    clearAllAssessmentAttempts();
                    break;
                case 'workstream':
                    clearWorkstreamProgress();
                    break;
                case 'assessment':
                    clearSpecificAssessmentProgress();
                    break;
                default:
                    return req.db.rollback(() => {
                        res.status(400).json({
                            success: false,
                            error: 'Invalid clear type specified.'
                        });
                    });
            }
            
            function clearAllProgress() {
                // Delete user's answers (assessment scores)
                const deleteAnswersSql = 'DELETE FROM answers WHERE user_id = ?';
                req.db.query(deleteAnswersSql, [id], (err, answersResult) => {
                    if (err) {
                        console.error('Error deleting user answers:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to clear assessment scores. Please try again.'
                            });
                        });
                    }
                    
                    console.log(`Deleted ${answersResult.affectedRows} answers for user ${id}`);
                    
                    // Delete user's progress (chapter views)
                    const deleteProgressSql = 'DELETE FROM user_progress WHERE user_id = ?';
                    req.db.query(deleteProgressSql, [id], (err, progressResult) => {
                        if (err) {
                            console.error('Error deleting user progress:', err);
                            return req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to clear chapter progress. Please try again.'
                                });
                            });
                        }
                        
                        console.log(`Deleted ${progressResult.affectedRows} progress records for user ${id}`);
                        
                        commitTransaction({
                            answersDeleted: answersResult.affectedRows,
                            progressDeleted: progressResult.affectedRows,
                            totalDeleted: answersResult.affectedRows + progressResult.affectedRows
                        }, 'all progress');
                    });
                });
            }
            
            function clearAllAssessmentAttempts() {
                // Delete all user's answers (assessment attempts)
                const deleteAnswersSql = 'DELETE FROM answers WHERE user_id = ?';
                req.db.query(deleteAnswersSql, [id], (err, answersResult) => {
                    if (err) {
                        console.error('Error deleting user answers:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to clear assessment attempts. Please try again.'
                            });
                        });
                    }
                    
                    console.log(`Deleted ${answersResult.affectedRows} assessment attempts for user ${id}`);
                    
                    commitTransaction({
                        answersDeleted: answersResult.affectedRows,
                        progressDeleted: 0,
                        totalDeleted: answersResult.affectedRows
                    }, 'all assessment attempts');
                });
            }
            
            function clearWorkstreamProgress() {
                // Get chapters for the specific workstream
                const getChaptersSql = 'SELECT chapter_id FROM module_chapters WHERE workstream_id = ?';
                req.db.query(getChaptersSql, [workstreamId], (err, chapters) => {
                    if (err) {
                        console.error('Error fetching chapters for workstream:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to fetch workstream chapters. Please try again.'
                            });
                        });
                    }
                    
                    if (chapters.length === 0) {
                        return commitTransaction({
                            answersDeleted: 0,
                            progressDeleted: 0,
                            totalDeleted: 0
                        }, `workstream progress (no chapters found)`);
                    }
                    
                    const chapterIds = chapters.map(c => c.chapter_id);
                    
                    // Delete answers for assessments in this workstream
                    const deleteAnswersSql = `
                        DELETE ans FROM answers ans
                        JOIN questions q ON ans.question_id = q.question_id
                        JOIN assessments a ON q.assessment_id = a.assessment_id
                        LEFT JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                        WHERE ans.user_id = ? AND (
                            mc.workstream_id = ? OR a.workstream_id = ?
                        )
                    `;
                    
                    req.db.query(deleteAnswersSql, [id, workstreamId, workstreamId], (err, answersResult) => {
                        if (err) {
                            console.error('Error deleting workstream answers:', err);
                            return req.db.rollback(() => {
                                res.status(500).json({
                                    success: false,
                                    error: 'Failed to clear workstream assessment scores. Please try again.'
                                });
                            });
                        }
                        
                        // Delete chapter progress for this workstream
                        const deleteProgressSql = 'DELETE FROM user_progress WHERE user_id = ? AND chapter_id IN (?)';
                        req.db.query(deleteProgressSql, [id, chapterIds], (err, progressResult) => {
                            if (err) {
                                console.error('Error deleting workstream progress:', err);
                                return req.db.rollback(() => {
                                    res.status(500).json({
                                        success: false,
                                        error: 'Failed to clear workstream chapter progress. Please try again.'
                                    });
                                });
                            }
                            
                            console.log(`Deleted ${answersResult.affectedRows} answers and ${progressResult.affectedRows} progress records for workstream ${workstreamId}`);
                            
                            commitTransaction({
                                answersDeleted: answersResult.affectedRows,
                                progressDeleted: progressResult.affectedRows,
                                totalDeleted: answersResult.affectedRows + progressResult.affectedRows
                            }, `workstream progress`);
                        });
                    });
                });
            }
            
            function clearSpecificAssessmentProgress() {
                // Delete answers for the specific assessment
                const deleteAnswersSql = `
                    DELETE ans FROM answers ans
                    JOIN questions q ON ans.question_id = q.question_id
                    WHERE ans.user_id = ? AND q.assessment_id = ?
                `;
                
                req.db.query(deleteAnswersSql, [id, assessmentId], (err, answersResult) => {
                    if (err) {
                        console.error('Error deleting assessment answers:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to clear assessment scores. Please try again.'
                            });
                        });
                    }
                    
                    console.log(`Deleted ${answersResult.affectedRows} answers for assessment ${assessmentId}`);
                    
                    commitTransaction({
                        answersDeleted: answersResult.affectedRows,
                        progressDeleted: 0,
                        totalDeleted: answersResult.affectedRows
                    }, `assessment progress`);
                });
            }
            
            function commitTransaction(details, progressType) {
                req.db.commit(err => {
                    if (err) {
                        console.error('Error committing transaction:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to complete progress clearing. Please try again.'
                            });
                        });
                    }
                    
                    console.log(`Successfully cleared ${progressType} for user ${user.first_name} ${user.last_name} (ID: ${id}). Total records deleted: ${details.totalDeleted}`);
                    
                    res.json({
                        success: true,
                        message: `Successfully cleared ${progressType} for ${user.first_name} ${user.last_name}.`,
                        details
                    });
                });
            }
        });
    });
});

export default router;
