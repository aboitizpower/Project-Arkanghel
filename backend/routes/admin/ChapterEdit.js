import express from 'express';
import multer from 'multer';
import notificationService from '../../services/notificationService.js';

const router = express.Router();

// Multer configuration for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Get a single chapter - Used by ChapterEdit.jsx
router.get('/chapters/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json(results[0]);
    });
});

// Reorder chapters - Used by WorkstreamEdit.jsx (MUST BE BEFORE /chapters/:id route!)
router.put('/chapters/reorder', (req, res) => {
    console.log('Reorder request received:', req.body);
    
    const { chapters } = req.body;

    if (!chapters) {
        console.log('No chapters in request body');
        return res.status(400).json({ error: 'chapters field is required in request body.' });
    }

    if (!Array.isArray(chapters)) {
        console.log('Chapters is not an array:', chapters);
        return res.status(400).json({ error: 'chapters must be an array.' });
    }

    if (chapters.length === 0) {
        console.log('Empty chapters array');
        return res.status(400).json({ error: 'chapters array cannot be empty.' });
    }

    // Normalize input to an array of numeric chapter IDs
    let chapterIds = [];
    for (let i = 0; i < chapters.length; i++) {
        const item = chapters[i];
        let id = item;
        
        if (item && typeof item === 'object' && item.chapter_id) {
            id = item.chapter_id;
        }
        
        const numId = Number(id);
        if (!Number.isFinite(numId) || numId <= 0) {
            console.log(`Invalid chapter ID at index ${i}:`, item);
            return res.status(400).json({ error: `Invalid chapter ID at index ${i}: ${id}` });
        }
        
        chapterIds.push(numId);
    }

    console.log('Normalized chapter IDs:', chapterIds);

    // Start a transaction to ensure data consistency
    req.db.beginTransaction(async (err) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to initiate chapter reordering.' });
        }

        try {
            // Update each chapter's order_index based on its new position
            for (let i = 0; i < chapterIds.length; i++) {
                const chapterId = chapterIds[i];
                const updateSql = 'UPDATE module_chapters SET order_index = ? WHERE chapter_id = ?';
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve, reject) => {
                    req.db.query(updateSql, [i, chapterId], (updateErr) => {
                        if (updateErr) reject(updateErr);
                        else resolve();
                    });
                });
            }

            // Determine the workstream_id from the first chapter and return the updated list
            const workstreamId = await new Promise((resolve, reject) => {
                const sql = 'SELECT workstream_id FROM module_chapters WHERE chapter_id = ? LIMIT 1';
                req.db.query(sql, [chapterIds[0]], (wsErr, results) => {
                    if (wsErr) reject(wsErr);
                    else resolve(results[0]?.workstream_id);
                });
            });

            const updatedChapters = await new Promise((resolve, reject) => {
                const sql = 'SELECT * FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';
                req.db.query(sql, [workstreamId], (listErr, results) => {
                    if (listErr) reject(listErr);
                    else resolve(results);
                });
            });

            await new Promise((resolve, reject) => {
                req.db.commit((commitErr) => {
                    if (commitErr) reject(commitErr);
                    else resolve();
                });
            });

            res.json({ success: true, message: 'Chapters reordered successfully!', chapters: updatedChapters });
        } catch (error) {
            return req.db.rollback(() => {
                res.status(500).json({ error: 'Failed to reorder chapters: ' + error.message });
            });
        }
    });
});

// Update a chapter - Used by ChapterEdit.jsx
router.put('/chapters/:id', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'pdf', maxCount: 1 }
]), (req, res) => {
    const { id } = req.params;
    const { title, content, order_index } = req.body;
    
    if (!title || !content || order_index === undefined) {
        return res.status(400).json({ error: 'title, content, and order_index are required.' });
    }

    let updateSql = 'UPDATE module_chapters SET title = ?, content = ?, order_index = ?';
    const updateParams = [title, content, order_index];

    // Handle video upload
    if (req.files?.video?.[0]) {
        updateSql += ', video_file = ?, video_filename = ?, video_mime_type = ?';
        updateParams.push(req.files.video[0].buffer);
        updateParams.push(req.files.video[0].originalname);
        updateParams.push(req.files.video[0].mimetype);
    }

    // Handle PDF upload
    if (req.files?.pdf?.[0]) {
        updateSql += ', pdf_file = ?, pdf_filename = ?, pdf_mime_type = ?';
        updateParams.push(req.files.pdf[0].buffer);
        updateParams.push(req.files.pdf[0].originalname);
        updateParams.push(req.files.pdf[0].mimetype);
    }

    updateSql += ' WHERE chapter_id = ?';
    updateParams.push(id);

    req.db.query(updateSql, updateParams, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        
        // Fetch and return the updated chapter data
        const fetchUpdatedSql = 'SELECT * FROM module_chapters WHERE chapter_id = ?';
        req.db.query(fetchUpdatedSql, [id], (err, updatedResults) => {
            if (err) {
                return res.status(500).json({ error: 'Chapter updated but failed to fetch updated data.' });
            }
            if (updatedResults.length === 0) {
                return res.status(404).json({ error: 'Chapter updated but not found.' });
            }
            
            const updatedChapter = updatedResults[0];
            res.json({
                success: 'Chapter updated successfully!',
                ...updatedChapter
            });
        });
    });
});

