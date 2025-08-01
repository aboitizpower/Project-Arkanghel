import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'
import bcrypt from 'bcrypt'
import multer from 'multer'

const app = express()

// Multer configuration for handling image uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

app.use(express.json())
app.use(cors())

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "arkanghel_db"
})

const saltRounds = 10;

// Register endpoint
app.post("/register", (req,res)=>{
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }
    bcrypt.hash(password, saltRounds, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Error hashing password.' });
        const sql = 'INSERT INTO users (first_name, last_name, email, password, isAdmin) VALUES (?, ?, ?, ?, ?)';
        db.query(sql, [first_name, last_name, email, hash, false], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ error: 'Email already exists.' });
                }
                return res.status(500).json({ error: err.message });
            }
            return res.status(201).json({ success: 'User registered successfully!' });
        });
    });
})

// Login endpoint
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }
        const user = results[0];
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid email or password.' });
            }
            // Do not send password back
            const { password, ...userWithoutPassword } = user;
            return res.status(200).json({ success: 'Login successful!', user: userWithoutPassword });
        });
    });
});

// Get all users endpoint
app.get('/users', (req, res) => {
    db.query('SELECT user_id, first_name, last_name, email, isAdmin, created_at FROM users', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        // For frontend compatibility, map user_id to id
        const users = results.map(u => ({
            ...u,
            id: u.user_id
        }));
        res.json({ users });
    });
});

// Update user role endpoint
// Refactored function to get assessment results for a user
const getAssessmentResultsForUser = (userId, callback) => {
    const sql = `
        SELECT 
            a.assessment_id,
            a.title AS assessment_title,
            (SELECT COUNT(*) FROM questions WHERE assessment_id = a.assessment_id) AS total_points,
            mc.workstream_id,
            latest_attempt.score AS user_score,
            latest_attempt.answered_at AS last_date_taken,
            (latest_attempt.score / (SELECT COUNT(*) FROM questions WHERE assessment_id = a.assessment_id)) >= 0.5 AS passed,
            attempt_counts.total_attempts AS attempts
        FROM (
            SELECT 
                q.assessment_id,
                MAX(ans.answered_at) AS max_answered_at
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            WHERE ans.user_id = ?
            GROUP BY q.assessment_id
        ) AS latest_submission
        JOIN (
            SELECT 
                q.assessment_id,
                ans.answered_at,
                SUM(ans.score) AS score
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            WHERE ans.user_id = ?
            GROUP BY q.assessment_id, ans.answered_at
        ) AS latest_attempt ON latest_submission.assessment_id = latest_attempt.assessment_id 
            AND latest_submission.max_answered_at = latest_attempt.answered_at
        JOIN (
            SELECT 
                q.assessment_id,
                COUNT(DISTINCT ans.answered_at) AS total_attempts
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            WHERE ans.user_id = ?
            GROUP BY q.assessment_id
        ) AS attempt_counts ON latest_submission.assessment_id = attempt_counts.assessment_id
        JOIN assessments a ON latest_submission.assessment_id = a.assessment_id
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        ORDER BY last_date_taken DESC;
    `;

    db.query(sql, [userId, userId, userId], (err, results) => {
        if (err) {
            return callback(err, null);
        }
        callback(null, results);
    });
};

// Get assessment results for a specific user
app.get('/users/:userId/assessment-results', (req, res) => {
    const { userId } = req.params;
    getAssessmentResultsForUser(userId, (err, results) => {
        if (err) {
            console.error('Error fetching assessment results:', err);
            return res.status(500).json({ error: 'Failed to fetch assessment results.' });
        }
        res.json(results);
    });
});

app.put('/users/:id/role', (req, res) => {
    const { isAdmin } = req.body;
    const { id } = req.params;
    db.query(
        'UPDATE users SET isAdmin = ? WHERE user_id = ?',
        [isAdmin ? 1 : 0, id],
        (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        }
    );
});

// Workstreams CRUD

// Create a new workstream
app.post('/workstreams', upload.single('image'), (req, res) => {
    const { title, description } = req.body;
    const image = req.file ? req.file.buffer : null;
    const image_type = req.file ? req.file.mimetype : null;

    if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required.' });
    }

    const sql = 'INSERT INTO workstreams (title, description, image, image_type) VALUES (?, ?, ?, ?)';
    db.query(sql, [title, description, image, image_type], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ success: 'Workstream created successfully!', workstream_id: result.insertId });
    });
});

// Read all workstreams (for admin)
app.get('/workstreams', (req, res) => {
    const sql = `
        SELECT 
            w.workstream_id, 
            w.title, 
            w.description, 
            w.image_type, 
            w.created_at, 
            w.is_published,
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
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Read a single workstream (including image)
app.get('/workstreams/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM workstreams WHERE workstream_id = ?';
    db.query(sql, [id], (err, results) => {
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

// Get complete workstream data with chapters and assessments (for admin)
app.get('/workstreams/:id/complete', (req, res) => {
    const { id } = req.params;
    
    // First get the workstream data
    const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published FROM workstreams WHERE workstream_id = ?';
    db.query(workstreamSql, [id], (err, workstreamResults) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (workstreamResults.length === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        
        const workstream = workstreamResults[0];
        
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
        db.query(chaptersSql, [id], (err, chapters) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            // For each chapter, get its assessments
            const chapterIds = chapters.map(ch => ch.chapter_id);
            
            if (chapterIds.length === 0) {
                // No chapters, return workstream with empty chapters array
                return res.json({
                    ...workstream,
                    chapters: [],
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                });
            }
            
            const assessmentsSql = 'SELECT assessment_id, chapter_id, title, total_points FROM assessments WHERE chapter_id IN (?) ORDER BY assessment_id ASC';
            db.query(assessmentsSql, [chapterIds], (err, assessments) => {
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
                
                res.json({
                    ...workstream,
                    chapters: chaptersWithAssessments,
                    image_url: workstream.image_type ? `/workstreams/${id}/image` : null
                });
            });
        });
    });
});

// Update a workstream and return the complete, updated object
app.put('/workstreams/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;

    // 1. Update the workstream
    let updateSql = 'UPDATE workstreams SET title = ?, description = ?';
    const updateParams = [title, description];

    if (req.file) {
        updateSql += ', image = ?, image_type = ?';
        updateParams.push(req.file.buffer);
        updateParams.push(req.file.mimetype);
    }
    updateSql += ' WHERE workstream_id = ?';
    updateParams.push(id);

    db.query(updateSql, updateParams, (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update workstream: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Workstream not found for update.' });
        }

        // 2. Fetch and return the complete workstream data (mimicking the /complete endpoint)
        const workstreamSql = 'SELECT workstream_id, title, description, image_type, created_at, is_published FROM workstreams WHERE workstream_id = ?';
        db.query(workstreamSql, [id], (err, workstreamResults) => {
            if (err) return res.status(500).json({ error: `Failed to fetch workstream after update: ${err.message}` });
            if (workstreamResults.length === 0) return res.status(404).json({ error: 'Workstream not found after update.' });

            const workstream = workstreamResults[0];
            const chaptersSql = 'SELECT * FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';

            db.query(chaptersSql, [id], (err, chapters) => {
                if (err) return res.status(500).json({ error: `Failed to fetch chapters after update: ${err.message}` });

                const chapterIds = chapters.map(ch => ch.chapter_id);
                if (chapterIds.length === 0) {
                    return res.json({ ...workstream, chapters: [], image_url: workstream.image_type ? `/workstreams/${id}/image` : null });
                }

                const assessmentsSql = 'SELECT * FROM assessments WHERE chapter_id IN (?)';
                db.query(assessmentsSql, [chapterIds], (err, assessments) => {
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

// Get a workstream's image
app.get('/workstreams/:id/image', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT image, image_type FROM workstreams WHERE workstream_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0 || !results[0].image) {
            return res.status(404).json({ error: 'Image not found.' });
        }
        res.setHeader('Content-Type', results[0].image_type);
        res.send(results[0].image);
    });
});

// Delete a workstream (and all its related content)
app.delete('/workstreams/:id', (req, res) => {
    const { id } = req.params;

    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error starting transaction.' });
        }

        // 1. Get all chapters for the workstream
        const getChaptersSql = 'SELECT chapter_id FROM module_chapters WHERE workstream_id = ?';
        db.query(getChaptersSql, [id], (err, chapters) => {
            if (err) {
                return db.rollback(() => res.status(500).json({ error: 'Failed to fetch chapters for deletion.' }));
            }

            const chapterIds = chapters.map(c => c.chapter_id);

            const performDeletions = (assessmentIds, questionIds) => {
                const deleteOperations = [
                    (callback) => { // Delete answers
                        if (questionIds.length === 0) return callback();
                        db.query('DELETE FROM answers WHERE question_id IN (?)', [questionIds], callback);
                    },
                    (callback) => { // Delete questions
                        if (assessmentIds.length === 0) return callback();
                        db.query('DELETE FROM questions WHERE assessment_id IN (?)', [assessmentIds], callback);
                    },
                    (callback) => { // Delete assessments
                        if (chapterIds.length === 0) return callback();
                        db.query('DELETE FROM assessments WHERE chapter_id IN (?)', [chapterIds], callback);
                    },
                    (callback) => { // Delete user progress
                        if (chapterIds.length === 0) return callback();
                        db.query('DELETE FROM user_progress WHERE chapter_id IN (?)', [chapterIds], callback);
                    },
                    (callback) => { // Delete chapters
                        if (chapterIds.length === 0) return callback();
                        db.query('DELETE FROM module_chapters WHERE workstream_id = ?', [id], callback);
                    },
                    (callback) => { // Delete workstream
                        db.query('DELETE FROM workstreams WHERE workstream_id = ?', [id], callback);
                    }
                ];

                let opIndex = 0;
                const next = (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error during deletion operation:', err);
                            res.status(500).json({ error: 'Failed during cascaded delete.' });
                        });
                    }
                    opIndex++;
                    if (opIndex < deleteOperations.length) {
                        deleteOperations[opIndex](next);
                    } else {
                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => res.status(500).json({ error: 'Failed to commit transaction.' }));
                            }
                            res.json({ success: 'Workstream and all associated content deleted successfully!' });
                        });
                    }
                };
                deleteOperations[0](next);
            };

            if (chapterIds.length > 0) {
                // 2. Get all assessments for the chapters
                const getAssessmentsSql = 'SELECT assessment_id FROM assessments WHERE chapter_id IN (?)';
                db.query(getAssessmentsSql, [chapterIds], (err, assessments) => {
                    if (err) {
                        return db.rollback(() => res.status(500).json({ error: 'Failed to fetch assessments for deletion.' }));
                    }

                    const assessmentIds = assessments.map(a => a.assessment_id);

                    if (assessmentIds.length > 0) {
                        // 3. Get all questions for the assessments
                        const getQuestionsSql = 'SELECT question_id FROM questions WHERE assessment_id IN (?)';
                        db.query(getQuestionsSql, [assessmentIds], (err, questions) => {
                            if (err) {
                                return db.rollback(() => res.status(500).json({ error: 'Failed to fetch questions for deletion.' }));
                            }
                            const questionIds = questions.map(q => q.question_id);
                            performDeletions(assessmentIds, questionIds);
                        });
                    } else {
                        performDeletions([], []);
                    }
                });
            } else {
                performDeletions([], []);
            }
        });
    });
});

// Update chapter video
app.put('/chapters/:id/video', upload.single('video'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const video = req.file.buffer;
    const video_type = req.file.mimetype;

    const sql = 'UPDATE module_chapters SET video = ?, video_type = ? WHERE chapter_id = ?';
    db.query(sql, [video, video_type, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update video: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: 'Video updated successfully!' });
    });
});

// Update chapter PDF
app.put('/chapters/:id/pdf', upload.single('pdf'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }

    const pdf = req.file.buffer;
    const pdf_type = req.file.mimetype;

    const sql = 'UPDATE module_chapters SET pdf = ?, pdf_type = ? WHERE chapter_id = ?';
    db.query(sql, [pdf, pdf_type, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: `Failed to update PDF: ${err.message}` });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: 'PDF updated successfully!' });
    });
});

// Update chapter publish status
app.put('/chapters/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    console.log(`Received publish toggle request for chapter ID: ${id}, new status: ${is_published}`);

    if (typeof is_published !== 'boolean') {
        console.error('Invalid is_published value received:', is_published);
        return res.status(400).json({ error: 'Invalid is_published value. It must be a boolean.' });
    }

    const sql = 'UPDATE module_chapters SET is_published = ? WHERE chapter_id = ?';
    db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            console.error('Database error updating chapter publish state:', err);
            return res.status(500).json({ error: 'Failed to update chapter publish state.', details: err.message });
        }
        if (result.affectedRows === 0) {
            console.warn(`Chapter not found for publish update: ${id}`);
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        console.log(`Chapter ID ${id} publish state updated to ${is_published} successfully.`);
        res.json({ success: true, message: 'Chapter publish state updated successfully.' });
    });
});

// Update workstream publish status
app.put('/workstreams/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    if (is_published === undefined) {
        return res.status(400).json({ error: 'is_published field is required.' });
    }

    // If we are trying to publish, first check for published chapters
    if (is_published) {
        const checkChaptersSql = 'SELECT COUNT(*) as published_chapters_count FROM module_chapters WHERE workstream_id = ? AND is_published = 1';

        db.query(checkChaptersSql, [id], (err, results) => {
            if (err) {
                return res.status(500).json({ error: `Failed to check chapters: ${err.message}` });
            }
            if (results[0].published_chapters_count === 0) {
                return res.status(400).json({ error: 'Cannot publish a workstream with no published chapters.' });
            }

            // Proceed with publishing
            const updateSql = 'UPDATE workstreams SET is_published = ? WHERE workstream_id = ?';
            db.query(updateSql, [is_published, id], (err, result) => {
                if (err) return res.status(500).json({ error: `Failed to update workstream: ${err.message}` });
                if (result.affectedRows === 0) return res.status(404).json({ error: 'Workstream not found.' });
                res.json({ success: true, is_published });
            });
        });
    } else {
        // If unpublishing, no check is needed
        const updateSql = 'UPDATE workstreams SET is_published = ? WHERE workstream_id = ?';
        db.query(updateSql, [is_published, id], (err, result) => {
            if (err) return res.status(500).json({ error: `Failed to update workstream: ${err.message}` });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Workstream not found.' });
            res.json({ success: true, is_published });
        });
    }
});

// Update chapter order for a workstream
app.put('/workstreams/:workstream_id/order', (req, res) => {
    const { workstream_id } = req.params;
    const { chapters } = req.body;

    if (!chapters || !Array.isArray(chapters)) {
        return res.status(400).json({ error: 'Invalid payload. Expected an array of chapters.' });
    }

    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to start transaction.' });
        }

        // Update each chapter's order index
        const updatePromises = chapters.map((chapter, index) => {
            return new Promise((resolve, reject) => {
                const sql = 'UPDATE module_chapters SET order_index = ? WHERE chapter_id = ? AND workstream_id = ?';
                db.query(sql, [index, chapter.chapter_id, workstream_id], (err, result) => {
                    if (err) reject(err);
                    else if (result.affectedRows === 0) {
                        reject(new Error(`Chapter ${chapter.chapter_id} not found or does not belong to workstream ${workstream_id}`));
                    }
                    else resolve();
                });
            });
        });

        Promise.all(updatePromises)
            .then(() => {
                db.commit(err => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Failed to commit transaction:', err);
                            res.status(500).json({ error: 'Failed to save chapter order.' });
                        });
                    }
                    res.json({ success: true, message: 'Chapter order updated successfully.' });
                });
            })
            .catch(error => {
                db.rollback(() => {
                    console.error('Error updating chapter order:', error);
                    res.status(500).json({ error: 'Failed to update chapter order.' });
                });
            });
    });
});

// Module Chapters CRUD

// Create a new chapter
app.post('/chapters', upload.fields([{ name: 'pdf_file', maxCount: 1 }, { name: 'video_file', maxCount: 1 }]), (req, res) => {
    const { workstream_id, title, content, order_index } = req.body;
    if (!workstream_id || !title || !content) {
        return res.status(400).json({ error: 'Workstream ID, title, and content are required.' });
    }

    const pdf = req.files?.pdf_file?.[0];
    const video = req.files?.video_file?.[0];

    const sql = `
        INSERT INTO module_chapters 
        (workstream_id, title, content, order_index, pdf_file, pdf_filename, pdf_mime_type, video_file, video_filename, video_mime_type) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
        workstream_id,
        title,
        content,
        order_index || 0,
        pdf?.buffer || null,
        pdf?.originalname || null,
        pdf?.mimetype || null,
        video?.buffer || null,
        video?.originalname || null,
        video?.mimetype || null
    ];

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('Error creating chapter:', err);
            return res.status(500).json({ error: 'Database error while creating chapter.' });
        }
        res.status(201).json({ success: 'Chapter created successfully.', chapterId: result.insertId });
    });
});

