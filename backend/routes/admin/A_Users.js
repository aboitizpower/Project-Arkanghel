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
 * @route DELETE /users/:id/progress
 * @description Clear all progress for a specific user (admin only)
 * @access Private (Admin)
 * @param {string} id - ID of the user to clear progress for
 * @returns {Object} Success or error message
 */
router.delete('/users/:id/progress', (req, res) => {
    const { id } = req.params;
    
    console.log(`Attempting to clear progress for user ID: ${id}`);
    
    // Input validation
    if (isNaN(parseInt(id))) {
        console.warn('Invalid user ID provided for progress clearing:', id);
        return res.status(400).json({
            success: false,
            error: 'A valid user ID is required.'
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
        console.log(`Clearing progress for user: ${user.first_name} ${user.last_name} (ID: ${id})`);
        
        // Use transactions to ensure data consistency
        req.db.beginTransaction(err => {
            if (err) {
                console.error('Error beginning transaction for progress clearing:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to initiate progress clearing. Please try again.'
                });
            }
            
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
                    
                    // Commit the transaction (no assessment_results table to clear)
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
                        
                        const totalDeleted = answersResult.affectedRows + progressResult.affectedRows;
                        console.log(`Successfully cleared all progress for user ${user.first_name} ${user.last_name} (ID: ${id}). Total records deleted: ${totalDeleted}`);
                        
                        res.json({
                            success: true,
                            message: `Successfully cleared all progress for ${user.first_name} ${user.last_name}.`,
                            details: {
                                answersDeleted: answersResult.affectedRows,
                                progressDeleted: progressResult.affectedRows,
                                totalDeleted: totalDeleted
                            }
                        });
                    });
                });
            });
        });
    });
});

export default router;