// Update chapter video - Used by ChapterEdit.jsx
router.put('/chapters/:id/video', upload.single('video'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const video = req.file.buffer;
    const video_type = req.file.mimetype;

    const sql = 'UPDATE module_chapters SET video_file = ?, video_mime_type = ? WHERE chapter_id = ?';
    req.db.query(sql, [video, video_type, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update video: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        
        // Fetch and return the updated chapter data
        const fetchUpdatedSql = 'SELECT * FROM module_chapters WHERE chapter_id = ?';
        req.db.query(fetchUpdatedSql, [id], (err, updatedResults) => {
            if (err) {
                return res.status(500).json({ error: 'Video updated but failed to fetch updated data.' });
            }
            if (updatedResults.length === 0) {
                return res.status(404).json({ error: 'Video updated but chapter not found.' });
            }
            
            const updatedChapter = updatedResults[0];
            res.json({
                success: 'Video updated successfully!',
                ...updatedChapter
            });
        });
    });
});

// Update chapter PDF - Used by ChapterEdit.jsx
router.put('/chapters/:id/pdf', upload.single('pdf'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const pdf = req.file.buffer;
    const pdf_type = req.file.mimetype;

    const sql = 'UPDATE module_chapters SET pdf_file = ?, pdf_mime_type = ? WHERE chapter_id = ?';
    req.db.query(sql, [pdf, pdf_type, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update PDF: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        
        // Fetch and return the updated chapter data
        const fetchUpdatedSql = 'SELECT * FROM module_chapters WHERE chapter_id = ?';
        req.db.query(fetchUpdatedSql, [id], (err, updatedResults) => {
            if (err) {
                return res.status(500).json({ error: 'PDF updated but failed to fetch updated data.' });
            }
            if (updatedResults.length === 0) {
                return res.status(404).json({ error: 'PDF updated but chapter not found.' });
            }
            
            const updatedChapter = updatedResults[0];
            res.json({
                success: 'PDF updated successfully!',
                ...updatedChapter
            });
        });
    });
});

// Update chapter publish status - Used by ChapterEdit.jsx
router.put('/chapters/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    if (typeof is_published !== 'boolean') {
        return res.status(400).json({ error: 'Invalid is_published value. It must be a boolean.' });
    }

    const sql = 'UPDATE module_chapters SET is_published = ? WHERE chapter_id = ?';
    req.db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to update chapter publish state.', details: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        
        // Fetch and return the updated chapter data
        const fetchUpdatedSql = 'SELECT * FROM module_chapters WHERE chapter_id = ?';
        req.db.query(fetchUpdatedSql, [id], (err, updatedResults) => {
            if (err) {
                return res.status(500).json({ error: 'Publish status updated but failed to fetch updated data.' });
            }
            if (updatedResults.length === 0) {
                return res.status(404).json({ error: 'Publish status updated but chapter not found.' });
            }
            
            const updatedChapter = updatedResults[0];
            
            // Send notification if chapter is being published
            if (is_published) {
                console.log(`🔔 Attempting to send notifications for chapter ${id}...`);
                
                if (notificationService) {
                    // Add timeout to prevent hanging requests
                    const notificationTimeout = setTimeout(() => {
                        console.warn(`⏰ Notification service timeout for chapter ${id}`);
                        res.json({
                            success: true,
                            message: `Chapter published successfully! Email notifications are being sent.`,
                            ...updatedChapter
                        });
                    }, 6000); // 6 second timeout
                    
                    notificationService.notifyNewChapter(id)
                        .then((result) => {
                            clearTimeout(notificationTimeout);
                            if (result && result.success) {
                                console.log(`✅ Email notifications initiated for chapter ${id}`);
                                if (!res.headersSent) {
                                    res.json({
                                        success: true,
                                        message: `Chapter published successfully! Email notifications have been sent.`,
                                        ...updatedChapter
                                    });
                                }
                            } else {
                                console.log(`⚠️ Email notifications failed for chapter ${id}:`, result?.message || 'Unknown error');
                                if (!res.headersSent) {
                                    res.json({
                                        success: true,
                                        message: `Chapter published successfully! However, email notifications could not be sent. Please check the email service configuration.`,
                                        ...updatedChapter
                                    });
                                }
                            }
                        })
                        .catch(err => {
                            clearTimeout(notificationTimeout);
                            console.error(`❌ Failed to send new chapter notifications for ${id}:`, err);
                            if (!res.headersSent) {
                                res.json({
                                    success: true,
                                    message: `Chapter published successfully! However, email notifications could not be sent. Please check the email service configuration.`,
                                    ...updatedChapter
                                });
                            }
                        });
                } else {
                    console.log(`⚠️ Notification service not available - skipping email notifications`);
                    res.json({
                        success: true,
                        message: `Chapter published successfully! Note: Email notification service is currently unavailable.`,
                        ...updatedChapter
                    });
                }
            } else {
                console.log(`📝 Chapter ${id} unpublished - no notifications sent`);
                res.json({
                    success: true,
                    message: `Chapter unpublished successfully!`,
                    ...updatedChapter
                });
            }
        });
    });
});