// Get all chapters for a specific workstream (for admin)
app.get('/workstreams/:workstream_id/chapters', (req, res) => {
    const { workstream_id } = req.params;
    const sql = 'SELECT chapter_id, workstream_id, title, content, order_index, pdf_filename, video_filename, is_published FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';
    db.query(sql, [workstream_id], (err, results) => {
        if (err) {
            console.error(`Error fetching chapters for workstream ${workstream_id}:`, err);
            return res.status(500).json({ error: 'Failed to fetch chapters.' });
        }
        res.json(results);
    });
});

// Get a single chapter's details (without files)
app.get('/chapters/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT chapter_id, workstream_id, title, content, order_index, created_at, pdf_file IS NOT NULL as has_pdf, video_file IS NOT NULL as has_video FROM module_chapters WHERE chapter_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Chapter not found.' });
        res.json(results[0]);
    });
});

// Get all assessments for a chapter
app.get('/chapters/:chapter_id/assessments', (req, res) => {
    const { chapter_id } = req.params;
    const sql = 'SELECT * FROM assessments WHERE chapter_id = ? ORDER BY assessment_id ASC';
    db.query(sql, [chapter_id], (err, results) => {
        if (err) {
            console.error(`Error fetching assessments for chapter ${chapter_id}:`, err);
            return res.status(500).json({ error: 'Failed to fetch assessments.' });
        }
        res.json(results);
    });
});

// Create Assessment for a Workstream
app.post('/workstreams/:workstream_id/assessments', (req, res) => {
    const { workstream_id } = req.params;
    const { title, description, questions, chapter_id, is_final } = req.body;
    const total_points = (questions && questions.length) ? questions.length : 0;

    // Validation: Only one of chapter_id or is_final must be set
    if ((chapter_id && is_final) || (!chapter_id && !is_final)) {
        return res.status(400).json({ error: 'Select either a chapter or mark as final assessment, not both or neither.' });
    }
    if (!title) {
        return res.status(400).json({ error: 'Assessment title is required (auto-generated by frontend).' });
    }

    // Helper to map frontend type to DB ENUM
    function mapQuestionType(type) {
      if (type === 'multiple') return 'multiple_choice';
      if (type === 'truefalse') return 'true_false';
      if (type === 'identification') return 'short_answer';
      return 'multiple_choice';
    }

    db.beginTransaction(async err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error.' });
        }

        // Check if 'options' column exists in questions table
        db.query("SHOW COLUMNS FROM questions LIKE 'options'", (err, columns) => {
            const hasOptions = !err && columns && columns.length > 0;

            const createAssessmentAndQuestions = (targetChapterId) => {
                let assessmentSql = 'INSERT INTO assessments (chapter_id, title, total_points, description) VALUES (?, ?, ?, ?)';
                db.query(assessmentSql, [targetChapterId, title, total_points, description || null], (err, result) => {
                    if (err) {
                        console.error('Error creating assessment:', err);
                        return db.rollback(() => res.status(500).json({ error: err.message || 'Database error while creating assessment.' }));
                    }
                    const newAssessmentId = result.insertId;
                    if (questions && questions.length > 0) {
                        let questionInsertSql, questionValues;
                        if (hasOptions) {
                            questionInsertSql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer, options) VALUES ?';
                            questionValues = questions.map(q => [
                                newAssessmentId,
                                q.question || q.question_text,
                                mapQuestionType(q.type || q.question_type),
                                q.correct_answer,
                                JSON.stringify(q.options || null)
                            ]);
                        } else {
                            questionInsertSql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer) VALUES ?';
                            questionValues = questions.map(q => [
                                newAssessmentId,
                                q.question || q.question_text,
                                mapQuestionType(q.type || q.question_type),
                                q.correct_answer
                            ]);
                        }
                        db.query(questionInsertSql, [questionValues], (err, questionResult) => {
                            if (err) {
                                console.error('Error creating questions:', err);
                                return db.rollback(() => res.status(500).json({ error: err.message || 'Database error while creating questions.' }));
                            }
                            db.commit(err => {
                                if (err) { 
                                    console.error('Database error on commit:', err);
                                    return db.rollback(() => res.status(500).json({ error: err.message || 'Database error on commit.' })); 
                                }
                                res.status(201).json({ success: 'Assessment and questions created', assessment_id: newAssessmentId });
                            });
                        });
                    } else {
                        db.commit(err => {
                            if (err) { 
                                console.error('Database error on commit:', err);
                                return db.rollback(() => res.status(500).json({ error: err.message || 'Database error on commit.' })); 
                            }
                            res.status(201).json({ success: 'Assessment created', assessment_id: newAssessmentId });
                        });
                    }
                });
            };

            if (chapter_id) {
                // Create assessment for existing chapter
                createAssessmentAndQuestions(Number(chapter_id));
            } else if (is_final) {
                // Fetch workstream title to ensure chapter title matches frontend
                db.query('SELECT title FROM workstreams WHERE workstream_id = ?', [workstream_id], (err, wsResult) => {
                    if (err || !wsResult || wsResult.length === 0) {
                        console.error('Error fetching workstream title:', err);
                        return db.rollback(() => res.status(500).json({ error: 'Failed to fetch workstream title for final assessment.' }));
                    }
                    const wsTitle = wsResult[0].title;
                    const finalChapterTitle = `Final Assessment for: ${wsTitle}`;
                    const checkFinalSql = 'SELECT chapter_id FROM module_chapters WHERE workstream_id = ? AND title = ?';
                    db.query(checkFinalSql, [workstream_id, finalChapterTitle], (err, chapters) => {
                        if (err) {
                            console.error('Error checking for final chapter:', err);
                            return db.rollback(() => res.status(500).json({ error: err.message || 'Database error while checking for final chapter.' }));
                        }
                        if (chapters.length > 0) {
                            // Use existing final chapter
                            createAssessmentAndQuestions(chapters[0].chapter_id);
                        } else {
                            // Create new final chapter
                            const chapterSql = 'INSERT INTO module_chapters (workstream_id, title, content, is_published, order_index) VALUES (?, ?, ?, ?, ?)';
                            const chapterContent = description || 'This chapter holds the final assessment for the workstream.';
                            db.query('SELECT COALESCE(MAX(order_index), 0) as max_order FROM module_chapters WHERE workstream_id = ?', [workstream_id], (err, orderResult) => {
                                if (err) {
                                    console.error('Error getting max order:', err);
                                    return db.rollback(() => res.status(500).json({ error: err.message || 'Database error while getting chapter order.' }));
                                }
                                const newOrderIndex = (orderResult[0].max_order || 0) + 1;
                                db.query(chapterSql, [workstream_id, finalChapterTitle, chapterContent, false, newOrderIndex], (err, result) => {
                                    if (err) {
                                        console.error('Error creating final chapter for assessment:', err);
                                        return db.rollback(() => res.status(500).json({ error: err.message || 'Failed to create final chapter for assessment.' }));
                                    }
                                    const newChapterId = result.insertId;
                                    createAssessmentAndQuestions(newChapterId);
                                });
                            });
                        }
                    });
                });
            }
        });
    });
});

