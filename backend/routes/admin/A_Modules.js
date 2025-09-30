import express from 'express';
import multer from 'multer';

const router = express.Router();

// Multer configuration for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create a new workstream - Used by WorkstreamCreate.jsx
router.post('/workstreams', upload.single('image'), (req, res) => {
    console.log('=== A_MODULES POST /workstreams ROUTE HIT ==='); // Debug log
    const { title, description, deadline } = req.body;
    const image = req.file ? req.file.buffer : null;
    const image_type = req.file ? req.file.mimetype : null;

    console.log('A_Modules POST received:', { title, description, deadline }); // Debug log

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required.' });
    }

    // Validate deadline format if provided
    let deadlineValue = null;
    if (deadline !== undefined && deadline !== null && deadline !== '') {
        // Check if deadline is already in MySQL format (YYYY-MM-DD HH:mm:ss)
        const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (mysqlDateRegex.test(deadline)) {
            // Already in correct format
            deadlineValue = deadline;
            console.log('A_Modules POST: Deadline already in MySQL format:', deadlineValue); // Debug log
        } else {
            // Try to parse as ISO string and convert
            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                console.log('A_Modules POST: Invalid deadline format:', deadline); // Debug log
                return res.status(400).json({ error: 'Invalid deadline format. Please use a valid date.' });
            }
            // Convert to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
            deadlineValue = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');
            console.log('A_Modules POST: Converted deadline to MySQL format:', deadlineValue); // Debug log
        }
    }

    const sql = 'INSERT INTO workstreams (title, description, image, image_type, deadline) VALUES (?, ?, ?, ?, ?)';
    const params = [title, description, image, image_type, deadlineValue];
    
    console.log('A_Modules POST executing SQL:', sql, 'with params:', params); // Debug log
    
    req.db.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ success: 'Workstream created successfully!', workstream_id: result.insertId });
    });
});

// Read all workstreams (for admin) - Used by A_Modules.jsx
router.get('/workstreams', (req, res) => {
    console.log('=== A_MODULES GET /workstreams ROUTE HIT ==='); // Debug log
    const sql = `
        SELECT 
            w.workstream_id, 
            w.title, 
            w.description, 
            w.image_type, 
            w.created_at, 
            w.is_published,
            w.deadline,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id) AS chapters_count,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title NOT LIKE '%Final Assessment%') as regular_chapters_count,
            (
                SELECT COUNT(DISTINCT a.assessment_id) 
                FROM assessments a
                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE
            ) as assessments_count,
            (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title LIKE '%Final Assessment%') > 0 as has_final_assessment
        FROM workstreams w
    `;
    req.db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        console.log('A_Modules GET returning workstreams:', results); // Debug log
        console.log('A_Modules GET first workstream deadline:', results[0]?.deadline); // Debug log
        res.json(results);
    });
});

// Delete a workstream and all its related data
router.delete('/workstreams/:id', (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ error: 'Valid workstream ID is required.' });
    }

    // Use a simpler approach with sequential deletes based on actual database schema
    const deleteUserProgress = () => {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE up FROM user_progress up JOIN module_chapters mc ON up.chapter_id = mc.chapter_id WHERE mc.workstream_id = ?';
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteAnswers = () => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE ans FROM answers ans 
                        JOIN questions q ON ans.question_id = q.question_id 
                        JOIN assessments a ON q.assessment_id = a.assessment_id 
                        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                        WHERE mc.workstream_id = ?`;
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteQuestions = () => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE q FROM questions q 
                        JOIN assessments a ON q.assessment_id = a.assessment_id 
                        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                        WHERE mc.workstream_id = ?`;
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteAssessmentVisibility = () => {
        return new Promise((resolve, reject) => {
            const sql = `DELETE av FROM assessment_visibility av 
                        JOIN assessments a ON av.assessment_id = a.assessment_id 
                        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id 
                        WHERE mc.workstream_id = ?`;
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteAssessments = () => {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE a FROM assessments a JOIN module_chapters mc ON a.chapter_id = mc.chapter_id WHERE mc.workstream_id = ?';
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteChapters = () => {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM module_chapters WHERE workstream_id = ?';
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteWorkstreamProgress = () => {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM workstream_progress WHERE workstream_id = ?';
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteUserWorkstreamPermissions = () => {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM user_workstream_permissions WHERE workstream_id = ?';
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
    };

    const deleteWorkstream = () => {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM workstreams WHERE workstream_id = ?';
            req.db.query(sql, [id], (err, result) => {
                if (err) reject(err);
                else if (result.affectedRows === 0) reject(new Error('Workstream not found'));
                else resolve(result);
            });
        });
    };

    // Execute deletions in sequence based on foreign key dependencies
    deleteUserProgress()
        .then(() => deleteAnswers())
        .then(() => deleteQuestions())
        .then(() => deleteAssessmentVisibility())
        .then(() => deleteAssessments())
        .then(() => deleteChapters())
        .then(() => deleteWorkstreamProgress())
        .then(() => deleteUserWorkstreamPermissions())
        .then(() => deleteWorkstream())
        .then(() => {
            res.json({ success: true, message: 'Workstream deleted successfully.' });
        })
        .catch(err => {
            console.error('Error deleting workstream:', err);
            res.status(500).json({ error: `Failed to delete workstream: ${err.message}` });
        });
});

// Read a single workstream (including image) - Used by WorkstreamEdit.jsx and for serving workstream images
router.get('/workstreams/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM workstreams WHERE workstream_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        const workstream = results[0];
        // Send the image buffer directly if it exists
        if (workstream.image) {
            res.setHeader('Content-Type', workstream.image_type);
            res.send(workstream.image);
        } else {
            res.json(workstream); // Or send metadata if no image
        }
    });
});