// Get chapter video - Used by ChapterEdit.jsx
router.get('/chapters/:id/video', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT video_file, video_mime_type FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].video_file) {
            return res.status(404).json({ error: 'Video not found.' });
        }
        const { video_file, video_mime_type } = results[0];
        res.setHeader('Content-Type', video_mime_type);
        res.send(video_file);
    });
});

// Get chapter PDF - Used by ChapterEdit.jsx
router.get('/chapters/:id/pdf', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT pdf_file, pdf_mime_type FROM module_chapters WHERE chapter_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].pdf_file) {
            return res.status(404).json({ error: 'PDF not found.' });
        }
        const { pdf_file, pdf_mime_type } = results[0];
        res.setHeader('Content-Type', pdf_mime_type);
        res.send(pdf_file);
    });
});

// Delete a chapter - Used by WorkstreamEdit.jsx
// Delete a chapter - Used by WorkstreamEdit.jsx
router.delete('/chapters/:id', (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Valid chapter ID is required.' });
    }

    // Start a transaction to ensure data consistency
    req.db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to initiate chapter deletion.' });
        }

        // 1. Find all assessments for the chapter
        const findAssessmentsSql = 'SELECT assessment_id FROM assessments WHERE chapter_id = ?';
        req.db.query(findAssessmentsSql, [id], (err, assessments) => {
            if (err) {
                return req.db.rollback(() => res.status(500).json({ error: 'Failed to find assessments for chapter.' }));
            }

            const assessmentIds = assessments.map(a => a.assessment_id);

            const deleteChapterAndCommit = () => {
                const deleteChapterSql = 'DELETE FROM module_chapters WHERE chapter_id = ?';
                req.db.query(deleteChapterSql, [id], (err) => {
                    if (err) {
                        return req.db.rollback(() => res.status(500).json({ error: 'Failed to delete chapter.' }));
                    }
                    req.db.commit(err => {
                        if (err) {
                            return req.db.rollback(() => res.status(500).json({ error: 'Failed to commit chapter deletion.' }));
                        }
                        res.json({ success: true, message: 'Chapter and all associated data deleted successfully.' });
                    });
                });
            };

            const deleteUserProgress = () => {
                // Delete all user progress records for this chapter
                const deleteUserProgressSql = 'DELETE FROM user_progress WHERE chapter_id = ?';
                req.db.query(deleteUserProgressSql, [id], (err) => {
                    if (err) {
                        return req.db.rollback(() => res.status(500).json({ error: 'Failed to delete user progress records.' }));
                    }
                    deleteChapterAndCommit();
                });
            };

            const deleteAssessments = () => {
                if (assessmentIds.length === 0) {
                    return deleteUserProgress(); // No assessments to delete, proceed to user progress deletion
                }
                const deleteAssessmentsSql = 'DELETE FROM assessments WHERE assessment_id IN (?)';
                req.db.query(deleteAssessmentsSql, [assessmentIds], (err) => {
                    if (err) {
                        return req.db.rollback(() => res.status(500).json({ error: 'Failed to delete assessments.' }));
                    }
                    deleteUserProgress();
                });
            };

            if (assessmentIds.length > 0) {
                // 2. Delete all questions for those assessments
                const deleteQuestionsSql = 'DELETE FROM questions WHERE assessment_id IN (?)';
                req.db.query(deleteQuestionsSql, [assessmentIds], (err) => {
                    if (err) {
                        return req.db.rollback(() => res.status(500).json({ error: 'Failed to delete questions.' }));
                    }
                    // 3. Delete the assessments
                    deleteAssessments();
                });
            } else {
                // No assessments, proceed to user progress deletion
                deleteUserProgress();
            }
        });
    });
});

export default router;