// Get all assessments for a workstream
app.get('/workstreams/:workstream_id/assessments', (req, res) => {
    const { workstream_id } = req.params;
    const sql = `
        SELECT a.assessment_id, a.chapter_id, a.title, a.total_points, mc.title as chapter_title
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        WHERE mc.workstream_id = ?
        ORDER BY mc.order_index ASC, a.assessment_id ASC
    `;
    db.query(sql, [workstream_id], (err, results) => {
        if (err) {
            console.error(`Error fetching assessments for workstream ${workstream_id}:`, err);
            return res.status(500).json({ error: 'Failed to fetch assessments.' });
        }
        res.json(results);
    });
});

// Update a chapter's text details
app.put('/chapters/:id/details', (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title && !content) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    let sql = 'UPDATE module_chapters SET ';
    const params = [];
    if (title) {
        sql += 'title = ?';
        params.push(title);
    }
    if (content) {
        if (params.length > 0) sql += ', ';
        sql += 'content = ?';
        params.push(content);
    }
    sql += ' WHERE chapter_id = ?';
    params.push(id);

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('Error updating chapter details:', err);
            return res.status(500).json({ error: 'Database error while updating chapter details.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: 'Chapter details updated successfully.' });
    });
});

// Upload/update chapter video
app.post('/chapters/:id/upload-video', upload.single('video_file'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded.' });
    }
    const { buffer, originalname, mimetype } = req.file;
    const sql = 'UPDATE module_chapters SET video_file = ?, video_filename = ?, video_mime_type = ? WHERE chapter_id = ?';
    db.query(sql, [buffer, originalname, mimetype, id], (err, result) => {
        if (err) {
            console.error('Error uploading video:', err);
            return res.status(500).json({ error: 'Database error while uploading video.' });
        }
        res.json({ success: true, message: 'Video uploaded successfully.' });
    });
});

// Upload/update chapter PDF
app.post('/chapters/:id/upload-pdf', upload.single('pdf_file'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded.' });
    }
    const { buffer, originalname, mimetype } = req.file;
    const sql = 'UPDATE module_chapters SET pdf_file = ?, pdf_filename = ?, pdf_mime_type = ? WHERE chapter_id = ?';
    db.query(sql, [buffer, originalname, mimetype, id], (err, result) => {
        if (err) {
            console.error('Error uploading PDF:', err);
            return res.status(500).json({ error: 'Database error while uploading PDF.' });
        }
        res.json({ success: true, message: 'PDF uploaded successfully.' });
    });
});

// Get a chapter's PDF file
app.get('/chapters/:id/pdf', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT pdf_file, pdf_filename, pdf_mime_type FROM module_chapters WHERE chapter_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error fetching PDF for chapter:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].pdf_file) {
            console.warn(`PDF not found for chapter ID ${id}`);
            return res.status(404).send('PDF not found.');
        }
        const file = results[0];
        console.log(`Serving PDF for chapter ID ${id}: filename=${file.pdf_filename}, mime_type=${file.pdf_mime_type}`);
        res.setHeader('Content-Type', file.pdf_mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${file.pdf_filename}"`);
        res.send(file.pdf_file);
    });
});

// Get a chapter's video file
app.get('/chapters/:id/video', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT video_file, video_filename, video_mime_type FROM module_chapters WHERE chapter_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error fetching video for chapter:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].video_file) {
            console.warn(`Video not found for chapter ID ${id}`);
            return res.status(404).send('Video not found.');
        }
        const file = results[0];
        console.log(`Serving video for chapter ID ${id}: filename=${file.video_filename}, mime_type=${file.video_mime_type}`);
        res.setHeader('Content-Type', file.video_mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${file.video_filename}"`);
        res.send(file.video_file);
    });
});

// Delete a chapter
app.delete('/chapters/:id', (req, res) => {
    const { id } = req.params;

    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error starting transaction.' });
        }

        // First, get the chapter's workstream_id and order_index
        const getChapterSql = 'SELECT workstream_id, order_index FROM module_chapters WHERE chapter_id = ?';
        db.query(getChapterSql, [id], (err, chapterResults) => {
            if (err || chapterResults.length === 0) {
                return db.rollback(() => {
                    console.error('Error getting chapter details:', err);
                    res.status(500).json({ error: 'Failed to get chapter details.' });
                });
            }

            const { workstream_id, order_index } = chapterResults[0];

            // Get all assessments for this chapter
            const getAssessmentsSql = 'SELECT assessment_id FROM assessments WHERE chapter_id = ?';
            db.query(getAssessmentsSql, [id], (err, assessments) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Error getting assessments:', err);
                        res.status(500).json({ error: 'Failed to get assessments.' });
                    });
                }

                const assessmentIds = assessments.map(a => a.assessment_id);

                const deleteSequence = [
                    // 1. Delete answers if there are any assessments
                    next => {
                        if (assessmentIds.length === 0) return next();
                        const sql = 'DELETE FROM answers WHERE question_id IN (SELECT question_id FROM questions WHERE assessment_id IN (?))';
                        db.query(sql, [assessmentIds], err => {
                            if (err) return db.rollback(() => {
                                console.error('Error deleting answers:', err);
                                res.status(500).json({ error: 'Failed to delete answers.' });
                            });
                            next();
                        });
                    },
                    // 2. Delete questions
                    next => {
                        if (assessmentIds.length === 0) return next();
                        const sql = 'DELETE FROM questions WHERE assessment_id IN (?)';
                        db.query(sql, [assessmentIds], err => {
                            if (err) return db.rollback(() => {
                                console.error('Error deleting questions:', err);
                                res.status(500).json({ error: 'Failed to delete questions.' });
                            });
                            next();
                        });
                    },
                    // 3. Delete assessments
                    next => {
                        if (chapterIds.length === 0) return next();
                        const sql = 'DELETE FROM assessments WHERE chapter_id IN (?)';
                        db.query(sql, [chapterIds], err => {
                            if (err) return db.rollback(() => {
                                console.error('Error deleting assessments:', err);
                                res.status(500).json({ error: 'Failed to delete assessments.' });
                            });
                            next();
                        });
                    },
                    // 4. Delete user progress
                    next => {
                        const sql = 'DELETE FROM user_progress WHERE chapter_id = ?';
                        db.query(sql, [id], err => {
                            if (err) return db.rollback(() => {
                                console.error('Error deleting user progress:', err);
                                res.status(500).json({ error: 'Failed to delete user progress.' });
                            });
                            next();
                        });
                    },
                    // 5. Delete the chapter
                    next => {
                        const sql = 'DELETE FROM module_chapters WHERE chapter_id = ?';
                        db.query(sql, [id], err => {
                            if (err) return db.rollback(() => {
                                console.error('Error deleting chapter:', err);
                                res.status(500).json({ error: 'Failed to delete chapter.' });
                            });
                            next();
                        });
                    },
                    // 6. Update order_index for remaining chapters
                    next => {
                        const sql = 'UPDATE module_chapters SET order_index = order_index - 1 WHERE workstream_id = ? AND order_index > ?';
                        db.query(sql, [workstream_id, order_index], err => {
                            if (err) return db.rollback(() => {
                                console.error('Error updating order indices:', err);
                                res.status(500).json({ error: 'Failed to update chapter order.' });
                            });
                            next();
                        });
                    }
                ];

                let currentStep = 0;
                const executeNextStep = () => {
                    if (currentStep < deleteSequence.length) {
                        deleteSequence[currentStep](() => {
                            currentStep++;
                            executeNextStep();
                        });
                    } else {
                        // All steps completed successfully
                        db.commit(err => {
                            if (err) return db.rollback(() => {
                                console.error('Error committing transaction:', err);
                                res.status(500).json({ error: 'Failed to commit changes.' });
                            });
                            res.json({ success: 'Chapter and all associated content deleted successfully.' });
                        });
                    }
                };

                executeNextStep();
            });
        });
    });
});

// Update chapter publish status
app.put('/chapters/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    console.log(`Received publish toggle request for chapter ID: ${id}, new status: ${is_published}`);

    if (typeof is_published !== 'boolean') {
        console.error('Invalid is_published value received:', is_published);
        return res.status(400).json({ error: 'Invalid is_published value. It must be a boolean.' });
    }

    const sql = 'UPDATE module_chapters SET is_published = ? WHERE chapter_id = ?';
    db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            console.error('Database error updating chapter publish state:', err);
            return res.status(500).json({ error: 'Failed to update chapter publish state.', details: err.message });
        }
        if (result.affectedRows === 0) {
            console.warn(`Chapter not found for publish update: ${id}`);
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        console.log(`Chapter ID ${id} publish state updated to ${is_published} successfully.`);
        res.json({ success: true, message: 'Chapter publish state updated successfully.' });
    });
});

// Get chapter PDF file
app.get('/chapters/:id/pdf', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT pdf_file, pdf_filename, pdf_mime_type FROM module_chapters WHERE chapter_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error fetching PDF for chapter:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].pdf_file) {
            console.warn(`PDF not found for chapter ID ${id}`);
            return res.status(404).send('PDF not found.');
        }
        const file = results[0];
        console.log(`Serving PDF for chapter ID ${id}: filename=${file.pdf_filename}, mime_type=${file.pdf_mime_type}`);
        res.setHeader('Content-Type', file.pdf_mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${file.pdf_filename}"`);
        res.send(file.pdf_file);
    });
});

// Get chapter video file
app.get('/chapters/:id/video', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT video_file, video_filename, video_mime_type FROM module_chapters WHERE chapter_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Error fetching video for chapter:', err);
            return res.status(500).json({ error: err.message });
        }
        if (results.length === 0 || !results[0].video_file) {
            console.warn(`Video not found for chapter ID ${id}`);
            return res.status(404).send('Video not found.');
        }
        const file = results[0];
        console.log(`Serving video for chapter ID ${id}: filename=${file.video_filename}, mime_type=${file.video_mime_type}`);
        res.setHeader('Content-Type', file.video_mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${file.video_filename}"`);
        res.send(file.video_file);
    });
});


// Assessments, Questions, etc. CRUD