// Get complete workstream data with chapters and assessments (for admin) - Used by A_Modules.jsx for detailed workstream view
router.get('/workstreams/:id/complete', (req, res) => {
    const { id } = req.params;
    
    // First get the workstream data
    const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published, deadline FROM workstreams WHERE workstream_id = ?';
    req.db.query(workstreamSql, [id], (err, workstreamResults) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (workstreamResults.length === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        
        const workstream = workstreamResults[0];
        console.log('A_Modules /complete endpoint - fetched workstream:', workstream); // Debug log
        console.log('A_Modules /complete endpoint - workstream deadline:', workstream.deadline); // Debug log
        
        // Then get all chapters for this workstream
        const chaptersSql = `
          SELECT 
            chapter_id, 
            workstream_id, 
            title, 
            content, 
            order_index, 
            is_published, 
            video_filename, 
            video_mime_type, 
            pdf_filename, 
            pdf_mime_type 
          FROM module_chapters 
          WHERE workstream_id = ? 
          ORDER BY order_index ASC
        `;
        req.db.query(chaptersSql, [id], (err, chapters) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // For each chapter, get its assessments
            const chapterIds = chapters.map(ch => ch.chapter_id);
            
            if (chapterIds.length === 0) {
                // No chapters, return workstream with empty chapters array
                const responsePayload = {
                    ...workstream,
                    chapters: [],
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                };
                console.log('A_Modules /complete endpoint - sending response (no chapters):', responsePayload); // Debug log
                console.log('A_Modules /complete endpoint - response deadline (no chapters):', responsePayload.deadline); // Debug log
                return res.json(responsePayload);
            }
            
            const assessmentsSql = 'SELECT assessment_id, chapter_id, title, total_points FROM assessments WHERE chapter_id IN (?) ORDER BY assessment_id ASC';
            req.db.query(assessmentsSql, [chapterIds], (err, assessments) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                
                // Group assessments by chapter
                const assessmentsByChapter = {};
                assessments.forEach(assessment => {
                    if (!assessmentsByChapter[assessment.chapter_id]) {
                        assessmentsByChapter[assessment.chapter_id] = [];
                    }
                    assessmentsByChapter[assessment.chapter_id].push(assessment);
                });
                
                // Add assessments to their respective chapters and add video/pdf URLs
                const chaptersWithAssessments = chapters.map(chapter => ({
                    ...chapter,
                    assessments: assessmentsByChapter[chapter.chapter_id] || [],
                    video_url: chapter.video_filename ? `/chapters/${chapter.chapter_id}/video` : null,
                    pdf_url: chapter.pdf_filename ? `/chapters/${chapter.chapter_id}/pdf` : null,
                }));
                
                const responsePayload = {
                    ...workstream,
                    chapters: chaptersWithAssessments,
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                };
                console.log('A_Modules /complete endpoint - sending response:', responsePayload); // Debug log
                console.log('A_Modules /complete endpoint - response deadline:', responsePayload.deadline); // Debug log
                res.json(responsePayload);
            });
        });
    });
});

