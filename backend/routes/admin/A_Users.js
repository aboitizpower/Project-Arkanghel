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
    console.log(`Fetching assessment results for user ID: ${userId}`);
    
    const sql = `
        SELECT 
            ar.result_id,
            ar.user_id,
            ar.assessment_id,
            ar.score,
            ar.total_questions,
            ar.completed_at,
            a.title as assessment_title,
            a.total_points,
            a.passing_score,
            mc.title as chapter_title,
            w.title as workstream_title,
            (ar.score >= a.passing_score) as passed
        FROM assessment_results ar
        JOIN assessments a ON ar.assessment_id = a.assessment_id
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        WHERE ar.user_id = ?
        ORDER BY ar.completed_at DESC
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
            user_id as id, 
            first_name, 
            last_name, 
            email, 
            isAdmin, 
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
        FROM users 
        ORDER BY created_at DESC
    `;
    
    req.db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to fetch users. Please try again later.' 
            });
        }
        
        console.log(`Fetched ${results.length} users`);
        res.json({ 
            success: true, 
            users: results 
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
                
                // Delete user's assessment results
                const deleteResultsSql = 'DELETE FROM assessment_results WHERE user_id = ?';
                req.db.query(deleteResultsSql, [id], (err) => {
                    if (err) {
                        console.error('Error deleting assessment results:', err);
                        return req.db.rollback(() => {
                            res.status(500).json({
                                success: false,
                                error: 'Failed to delete user assessment data. Please try again.'
                            });
                        });
                    }
                    
                    // Finally, delete the user
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

export default router;