// Create Assessment
app.post('/assessments', (req, res) => {
    const { chapter_id, workstream_id, title, questions } = req.body;
    const total_points = (questions && questions.length) ? questions.length : 0;

    if (!title) {
        return res.status(400).json({ error: 'Title is required.' });
    }
    if (!chapter_id && !workstream_id) {
        return res.status(400).json({ error: 'Either chapter_id or workstream_id is required.' });
    }

    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error.' });
        }

        const createAssessmentAndQuestions = (targetChapterId) => {
            const assessmentSql = 'INSERT INTO assessments (chapter_id, title, total_points) VALUES (?, ?, ?)';
            db.query(assessmentSql, [targetChapterId, title, total_points], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Error creating assessment:', err);
                        res.status(500).json({ error: 'Database error while creating assessment.' });
                    });
                }

                const newAssessmentId = result.insertId;

                if (questions && questions.length > 0) {
                    const questionInsertSql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer, options) VALUES ?';
                    const questionValues = questions.map(q => [
                        newAssessmentId, q.question_text, q.question_type, q.correct_answer, JSON.stringify(q.options || null)
                    ]);

                    db.query(questionInsertSql, [questionValues], (err, questionResult) => {
                        if (err) {
                            return db.rollback(() => {
                                console.error('Error creating questions:', err);
                                res.status(500).json({ error: 'Database error while creating questions.' });
                            });
                        }
                        db.commit(err => {
                            if (err) { return db.rollback(() => res.status(500).json({ error: 'Database error on commit.' })); }
                            res.status(201).json({ success: 'Assessment and questions created', assessment_id: newAssessmentId });
                        });
                    });
                } else {
                    db.commit(err => {
                        if (err) { return db.rollback(() => res.status(500).json({ error: 'Database error on commit.' })); }
                        res.status(201).json({ success: 'Assessment created', assessment_id: newAssessmentId });
                    });
                }
            });
        };

        if (workstream_id) {
            // This is a workstream-level assessment, so we create a hidden chapter for it.
            const chapterSql = 'INSERT INTO module_chapters (workstream_id, title, content, is_published, order_index) VALUES (?, ?, ?, ?, ?)';
            const hiddenChapterTitle = `Final Assessment: ${title}`;
            const hiddenChapterContent = 'This chapter holds the final assessment for the workstream.';
            db.query(chapterSql, [workstream_id, hiddenChapterTitle, hiddenChapterContent, false, 9999], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Error creating hidden chapter for assessment:', err);
                        res.status(500).json({ error: 'Failed to create hidden chapter.' });
                    });
                }
                const newChapterId = result.insertId;
                createAssessmentAndQuestions(newChapterId);
            });
        } else {
            // This is a regular chapter assessment.
            createAssessmentAndQuestions(chapter_id);
        }
    });
});

// Get Assessments for a Chapter
app.get('/chapters/:chapter_id/assessments', (req, res) => {
    const { chapter_id } = req.params;
    const sql = 'SELECT * FROM assessments WHERE chapter_id = ? ORDER BY order_index ASC';
    db.query(sql, [chapter_id], (err, results) => {
        if (err) {
            console.error(`Error fetching assessments for chapter ${chapter_id}:`, err);
            return res.status(500).json({ error: 'Failed to fetch assessments.' });
        }
        res.json(results);
    });
});

// Update an assessment
app.put('/assessments/:id', (req, res) => {
    const { id } = req.params;
    const { title, description, chapter_id, is_final, workstream_id } = req.body;
    // Validation: Only one of chapter_id or is_final must be set
    if ((chapter_id && is_final) || (!chapter_id && !is_final)) {
        return res.status(400).json({ error: 'Select either a chapter or mark as final assessment, not both or neither.' });
    }
    // If is_final, find or create the final chapter for the workstream
    if (is_final) {
        if (!workstream_id) return res.status(400).json({ error: 'workstream_id required for final assessment.' });
        db.query('SELECT title FROM workstreams WHERE workstream_id = ?', [workstream_id], (err, wsResult) => {
            if (err || !wsResult || wsResult.length === 0) {
                return res.status(500).json({ error: 'Failed to fetch workstream title.' });
            }
            const wsTitle = wsResult[0].title;
            const finalChapterTitle = `Final Assessment for: ${wsTitle}`;
            db.query('SELECT chapter_id FROM module_chapters WHERE workstream_id = ? AND title = ?', [workstream_id, finalChapterTitle], (err, chapters) => {
                if (err) return res.status(500).json({ error: err.message });
                if (chapters.length > 0) {
                    // Use existing final chapter
                    updateAssessment(chapters[0].chapter_id);
                } else {
                    // Create new final chapter
                    const chapterSql = 'INSERT INTO module_chapters (workstream_id, title, content, is_published, order_index) VALUES (?, ?, ?, ?, ?)';
                    db.query('SELECT COALESCE(MAX(order_index), 0) as max_order FROM module_chapters WHERE workstream_id = ?', [workstream_id], (err, orderResult) => {
                        if (err) return res.status(500).json({ error: err.message });
                        const newOrderIndex = (orderResult[0].max_order || 0) + 1;
                        db.query(chapterSql, [workstream_id, finalChapterTitle, description || 'This chapter holds the final assessment for the workstream.', false, newOrderIndex], (err, result) => {
                            if (err) return res.status(500).json({ error: err.message });
                            updateAssessment(result.insertId);
                        });
                    });
                }
            });
            function updateAssessment(finalChapterId) {
                const sql = 'UPDATE assessments SET chapter_id = ?, title = ?, description = ? WHERE assessment_id = ?';
                db.query(sql, [finalChapterId, title, description, id], (err, result) => {
                    if (err) return res.status(500).json({ error: err.message });
                    if (result.affectedRows === 0) return res.status(404).json({ error: 'Assessment not found.' });
                    res.json({ success: 'Assessment updated successfully.' });
                });
            }
        });
    } else {
        // Not final, update with selected chapter
        const sql = 'UPDATE assessments SET chapter_id = ?, title = ?, description = ? WHERE assessment_id = ?';
        db.query(sql, [chapter_id, title, description, id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Assessment not found.' });
            res.json({ success: 'Assessment updated successfully.' });
        });
    }
});

// Get a single assessment by ID
app.get('/assessments/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM assessments WHERE assessment_id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(`Error fetching assessment ${id}:`, err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (result.length === 0) {
            return res.status(404).json({ error: 'Assessment not found' });
        }
        res.json(result[0]);
    });
});

// Get all questions for a specific assessment
app.get('/assessments/:id/questions', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM questions WHERE assessment_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(`Error fetching questions for assessment ${id}:`, err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Submit answers for an assessment
app.post('/answers', (req, res) => {
    const { userId, answers, assessmentId } = req.body;

    if (!userId || !answers || !Array.isArray(answers) || answers.length === 0 || !assessmentId) {
        return res.status(400).json({ error: 'User ID, Assessment ID, and a non-empty array of answers are required.' });
    }

    const questionIds = answers.map(a => a.questionId);
    const submissionTimestamp = new Date();

    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error.' });
        }

        // Check attempt count before proceeding
        const checkAttemptsSql = `
            SELECT COUNT(DISTINCT answered_at) as attempt_count
            FROM answers
            WHERE user_id = ? AND question_id IN (
                SELECT question_id FROM questions WHERE assessment_id = ?
            );
        `;

        db.query(checkAttemptsSql, [userId, assessmentId], (err, results) => {
            if (err) {
                return db.rollback(() => {
                    console.error('Error checking attempt count:', err);
                    res.status(500).json({ error: 'Database error while checking attempts.' });
                });
            }

            const attemptCount = results[0].attempt_count;
            if (attemptCount >= 5) {
                return db.rollback(() => {
                    res.status(403).json({ error: 'You have reached the maximum number of attempts for this assessment.' });
                });
            }

            const getQuestionsSql = 'SELECT question_id, question_type, correct_answer, options, (SELECT chapter_id FROM assessments WHERE assessment_id = ?) as chapter_id FROM questions WHERE question_id IN (?)';
            db.query(getQuestionsSql, [assessmentId, questionIds], (fetchErr, questions) => {
                if (fetchErr || questions.length === 0) {
                    return db.rollback(() => {
                        console.error('Error fetching questions or no questions found:', fetchErr);
                        res.status(500).json({ error: 'Database error while fetching question details.' });
                    });
                }

                const chapterId = questions[0].chapter_id;

                const insertValues = answers.map(ans => {
                    const question = questions.find(q => q.question_id === ans.questionId);
                    let score = 0;
                    
                    if (question) {
                        if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
                            // For both multiple choice and true/false, directly compare the numeric indices
                            score = parseInt(ans.answer) === parseInt(question.correct_answer) ? 1 : 0;
                        } else {
                            // For identification, case-insensitive comparison
                            score = ans.answer.toLowerCase() === question.correct_answer.toLowerCase() ? 1 : 0;
                        }
                    }

                    return [ans.questionId, userId, ans.answer, score];
                });

                const totalScore = insertValues.reduce((sum, current) => sum + current[3], 0);
                const totalQuestions = questions.length;
                const percentage = totalQuestions > 0 ? (totalScore / totalQuestions) * 100 : 0;

                const insertSql = 'INSERT INTO answers (question_id, user_id, user_answer, score) VALUES ?';
                db.query(insertSql, [insertValues], (insertErr, insertResult) => {
                    if (insertErr) {
                        return db.rollback(() => {
                            console.error('Error inserting new answers:', insertErr);
                            res.status(500).json({ error: 'Database error while saving answers.' });
                        });
                    }

                    // If score is > 50%, mark chapter as complete
                    if (percentage >= 50 && chapterId) {
                        const completeChapterSql = `
                            INSERT INTO user_progress (user_id, chapter_id, is_completed, completion_time)
                            VALUES (?, ?, TRUE, NOW())
                            ON DUPLICATE KEY UPDATE is_completed = TRUE, completion_time = NOW()
                        `;
                        db.query(completeChapterSql, [userId, chapterId], (completeErr, completeResult) => {
                            if (completeErr) {
                                // Don't fail the whole transaction, just log it
                                console.error('Failed to mark chapter as complete after passing assessment:', completeErr);
                            }
                            // Commit the transaction regardless
                            db.commit(commitErr => {
                                if (commitErr) {
                                    return db.rollback(() => res.status(500).json({ error: 'Database error on commit.' }));
                                }
                                res.status(201).json({ success: 'Answers submitted successfully.', totalScore, totalQuestions });
                            });
                        });
                    } else {
                        // Commit transaction without marking chapter as complete
                        db.commit(commitErr => {
                            if (commitErr) {
                                return db.rollback(() => res.status(500).json({ error: 'Database error on commit.' }));
                            }
                            res.status(201).json({ success: 'Answers submitted successfully.', totalScore, totalQuestions });
                        });
                    }
                });
            });
        });
    });
});