// Update a workstream and return the complete, updated object
router.put('/workstreams/:id', upload.single('image'), (req, res) => {
    console.log('=== A_MODULES PUT /workstreams/:id ROUTE HIT ==='); // Debug log
    const { id } = req.params;
    const { title, description, deadline } = req.body;
    
    console.log('A_Modules received:', { id, title, description, deadline }); // Debug log

    // Validate deadline format if provided
    let deadlineValue = null;
    if (deadline !== undefined) {
        if (deadline === null || deadline === '') {
            deadlineValue = null; // Allow clearing the deadline
        } else {
            // Check if deadline is already in MySQL format (YYYY-MM-DD HH:mm:ss)
            const mysqlDateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
            if (mysqlDateRegex.test(deadline)) {
                // Already in correct format
                deadlineValue = deadline;
                console.log('Deadline already in MySQL format:', deadlineValue); // Debug log
            } else {
                // Try to parse as ISO string and convert
                const deadlineDate = new Date(deadline);
                if (isNaN(deadlineDate.getTime())) {
                    console.log('Invalid deadline format:', deadline); // Debug log
                    return res.status(400).json({ error: 'Invalid deadline format. Please use a valid date.' });
                }
                // Convert to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
                deadlineValue = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');
                console.log('Converted deadline to MySQL format:', deadlineValue); // Debug log
            }
        }
    }

    // 1. Update the workstream
    let updateSql = 'UPDATE workstreams SET title = ?, description = ?';
    const updateParams = [title, description];

    // Add deadline if provided
    if (deadline !== undefined) {
        updateSql += ', deadline = ?';
        updateParams.push(deadlineValue);
    }

    if (req.file) {
        updateSql += ', image = ?, image_type = ?';
        updateParams.push(req.file.buffer);
        updateParams.push(req.file.mimetype);
    }
    updateSql += ' WHERE workstream_id = ?';
    updateParams.push(id);

    console.log('A_Modules executing SQL:', updateSql, 'with params:', updateParams); // Debug log

    req.db.query(updateSql, updateParams, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update workstream: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Workstream not found for update.' });
        }

        // 2. Fetch and return the complete workstream data (mimicking the /complete endpoint)
        const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published, deadline FROM workstreams WHERE workstream_id = ?';
        req.db.query(workstreamSql, [id], (err, workstreamResults) => {
            if (err) return res.status(500).json({ error: `Failed to fetch workstream after update: ${err.message}` });
            if (workstreamResults.length === 0) return res.status(404).json({ error: 'Workstream not found after update.' });

            const workstream = workstreamResults[0];
            console.log('A_Modules fetched updated workstream:', workstream); // Debug log
            console.log('A_Modules workstream deadline:', workstream.deadline); // Debug log
            const chaptersSql = 'SELECT * FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';

            req.db.query(chaptersSql, [id], (err, chapters) => {
                if (err) return res.status(500).json({ error: `Failed to fetch chapters after update: ${err.message}` });

                const chapterIds = chapters.map(ch => ch.chapter_id);
                if (chapterIds.length === 0) {
                    return res.json({ ...workstream, chapters: [], image_url: workstream.image_type ? `/workstreams/${id}/image` : null });
                }

                const assessmentsSql = 'SELECT * FROM assessments WHERE chapter_id IN (?)';
                req.db.query(assessmentsSql, [chapterIds], (err, assessments) => {
                    if (err) return res.status(500).json({ error: `Failed to fetch assessments after update: ${err.message}` });

                    const assessmentsByChapter = assessments.reduce((acc, assessment) => {
                        (acc[assessment.chapter_id] = acc[assessment.chapter_id] || []).push(assessment);
                        return acc;
                    }, {});

                    const chaptersWithAssessments = chapters.map(chapter => ({
                        ...chapter,
                        assessments: assessmentsByChapter[chapter.chapter_id] || []
                    }));

                    res.json({
                        ...workstream,
                        chapters: chaptersWithAssessments,
                        image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                    });
                });
            });
        });
    });
});

// Toggle publish status of a workstream
router.put('/workstreams/:workstreamId/publish', (req, res) => {
    const { workstreamId } = req.params;
    const { is_published } = req.body;

    if (typeof is_published !== 'boolean') {
        return res.status(400).json({ error: 'is_published must be a boolean.' });
    }

    const sql = 'UPDATE workstreams SET is_published = ? WHERE workstream_id = ?';
    req.db.query(sql, [is_published, workstreamId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        res.json({ success: true, message: `Workstream publish status updated to ${is_published}.` });
    });
});

// Get a workstream's image
router.get('/workstreams/:id/image', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT image, image_type FROM workstreams WHERE workstream_id = ?';
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].image) {
            return res.status(404).json({ error: 'Image not found.' });
        }
        const { image, image_type } = results[0];
        res.setHeader('Content-Type', image_type);
        res.send(image);
    });
});

export default router;