// Delete Assessment
app.delete('/assessments/:id', (req, res) => {
    const { id } = req.params;

    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error.' });
        }

        // 1. Get all question IDs for the assessment
        const getQuestionsSql = 'SELECT question_id FROM questions WHERE assessment_id = ?';
        db.query(getQuestionsSql, [id], (err, questions) => {
            if (err) {
                return db.rollback(() => {
                    console.error('Error fetching questions for deletion:', err);
                    res.status(500).json({ error: 'Failed to fetch questions for deletion.' });
                });
            }

            const questionIds = questions.map(q => q.question_id);

            const deleteAnswers = (callback) => {
                if (questionIds.length === 0) {
                    return callback(); // No questions, so no answers to delete
                }
                const deleteAnswersSql = 'DELETE FROM answers WHERE question_id IN (?)';
                db.query(deleteAnswersSql, [questionIds], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error deleting answers:', err);
                            res.status(500).json({ error: 'Failed to delete answers.' });
                        });
                    }
                    callback();
                });
            };

            const deleteQuestions = (callback) => {
                if (questionIds.length === 0) {
                    return callback();
                }
                const deleteQuestionsSql = 'DELETE FROM questions WHERE assessment_id = ?';
                db.query(deleteQuestionsSql, [id], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error deleting questions:', err);
                            res.status(500).json({ error: 'Failed to delete questions.' });
                        });
                    }
                    callback();
                });
            };

            const deleteAssessment = (callback) => {
                const deleteAssessmentSql = 'DELETE FROM assessments WHERE assessment_id = ?';
                db.query(deleteAssessmentSql, [id], (err, result) => {
                    if (err) {
                        return db.rollback(() => {
                            console.error('Error deleting assessment:', err);
                            res.status(500).json({ error: 'Failed to delete assessment.' });
                        });
                    }
                    if (result.affectedRows === 0) {
                        return db.rollback(() => {
                            res.status(404).json({ error: 'Assessment not found.' });
                        });
                    }
                    callback();
                });
            };

            // Execute deletions in order
            deleteAnswers(() => {
                deleteQuestions(() => {
                    deleteAssessment(() => {
                        db.commit(err => {
                            if (err) {
                                return db.rollback(() => {
                                    console.error('Commit error:', err);
                                    res.status(500).json({ error: 'Database error on commit.' });
                                });
                            }
                            res.json({ success: 'Assessment and all associated content deleted successfully!' });
                        });
                    });
                });
            });
        });
    });
});

// Create Question
app.post('/questions', (req, res) => {
    const { assessment_id, question_text, question_type, correct_answer, options } = req.body;
    
    db.beginTransaction(err => {
        if (err) { return res.status(500).json({ error: 'Database error.' }); }

        const questionSql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer, options) VALUES (?, ?, ?, ?, ?)';
        db.query(questionSql, [assessment_id, question_text, question_type, correct_answer, JSON.stringify(options || null)], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error('Error creating question:', err);
                    res.status(500).json({ error: 'Failed to create question.' });
                });
            }
            const newQuestionId = result.insertId;

            const updatePointsSql = 'UPDATE assessments SET total_points = total_points + 1 WHERE assessment_id = ?';
            db.query(updatePointsSql, [assessment_id], (err, updateResult) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Error updating assessment points:', err);
                        res.status(500).json({ error: 'Failed to update points.' });
                    });
                }
                db.commit(err => {
                    if (err) { return db.rollback(() => res.status(500).json({ error: 'DB commit error.'}))}
                    res.status(201).json({ success: 'Question created', question_id: newQuestionId });
                });
            });
        });
    });
});

// Get Questions for an Assessment
app.get('/assessments/:assessmentId/questions', (req, res) => {
    const { assessmentId } = req.params;
    const sql = 'SELECT * FROM questions WHERE assessment_id = ?';
    db.query(sql, [assessmentId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // The mysql2 driver handles parsing the JSON 'options' column automatically.
        // We send the results directly to the frontend.
        res.json(results);
    });
});

// Update Question
app.put('/questions/:id', (req, res) => {
    const { id } = req.params;
    const { question_text, question_type, correct_answer, options } = req.body;
    const sql = 'UPDATE questions SET question_text = ?, question_type = ?, correct_answer = ?, options = ? WHERE question_id = ?';
    db.query(sql, [question_text, question_type, correct_answer, JSON.stringify(options || null), id], (err, result) => {
        if (err) {
            console.error('Error updating question:', err);
            return res.status(500).json({ error: 'Failed to update question.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Question not found.' });
        res.json({ success: 'Question updated successfully.' });
    });
});

// Delete Question (and its related answers)
app.delete('/questions/:id', (req, res) => {
    const { id } = req.params;

    db.beginTransaction(err => {
        if (err) {
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error starting transaction.' });
        }

        // First, delete answers associated with the question
        const deleteAnswersSql = 'DELETE FROM answers WHERE question_id = ?';
        db.query(deleteAnswersSql, [id], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    console.error('Error deleting answers for question:', err);
                    res.status(500).json({ error: 'Failed to delete associated answers.' });
                });
            }

            // Then, delete the question itself
            const deleteQuestionSql = 'DELETE FROM questions WHERE question_id = ?';
            db.query(deleteQuestionSql, [id], (err, result) => {
                if (err) {
                    return db.rollback(() => {
                        console.error('Error deleting question:', err);
                        res.status(500).json({ error: 'Failed to delete the question.' });
                    });
                }
                
                if (result.affectedRows === 0) {
                    return db.rollback(() => {
                        res.status(404).json({ error: 'Question not found.' });
                    });
                }

                db.commit(err => {
                    if (err) {
                        return db.rollback(() => res.status(500).json({ error: 'Failed to commit transaction.' }));
                    }
                    res.json({ success: 'Question deleted successfully!' });
                });
            });
        });
    });
});

// --- Employee-facing Endpoints ---

// Get all published workstreams for employees
app.get('/employee/workstreams', (req, res) => {
    const { userId } = req.query;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    // First, get the allowed workstream IDs for this user
    const permissionsSql = 'SELECT workstream_id FROM user_workstream_permissions WHERE user_id = ?';
    db.query(permissionsSql, [userId], (permErr, permResults) => {
        if (permErr) {
            console.error('Error fetching user workstream permissions:', permErr);
            return res.status(500).json({ error: 'Failed to fetch user permissions.' });
        }
        let workstreamFilter = '';
        let filterValues = [];
        if (permResults.length > 0) {
            // Restrict to only allowed workstreams
            const allowedIds = permResults.map(r => r.workstream_id);
            workstreamFilter = 'AND w.workstream_id IN (?)';
            filterValues = [allowedIds];
        }
        const workstreamsSql = `
            SELECT 
                w.workstream_id, w.title, w.description, w.image_type,
                (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE) as chapters_count,
                (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title NOT LIKE '%Final Assessment%') as regular_chapters_count,
                (
                    SELECT COUNT(DISTINCT a.assessment_id) 
                    FROM assessments a
                    JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                    WHERE mc.workstream_id = w.workstream_id 
                    AND (mc.is_published = TRUE OR mc.title LIKE '%Final Assessment%')
                ) as assessments_count,
                (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title LIKE '%Final Assessment%') > 0 as has_final_assessment
            FROM workstreams w
            WHERE w.is_published = TRUE ${workstreamFilter}
        `;
        db.query(workstreamsSql, filterValues, (err, workstreams) => {
            if (err) {
                console.error('Error fetching employee workstreams:', err);
                return res.status(500).json({ error: err.message });
            }
            const workstreamIds = workstreams.map(ws => ws.workstream_id);
            if (workstreamIds.length === 0) return res.json([]);
            const progressSql = `
                SELECT
                    mc.workstream_id,
                    COUNT(DISTINCT up.chapter_id) AS completed_chapters,
                    COUNT(DISTINCT CASE WHEN mc.title NOT LIKE '%Final Assessment%' THEN up.chapter_id ELSE NULL END) AS completed_regular_chapters
                FROM user_progress up
                JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                WHERE up.user_id = ? AND mc.workstream_id IN (?) AND up.is_completed = TRUE AND mc.is_published = TRUE
                GROUP BY mc.workstream_id
            `;

            db.query(progressSql, [userId, workstreamIds], (progressErr, progressResults) => {
                if (progressErr) {
                    console.error('Error fetching user progress:', progressErr);
                    return res.status(500).json({ error: 'Failed to fetch user progress.' });
                }

                const progressMap = progressResults.reduce((map, row) => {
                    map[row.workstream_id] = {
                        completed_chapters: row.completed_chapters,
                        completed_regular_chapters: row.completed_regular_chapters
                    };
                    return map;
                }, {});

                const workstreamsWithProgress = workstreams.map(ws => {
                    const completedChapters = progressMap[ws.workstream_id]?.completed_chapters || 0;
                    const completedRegularChapters = progressMap[ws.workstream_id]?.completed_regular_chapters || 0;
                    const totalChapters = ws.chapters_count;
                    const regularTotalChapters = ws.regular_chapters_count;
                    const hasFinalAssessment = ws.has_final_assessment > 0;
                    
                    let progress;
                    if (totalChapters === 0) {
                        progress = 0;
                    } else if (!hasFinalAssessment) {
                        // If no final assessment, calculate progress based on regular chapters only
                        progress = regularTotalChapters > 0 ? (completedRegularChapters / regularTotalChapters) * 100 : 0;
                    } else {
                        // If there is a final assessment, require both regular chapters and final assessment
                        const regularProgress = regularTotalChapters > 0 ? (completedRegularChapters / regularTotalChapters) : 0;
                        const finalChapterCompleted = completedChapters > completedRegularChapters;
                        // Only count as 100% if all regular chapters AND final assessment are completed
                        progress = finalChapterCompleted ? regularProgress * 100 : (regularProgress * 90); // Cap at 90% until final is done
                    }

                    return {
                        ...ws,
                        progress: Math.round(progress),
                        all_regular_chapters_completed: regularTotalChapters > 0 && completedRegularChapters >= regularTotalChapters
                    };
                });
                
                res.json(workstreamsWithProgress);
            });
        });
    });
});

// Get all published chapters for a specific workstream for employees
app.get('/employee/workstreams/:workstream_id/chapters', (req, res) => {
    const { workstream_id } = req.params;
    const sql = `
        SELECT 
            chapter_id, workstream_id, title, content, order_index, pdf_filename, video_filename 
        FROM module_chapters 
        WHERE workstream_id = ? 
        AND (is_published = TRUE OR title LIKE '%Final Assessment%')
        ORDER BY 
            CASE WHEN title LIKE '%Final Assessment%' THEN 1 ELSE 0 END,
            order_index ASC
    `;
    db.query(sql, [workstream_id], (err, results) => {
        if (err) {
            console.error(`Error fetching chapters for workstream ${workstream_id}:`, err);
            return res.status(500).json({ error: 'Failed to fetch chapters.' });
        }
        res.json(results);
    });
});

// Publish Question
app.put('/questions/:id/publish', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE questions SET is_published = TRUE WHERE question_id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error publishing question:', err);
            return res.status(500).json({ error: 'Failed to publish question.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Question not found.' });
        res.json({ success: 'Question published successfully.' });
    });
});

// Unpublish Question
app.put('/questions/:id/unpublish', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE questions SET is_published = FALSE WHERE question_id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error unpublishing question:', err);
            return res.status(500).json({ error: 'Failed to unpublish question.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Question not found.' });
        res.json({ success: 'Question unpublished successfully.' });
    });
});

// Get assessment results for a user (latest/highest score per assessment)
app.get('/users/:userId/assessment-results', (req, res) => {
    const { userId } = req.params;
    // For each assessment, get the highest score attempt for this user
    const sql = `
        SELECT 
            a.assessment_id,
            a.title AS assessment_title,
            w.workstream_id,
            w.title AS workstream_title,
            MAX(user_score) AS user_score,
            a.total_points
        FROM (
            SELECT 
                a.assessment_id,
                a.title,
                mc.workstream_id,
                SUM(ans.score) AS user_score,
                a.total_points,
                ans.answered_at
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            JOIN assessments a ON q.assessment_id = a.assessment_id
            JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
            WHERE ans.user_id = ?
            GROUP BY a.assessment_id, ans.answered_at
        ) AS attempts
        JOIN assessments a ON attempts.assessment_id = a.assessment_id
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        GROUP BY a.assessment_id, a.title, w.workstream_id, w.title, a.total_points
        ORDER BY w.title, a.title
    `;
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching assessment results:', err);
            return res.status(500).json({ error: 'Database error while fetching assessment results.' });
        }
        res.json(results);
    });
});

// --- User Progress Endpoints ---

// Mark a chapter as completed for a user
app.post('/user-progress', (req, res) => {
    const { userId, chapterId } = req.body;

    if (!userId || !chapterId) {
        return res.status(400).json({ error: 'User ID and Chapter ID are required.' });
    }

    const sql = `
        INSERT INTO user_progress (user_id, chapter_id, is_completed, completion_time)
        VALUES (?, ?, TRUE, NOW())
        ON DUPLICATE KEY UPDATE is_completed = TRUE, completion_time = NOW()
    `;

    db.query(sql, [userId, chapterId], (err, result) => {
        if (err) {
            console.error('Error marking chapter as complete:', err);
            return res.status(500).json({ error: 'Failed to update user progress.' });
        }
        if (result.affectedRows === 0 && result.insertId === 0) {
             return res.json({ success: true, message: 'Chapter was already marked as complete.' });
        }
        res.status(201).json({ success: true, message: 'Chapter marked as complete.' });
    });
});

// Get user progress for a specific workstream
app.get('/user-progress/:userId/:workstreamId', (req, res) => {
    const { userId, workstreamId } = req.params;
    const sql = `
        SELECT chapter_id 
        FROM user_progress 
        WHERE user_id = ? 
        AND is_completed = TRUE 
        AND chapter_id IN (SELECT chapter_id FROM module_chapters WHERE workstream_id = ?)
    `;
    db.query(sql, [userId, workstreamId], (err, results) => {
        if (err) {
            console.error('Error fetching user progress for workstream:', err);
            return res.status(500).json({ error: 'Failed to fetch user progress.' });
        }
        res.json(results);
    });
});

// Get leaderboard data
app.get('/leaderboard', (req, res) => {
    // Get all published workstreams and their chapters
    const publishedWsSql = 'SELECT workstream_id FROM workstreams WHERE is_published = TRUE';
    db.query(publishedWsSql, (err, wsResults) => {
        if (err) {
            console.error('Error fetching published workstreams:', err);
            return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
        }
        const publishedWorkstreamIds = wsResults.map(ws => ws.workstream_id);
        const total_workstreams = publishedWorkstreamIds.length;
        if (total_workstreams === 0) {
            return res.json([]);
        }
        // Get all chapters for published workstreams
        const chaptersSql = `SELECT chapter_id, workstream_id FROM module_chapters WHERE workstream_id IN (${publishedWorkstreamIds.join(',')})`;
        db.query(chaptersSql, (err, chapters) => {
            if (err) {
                console.error('Error fetching chapters:', err);
                return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
            }
            // Map workstream_id to chapter_ids
            const wsToChapters = {};
            chapters.forEach(ch => {
                if (!wsToChapters[ch.workstream_id]) wsToChapters[ch.workstream_id] = [];
                wsToChapters[ch.workstream_id].push(ch.chapter_id);
            });
            // Get all non-admin users
            db.query('SELECT user_id, first_name, last_name FROM users WHERE isAdmin = FALSE', (err, users) => {
                if (err) {
                    console.error('Error fetching users:', err);
                    return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
                }
                if (users.length === 0) return res.json([]);
                // Get all user_progress for these users and chapters
                const allChapterIds = chapters.map(ch => ch.chapter_id);
                if (allChapterIds.length === 0) {
                    // No chapters, so all progress is 0
                    const results = users.map(u => ({
                        user_id: u.user_id,
                        employee_name: `${u.first_name} ${u.last_name}`,
                        average_progress: 0,
                        workstreams_with_progress: 0,
                        total_workstreams
                    }));
                    return res.json(results);
            }
                db.query('SELECT user_id, chapter_id FROM user_progress WHERE is_completed = TRUE AND chapter_id IN (?)', [allChapterIds], (err, progressRows) => {
                    if (err) {
                        console.error('Error fetching user_progress:', err);
                        return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
                    }
                    // Map user_id to completed chapters
                    const userToChapters = {};
                    progressRows.forEach(row => {
                        if (!userToChapters[row.user_id]) userToChapters[row.user_id] = new Set();
                        userToChapters[row.user_id].add(row.chapter_id);
                    });
                    // For each user, calculate progress per workstream
                    const results = users.map(u => {
                        let sumProgress = 0;
                        let wsWithProgress = 0;
                        publishedWorkstreamIds.forEach(wsId => {
                            const chapterIds = wsToChapters[wsId] || [];
                            if (chapterIds.length === 0) return;
                            const completed = chapterIds.filter(cid => userToChapters[u.user_id] && userToChapters[u.user_id].has(cid)).length;
                            const progress = (completed / chapterIds.length) * 100;
                            if (progress > 0) wsWithProgress++;
                            sumProgress += progress;
                        });
                        const average_progress = total_workstreams > 0 ? sumProgress / total_workstreams : 0;
                        return {
                            user_id: u.user_id,
                            employee_name: `${u.first_name} ${u.last_name}`,
                            average_progress: Math.round(average_progress * 100) / 100,
                            workstreams_with_progress: wsWithProgress,
                            total_workstreams
                        };
                    });
                    res.json(results);
                });
            });
        });
    });
});

// --- Admin Analytics Endpoints ---

// Get KPIs
app.get('/admin/analytics/kpis', (req, res) => {
    const { workstreamId } = req.query;

    const kpis = {};

    const getTotalUsers = new Promise((resolve, reject) => {
        db.query('SELECT COUNT(*) as total FROM users WHERE isAdmin = FALSE', (err, result) => {
            if (err) return reject(err);
            resolve(result[0].total);
        });
    });

    const getAvgScore = new Promise((resolve, reject) => {
        const sql = `
            SELECT AVG(user_assessment_score) as average_score
            FROM (
                SELECT (SUM(a.score) / ast.total_points) * 100 AS user_assessment_score
                FROM answers a
                JOIN questions q ON a.question_id = q.question_id
                JOIN assessments ast ON q.assessment_id = ast.assessment_id
                WHERE ast.total_points > 0
                GROUP BY a.user_id, q.assessment_id
            ) as user_scores;
        `;
        db.query(sql, (err, result) => {
            if (err) return reject(err);
            resolve(result[0].average_score || 0);
        });
    });

    const getUserProgress = new Promise((resolve, reject) => {
        const totalChaptersSql = `
            SELECT w.workstream_id, COUNT(mc.chapter_id) as total_chapters
            FROM workstreams w
            JOIN module_chapters mc ON w.workstream_id = mc.workstream_id
            WHERE w.is_published = TRUE AND mc.is_published = TRUE
            ${workstreamId ? 'AND w.workstream_id = ?' : ''}
            GROUP BY w.workstream_id
        `;
        
        const progressSql = `
            SELECT
                up.user_id,
                mc.workstream_id,
                COUNT(DISTINCT up.chapter_id) AS completed_chapters
            FROM user_progress up
            JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
            WHERE mc.workstream_id IN (?) AND up.is_completed = TRUE AND mc.is_published = TRUE
            GROUP BY up.user_id, mc.workstream_id
        `;

        const queryParams = workstreamId ? [workstreamId] : [];

        db.query(totalChaptersSql, queryParams, (err, totals) => {
            if (err) return reject(err);
            
            if (totals.length === 0) {
                db.query('SELECT COUNT(*) as total FROM users WHERE isAdmin = FALSE', (err, userResult) => {
                    if (err) return reject(err);
                    return resolve({ completed: 0, pending: userResult[0].total });
                });
                return;
            }

            const workstreamIds = totals.map(t => t.workstream_id);

            db.query(progressSql, [workstreamIds], (err, progresses) => {
                if (err) return reject(err);
                
                const userProgressMap = {}; // { userId: { workstreamId: progress } }
                progresses.forEach(p => {
                    const total = totals.find(t => t.workstream_id === p.workstream_id)?.total_chapters;
                    if (total > 0) {
                        if (!userProgressMap[p.user_id]) userProgressMap[p.user_id] = {};
                        userProgressMap[p.user_id][p.workstream_id] = (p.completed_chapters / total) * 100;
                    }
                });

                let completed = 0;

                db.query('SELECT user_id FROM users WHERE isAdmin = FALSE', (err, users) => {
                    if(err) return reject(err);

                    users.forEach(user => {
                        const userWorkstreams = userProgressMap[user.user_id] || {};
                        let allCompleted = totals.length > 0;
                        
                        totals.forEach(totalWs => {
                            if ((userWorkstreams[totalWs.workstream_id] || 0) < 100) {
                                allCompleted = false;
                            }
                        });

                        if(allCompleted) completed++;
                    });

                    const totalNonAdminUsers = users.length;
                    resolve({ completed, pending: totalNonAdminUsers - completed });
                });
            });
        });
    });

    Promise.all([getTotalUsers, getAvgScore, getUserProgress])
        .then(([totalUsers, averageScore, userProgress]) => {
            res.json({
                totalUsers,
                averageScore,
                userProgress,
            });
        })
        .catch(err => {
            console.error('Error fetching admin KPIs:', err);
            res.status(500).json({ error: 'Failed to fetch KPI data.' });
        });
});

// Get User Engagement
app.get('/admin/analytics/engagement', (req, res) => {
    const { range = 'monthly' } = req.query;
    let startDate = new Date();
    let groupBy = 'DATE'; // DATE, WEEK, MONTH, YEAR
    let dateFormat = '%Y-%m-%d'; // Format for SQL grouping

    switch (range) {
        case 'weekly': 
            startDate.setDate(startDate.getDate() - 7);
            break;
        case 'monthly': 
            startDate.setMonth(startDate.getMonth() - 1);
            break;
        case 'quarterly':
            startDate.setMonth(startDate.getMonth() - 3);
            groupBy = 'MONTH';
            dateFormat = '%Y-%m';
            break;
        case 'yearly': 
            startDate.setFullYear(startDate.getFullYear() - 1);
            groupBy = 'MONTH';
            dateFormat = '%Y-%m';
            break;
        default: 
            startDate.setMonth(startDate.getMonth() - 1);
    }
    
    const sql = `
        SELECT DATE_FORMAT(completion_time, '${dateFormat}') as date, COUNT(*) as value
        FROM user_progress
        WHERE completion_time >= ?
        GROUP BY 1
        ORDER BY 1 ASC;
    `;
    db.query(sql, [startDate], (err, result) => {
        if (err) {
            console.error('Error fetching engagement data:', err);
            return res.status(500).json({ error: 'Failed to fetch engagement data.' });
        }
        res.json(result);
    });
});

// Get Assessment Tracker Data
app.get('/admin/analytics/assessment-tracker', (req, res) => {
    const sql = `
        SELECT
            a.title,
            COUNT(DISTINCT CASE WHEN user_assessment_scores.percentage >= 50 THEN user_assessment_scores.user_id ELSE NULL END) AS passed,
            COUNT(DISTINCT CASE WHEN user_assessment_scores.percentage < 50 THEN user_assessment_scores.user_id ELSE NULL END) AS failed
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN (
            SELECT
                q.assessment_id,
                ans.user_id,
                (SUM(ans.score) / (SELECT ast.total_points FROM assessments ast WHERE ast.assessment_id = q.assessment_id)) * 100 AS percentage
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            GROUP BY q.assessment_id, ans.user_id
        ) AS user_assessment_scores ON a.assessment_id = user_assessment_scores.assessment_id
        WHERE mc.title LIKE '%Final Assessment%' AND a.total_points > 0
        GROUP BY a.assessment_id, a.title;
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching assessment tracker data:', err);
            return res.status(500).json({ error: 'Failed to fetch assessment tracker data.' });
        }
        res.json(results);
    });
});

// Get Critical Learning Areas
app.get('/admin/analytics/critical-areas', (req, res) => {
    const sql = `
        SELECT
            w.title AS workstream_title,
            COUNT(DISTINCT user_scores.user_id) AS failed_users_count
        FROM workstreams w
        JOIN module_chapters mc ON w.workstream_id = mc.workstream_id
        JOIN assessments a ON mc.chapter_id = a.chapter_id
        JOIN (
            SELECT
                ans.user_id,
                q.assessment_id,
                (SUM(ans.score) / (SELECT ast.total_points FROM assessments ast WHERE ast.assessment_id = q.assessment_id)) * 100 AS percentage
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            GROUP BY ans.user_id, q.assessment_id
        ) AS user_scores ON a.assessment_id = user_scores.assessment_id
        WHERE mc.title LIKE '%Final Assessment%' AND a.total_points > 0 AND user_scores.percentage < 50
        GROUP BY w.workstream_id, w.title
        ORDER BY failed_users_count DESC
        LIMIT 5;
    `;
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching critical learning areas:', err);
            return res.status(500).json({ error: 'Failed to fetch critical learning areas.' });
        }
        res.json(results.map(r => r.workstream_title));
    });
});

// Check if a user has passed a specific assessment
app.get('/user-assessment-progress/:userId/:assessmentId', (req, res) => {
    const { userId, assessmentId } = req.params;

    const sql = `
        SELECT 
            (SUM(a.score) / COUNT(q.question_id)) * 100 AS percentage
        FROM answers a
        JOIN questions q ON a.question_id = q.question_id
        WHERE a.user_id = ? AND q.assessment_id = ?
        GROUP BY q.assessment_id;
    `;

    db.query(sql, [userId, assessmentId], (err, results) => {
        if (err) {
            console.error('Error fetching user assessment progress:', err);
            return res.status(500).json({ error: 'Failed to fetch assessment progress.' });
        }

        if (results.length === 0) {
            // No answers submitted, so not passed.
            return res.status(404).json({ is_passed: false, message: 'Assessment not taken yet.' });
        }

        const percentage = results[0].percentage;
        // Consider passed if score is over 50%
        const isPassed = percentage > 50; 
        
        res.json({ is_passed: isPassed });
    });
});

// --- Employee Dashboard Endpoint ---
app.get('/employee/dashboard/:userId', (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required.' });
    }

    // First, get the allowed workstream IDs for this user
    const permissionsSql = 'SELECT workstream_id FROM user_workstream_permissions WHERE user_id = ?';
    db.query(permissionsSql, [userId], (permErr, permResults) => {
        if (permErr) {
            console.error('Error fetching user workstream permissions:', permErr);
            return res.status(500).json({ error: 'Failed to fetch user permissions.' });
        }
        let workstreamFilter = '';
        let filterValues = [];
        if (permResults.length > 0) {
            // Restrict to only allowed workstreams
            const allowedIds = permResults.map(r => r.workstream_id);
            workstreamFilter = 'AND w.workstream_id IN (?)';
            filterValues = [allowedIds];
        }
        const workstreamsSql = `
            SELECT 
                w.workstream_id, w.title, w.description, w.image_type,
                (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE) as chapters_count,
                (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title NOT LIKE '%Final Assessment%') as regular_chapters_count,
                (SELECT COUNT(*) FROM module_chapters mc WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE AND mc.title LIKE '%Final Assessment%') > 0 as has_final_assessment
            FROM workstreams w
            WHERE w.is_published = TRUE ${workstreamFilter}
        `;

        db.query(workstreamsSql, filterValues, (err, workstreams) => {
            if (err) {
                console.error('Error fetching dashboard workstreams:', err);
                return res.status(500).json({ error: 'Failed to fetch workstreams for dashboard.' });
            }

            if (workstreams.length === 0) {
                return res.json({ kpis: { completed: 0, pending: 0 }, workstreams: [] });
            }

            const workstreamIds = workstreams.map(ws => ws.workstream_id);
            if (workstreamIds.length === 0) {
                return res.json({ kpis: { completed: 0, pending: 0 }, workstreams: [] });
            }
            const progressSql = `
                SELECT
                    mc.workstream_id,
                    COUNT(DISTINCT up.chapter_id) AS completed_chapters,
                    COUNT(DISTINCT CASE WHEN mc.title NOT LIKE '%Final Assessment%' THEN up.chapter_id ELSE NULL END) AS completed_regular_chapters
                FROM user_progress up
                JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                WHERE up.user_id = ? AND mc.workstream_id IN (?) AND up.is_completed = TRUE AND mc.is_published = TRUE
                GROUP BY mc.workstream_id
            `;

            db.query(progressSql, [userId, workstreamIds], (progressErr, progressResults) => {
                if (progressErr) {
                    console.error('Error fetching user progress for dashboard:', progressErr);
                    return res.status(500).json({ error: 'Failed to fetch user progress.' });
                }

                const progressMap = progressResults.reduce((map, row) => {
                    map[row.workstream_id] = {
                        completed_chapters: row.completed_chapters,
                        completed_regular_chapters: row.completed_regular_chapters
                    };
                    return map;
                }, {});
                
                let completedCount = 0;
                
                const workstreamsWithProgress = workstreams.map(ws => {
                    const completedChapters = progressMap[ws.workstream_id]?.completed_chapters || 0;
                    const completedRegularChapters = progressMap[ws.workstream_id]?.completed_regular_chapters || 0;
                    const totalChapters = ws.chapters_count;
                    const regularTotalChapters = ws.regular_chapters_count;
                    const hasFinalAssessment = ws.has_final_assessment > 0;
                    
                    let progress;
                    if (totalChapters === 0) {
                        progress = 0;
                    } else if (!hasFinalAssessment) {
                        // If no final assessment, calculate progress based on regular chapters only
                        progress = regularTotalChapters > 0 ? (completedRegularChapters / regularTotalChapters) * 100 : 0;
                    } else {
                        // If there is a final assessment, require both regular chapters and final assessment
                        const regularProgress = regularTotalChapters > 0 ? (completedRegularChapters / regularTotalChapters) : 0;
                        const finalChapterCompleted = completedChapters > completedRegularChapters;
                        // Only count as 100% if all regular chapters AND final assessment are completed
                        progress = finalChapterCompleted ? regularProgress * 100 : (regularProgress * 90); // Cap at 90% until final is done
                    }

                    // Only count as completed if there's content and progress is 100
                    if (totalChapters > 0 && progress >= 100) {
                        completedCount++;
                    }

                    return {
                        ...ws,
                        total_chapters: ws.chapters_count,
                        progress: Math.round(progress),
                        image_url: ws.image_type ? `/workstreams/${ws.workstream_id}/image` : null
                    };
                });
                
                const pendingCount = workstreams.length - completedCount;

                res.json({
                    kpis: {
                        completed: completedCount,
                        pending: pendingCount
                    },
                    workstreams: workstreamsWithProgress
                });
            });
        });
    });
});

// User-Workstream Permissions API
// Get workstream permissions for a user
app.get('/users/:id/workstreams', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT workstream_id FROM user_workstream_permissions WHERE user_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        // If empty, means all workstreams are allowed
        res.json({ workstream_ids: results.map(r => r.workstream_id) });
    });
});

// Set workstream permissions for a user
app.put('/users/:id/workstreams', (req, res) => {
    const { id } = req.params;
    const { workstream_ids } = req.body; // array of workstream IDs, empty = all
    if (!Array.isArray(workstream_ids)) {
        return res.status(400).json({ error: 'workstream_ids must be an array' });
    }
    // Remove all existing permissions
    db.query('DELETE FROM user_workstream_permissions WHERE user_id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (workstream_ids.length === 0) {
            // All workstreams allowed by default
            return res.json({ success: true });
        }
        // Insert new permissions
        const values = workstream_ids.map(wid => [id, wid]);
        db.query('INSERT INTO user_workstream_permissions (user_id, workstream_id) VALUES ?', [values], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });
            res.json({ success: true });
        });
    });
});

// --- Assessment Publish/Unpublish ---
// Publish assessment
app.put('/assessments/:id/publish', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE assessments SET is_published = TRUE WHERE assessment_id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error publishing assessment:', err);
            return res.status(500).json({ error: 'Failed to publish assessment.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Assessment not found.' });
        res.json({ success: 'Assessment published successfully.' });
    });
});
// Unpublish assessment
app.put('/assessments/:id/unpublish', (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE assessments SET is_published = FALSE WHERE assessment_id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error unpublishing assessment:', err);
            return res.status(500).json({ error: 'Failed to unpublish assessment.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Assessment not found.' });
        res.json({ success: 'Assessment unpublished successfully.' });
    });
});

// --- Assessment Results with Filters ---
app.get('/admin/assessments/results', (req, res) => {
    const { workstreamId, chapterId, employeeId } = req.query;
    let whereClauses = [];
    let params = [];
    if (workstreamId) {
        whereClauses.push('w.workstream_id = ?');
        params.push(workstreamId);
    }
    if (chapterId) {
        whereClauses.push('mc.chapter_id = ?');
        params.push(chapterId);
    }
    if (employeeId) {
        whereClauses.push('u.user_id = ?');
        params.push(employeeId);
    }
    const whereSql = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';
    const sql = `
        SELECT 
            u.user_id, u.first_name, u.last_name, u.email,
            w.workstream_id, w.title AS workstream_title,
            mc.chapter_id, mc.title AS chapter_title,
            a.assessment_id, a.title AS assessment_title,
            MIN(ans.answered_at) AS date_taken,
            COUNT(ans.answer_id) AS num_attempts,
            SUM(ans.score) AS total_score,
            a.total_points,
            CASE WHEN SUM(ans.score) >= (a.total_points * 0.5) THEN 'Pass' ELSE 'Fail' END AS pass_fail
        FROM answers ans
        JOIN questions q ON ans.question_id = q.question_id
        JOIN assessments a ON q.assessment_id = a.assessment_id
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        JOIN users u ON ans.user_id = u.user_id
        ${whereSql}
        GROUP BY u.user_id, w.workstream_id, mc.chapter_id, a.assessment_id
        ORDER BY date_taken DESC
    `;
    db.query(sql, params, (err, results) => {
        if (err) {
            console.error('Error fetching assessment results:', err);
            return res.status(500).json({ error: 'Failed to fetch assessment results.' });
        }
        res.json(results);
    });
});

// --- KPI ENDPOINTS ---
app.get('/kpi/total-workstreams', (req, res) => {
  db.query('SELECT COUNT(*) AS count FROM workstreams', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: results[0].count });
  });
});

app.get('/kpi/total-chapters', (req, res) => {
  db.query('SELECT COUNT(*) AS count FROM module_chapters', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: results[0].count });
  });
});

app.get('/kpi/total-assessments', (req, res) => {
  db.query('SELECT COUNT(*) AS count FROM assessments', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: results[0].count });
  });
});

app.get('/kpi/total-assessments-taken', (req, res) => {
  db.query(`
    SELECT COUNT(DISTINCT a.user_id, q.assessment_id) AS count
    FROM answers a
    JOIN questions q ON a.question_id = q.question_id
  `, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: results[0].count });
  });
});

// Update chapter order
app.put('/chapters/reorder', (req, res) => {
  const { chapters } = req.body;

  if (!Array.isArray(chapters) || chapters.length === 0) {
    return res.status(400).json({ error: 'Invalid or empty chapters array provided.' });
  }

  const workstreamId = chapters[0]?.workstream_id;
  if (!workstreamId) {
    // This part is commented out as workstream_id is not consistently available from the frontend.
    // We will rely on chapter_id uniqueness.
    // console.warn("workstream_id not provided in reorder request.");
  }

  const chapterIds = chapters.map(c => c.chapter_id);
  if (chapterIds.some(id => !id)) {
    return res.status(400).json({ error: 'All chapters must have a valid chapter_id.' });
  }

  let caseSql = 'SET order_index = CASE chapter_id ';
  const params = [];

  chapters.forEach((chapter, index) => {
    caseSql += 'WHEN ? THEN ? ';
    params.push(chapter.chapter_id, index);
  });

  caseSql += 'END';
  
  const fullSql = `UPDATE module_chapters ${caseSql} WHERE chapter_id IN (?)`;
  params.push(chapterIds);

  db.query(fullSql, params, (err, result) => {
    if (err) {
      console.error('Error reordering chapters:', err);
      return res.status(500).json({ error: 'Failed to save new chapter order due to a database error.' });
    }
    if (result.affectedRows === 0) {
        // This could happen if none of the chapter_ids matched.
        return res.status(404).json({ error: 'No chapters found to reorder. Please check the chapter IDs.' });
    }
    res.json({ message: 'Chapter order updated successfully.' });
  });
});

// Route to get all chapters for a workstream
app.get('/workstreams/:workstreamId/chapters', (req, res) => {
  const { workstreamId } = req.params;
  const sql = `
    SELECT chapter_id, workstream_id, title, content, order_index, pdf_filename, video_filename, is_published
    FROM module_chapters
    WHERE workstream_id = ?
    ORDER BY order_index ASC
  `;
  db.query(sql, [workstreamId], (err, results) => {
    if (err) {
      console.error(`Error fetching chapters for workstream ${workstreamId}:`, err);
      return res.status(500).json({ error: 'Failed to fetch chapters.' });
    }
    res.json(results);
  });
});

// CONSOLIDATED UPDATE for a chapter
app.put('/chapters/:id', upload.fields([{ name: 'video_file' }, { name: 'pdf_file' }]), (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const videoFile = req.files?.video_file?.[0];
    const pdfFile = req.files?.pdf_file?.[0];

    let sql = 'UPDATE module_chapters SET ';
    const params = [];
    const updates = [];

    if (title) {
        updates.push('title = ?');
        params.push(title);
    }
    if (content) {
        updates.push('content = ?');
        params.push(content);
    }
    if (videoFile) {
        updates.push('video_file = ?, video_filename = ?, video_mime_type = ?');
        params.push(videoFile.buffer, videoFile.originalname, videoFile.mimetype);
    }
    if (pdfFile) {
        updates.push('pdf_file = ?, pdf_filename = ?, pdf_mime_type = ?');
        params.push(pdfFile.buffer, pdfFile.originalname, pdfFile.mimetype);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update provided.' });
    }

    sql += updates.join(', ');
    sql += ' WHERE chapter_id = ?';
    params.push(id);

    db.query(sql, params, (err, result) => {
        if (err) {
            console.error(`Error updating chapter ${id}:`, err);
            return res.status(500).json({ error: 'Database error while updating chapter.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        // Fetch the updated chapter to return it with proper URLs
        const selectSql = 'SELECT *, video_filename IS NOT NULL as has_video, pdf_filename IS NOT NULL as has_pdf FROM module_chapters WHERE chapter_id = ?';
        db.query(selectSql, [id], (err, results) => {
            if (err || results.length === 0) {
                return res.status(500).json({ error: 'Failed to fetch updated chapter data.' });
            }
            const updatedChapter = results[0];
            const responseData = {
                ...updatedChapter,
                video_url: updatedChapter.has_video ? `/chapters/${id}/video` : null,
                pdf_url: updatedChapter.has_pdf ? `/chapters/${id}/pdf` : null,
            };
            res.json(responseData);
        });
    });
});

// Update chapter publish status
app.put('/chapters/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    console.log(`Received publish toggle request for chapter ID: ${id}, new status: ${is_published}`);

    if (typeof is_published !== 'boolean') {
        console.error('Invalid is_published value received:', is_published);
        return res.status(400).json({ error: 'Invalid is_published value. It must be a boolean.' });
    }

    const sql = 'UPDATE module_chapters SET is_published = ? WHERE chapter_id = ?';
    db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            console.error('Database error updating chapter publish state:', err);
            return res.status(500).json({ error: 'Failed to update chapter publish state.', details: err.message });
        }
        if (result.affectedRows === 0) {
            console.warn(`Chapter not found for publish update: ${id}`);
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        console.log(`Chapter ID ${id} publish state updated to ${is_published} successfully.`);
        res.json({ success: true, message: 'Chapter publish state updated successfully.' });
    });
});

// --- Leaderboard by Workstream (Accurate Per-Workstream Progress, Workstreams Completed) ---
app.get('/leaderboard/workstream/:workstreamId', (req, res) => {
    const { workstreamId } = req.params;
    // Get all published workstreams
    const publishedWsSql = 'SELECT workstream_id FROM workstreams WHERE is_published = TRUE';
    db.query(publishedWsSql, (err, wsResults) => {
        if (err) {
            console.error('Error fetching published workstreams:', err);
            return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
        }
        const publishedWorkstreamIds = wsResults.map(ws => ws.workstream_id);
        const total_workstreams = publishedWorkstreamIds.length;
        if (total_workstreams === 0) {
            return res.json([]);
        }
        // Get total chapters in the selected workstream
        const chaptersSql = 'SELECT chapter_id FROM module_chapters WHERE workstream_id = ?';
        db.query(chaptersSql, [workstreamId], (err, chapterResults) => {
            if (err) {
                console.error('Error fetching chapters:', err);
                return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
            }
            const chapterIds = chapterResults.map(ch => ch.chapter_id);
            const total_chapters = chapterIds.length;
            if (total_chapters === 0) {
                return res.json([]);
            }
            // Main leaderboard query
            const sql = `
                SELECT 
                    u.user_id,
                    CONCAT(u.first_name, ' ', u.last_name) AS employee_name,
                    COALESCE(ROUND(100.0 * COUNT(DISTINCT up.chapter_id) / ?, 2), 0.00) AS progress_percent,
                    (
                        SELECT COUNT(DISTINCT mc2.workstream_id)
                        FROM user_progress up2
                        JOIN module_chapters mc2 ON up2.chapter_id = mc2.chapter_id
                        JOIN workstreams ws2 ON mc2.workstream_id = ws2.workstream_id
                        WHERE up2.user_id = u.user_id AND up2.is_completed = TRUE AND ws2.is_published = TRUE
                    ) AS workstreams_with_progress
                FROM users u
                JOIN user_workstream_permissions p ON u.user_id = p.user_id AND p.workstream_id = ? AND p.has_access = TRUE
                LEFT JOIN user_progress up ON up.user_id = u.user_id AND up.is_completed = TRUE AND up.chapter_id IN (${chapterIds.length ? chapterIds.join(',') : 'NULL'})
                WHERE u.isAdmin = FALSE
                GROUP BY u.user_id
                ORDER BY progress_percent DESC, employee_name ASC
            `;
            db.query(sql, [total_chapters, workstreamId], (err, results) => {
                if (err) {
                    console.error('Error fetching leaderboard for workstream:', err);
                    return res.status(500).json({ error: 'Failed to fetch leaderboard for workstream.' });
                }
                // Add total_workstreams to each row
                const withTotals = results.map(row => ({ ...row, total_workstreams }));
                res.json(withTotals);
            });
        });
    });
});

// Get user progress for a specific assessment (pass status and attempts)
app.get('/user-assessment-progress/:userId/:assessmentId', (req, res) => {
    const { userId, assessmentId } = req.params;

    const sql = `
        SELECT 
            (sub.user_score / a.total_points) >= 0.8 AS is_passed,
            sub.attempts
        FROM assessments a
        LEFT JOIN (
            SELECT
                q.assessment_id,
                SUM(ans.score) AS user_score,
                COUNT(DISTINCT ans.answered_at) AS attempts
            FROM answers ans
            JOIN questions q ON ans.question_id = q.question_id
            WHERE ans.user_id = ? AND q.assessment_id = ?
            GROUP BY q.assessment_id
        ) AS sub ON a.assessment_id = sub.assessment_id
        WHERE a.assessment_id = ?;
    `;

    db.query(sql, [userId, assessmentId, assessmentId], (err, results) => {
        if (err) {
            console.error('Error fetching user assessment progress:', err);
            return res.status(500).json({ error: 'Failed to fetch user assessment progress.' });
        }
        if (results.length === 0 || results[0].attempts === null) {
            return res.status(404).json({ message: 'No progress found for this assessment.' });
        }
        res.json(results[0]);
    });
});

// --- Debug endpoint to test users table ---
app.get('/test-users', (req, res) => {
  db.query('SELECT user_id, first_name, last_name, isAdmin FROM users', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
    });
});

// Get all assessment results for the admin dashboard
app.get('/admin/assessments/results', (req, res) => {
    const { workstreamId, chapterId } = req.query;

    // Step 1: Get all users who have submitted answers.
    const usersSql = 'SELECT DISTINCT user_id, first_name, last_name FROM users WHERE user_id IN (SELECT DISTINCT user_id FROM answers)';
    db.query(usersSql, (err, users) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Failed to fetch users for admin results.' });
        }

        let allResults = [];
        let usersProcessed = 0;

        if (users.length === 0) {
            return res.json([]);
        }

        // Step 2: For each user, call the proven getAssessmentResultsForUser function.
        users.forEach(user => {
            getAssessmentResultsForUser(user.user_id, (err, results) => {
                if (err) {
                    // Log error but continue processing other users
                    console.error(`Error fetching results for user ${user.user_id}:`, err);
                } else {
                    results.forEach(result => {
                        allResults.push({
                            employee_name: `${user.first_name} ${user.last_name}`,
                            assessment_title: result.assessment_title,
                            date_taken: result.last_date_taken,
                            total_score: result.user_score,
                            num_attempts: result.attempts,
                            pass_fail: result.passed ? 'Pass' : 'Fail',
                            workstream_id: result.workstream_id
                        });
                    });
                }

                usersProcessed++;
                if (usersProcessed === users.length) {
                    // Step 3: Filter and send the final combined results.
                    let finalResults = allResults;
                    if (workstreamId) {
                        finalResults = finalResults.filter(r => r.workstream_id == workstreamId);
                    }
                    // Note: chapterId filtering would require more data from the function.
                    // For now, we are omitting it to ensure the primary fix works.

                    finalResults.sort((a, b) => new Date(b.date_taken) - new Date(a.date_taken));
                    res.json(finalResults);
                }
            });
        });
    });
});

// Start server
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});