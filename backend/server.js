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
    const sql = 'SELECT workstream_id, title, description, image_type, created_at, is_published FROM workstreams';
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

// Update a workstream
app.put('/workstreams/:id', upload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description } = req.body;
    let sql = 'UPDATE workstreams SET title = ?, description = ?';
    const params = [title, description];

    if (req.file) {
        sql += ', image = ?, image_type = ?';
        params.push(req.file.buffer);
        params.push(req.file.mimetype);
    }

    sql += ' WHERE workstream_id = ?';
    params.push(id);

    db.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: 'Workstream updated successfully!' });
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

// Update workstream publish status
app.put('/chapters/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    if (typeof is_published !== 'boolean') {
        return res.status(400).json({ error: 'Invalid is_published value. It must be a boolean.' });
    }

    const sql = 'UPDATE module_chapters SET is_published = ? WHERE chapter_id = ?';
    db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to update chapter publish state.', details: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: true, message: 'Chapter publish state updated successfully.' });
    });
});

app.put('/workstreams/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    if (is_published === undefined) {
        return res.status(400).json({ error: 'is_published field is required.' });
    }

    const sql = 'UPDATE workstreams SET is_published = ? WHERE workstream_id = ?';
    db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        res.json({ success: `Workstream ${is_published ? 'published' : 'unpublished'} successfully!` });
    });
});

// Reorder chapters and assessments
app.post('/workstreams/:workstream_id/reorder-chapters', (req, res) => {
    const { workstream_id } = req.params;
    const { chapters } = req.body;

    if (!chapters || !Array.isArray(chapters)) {
        return res.status(400).json({ error: 'Invalid payload. Expected an array of chapters.' });
    }

    db.beginTransaction(err => {
        if (err) {
            return res.status(500).json({ error: 'Failed to start transaction.', details: err.message });
        }

        const chapterPromises = chapters.map((chapter) => {
            return new Promise((resolve, reject) => {
                const chapterSql = 'UPDATE module_chapters SET order_index = ? WHERE chapter_id = ? AND workstream_id = ?';
                db.query(chapterSql, [chapter.order_index, chapter.chapter_id, workstream_id], (err, result) => {
                    if (err) return reject(err);
                    if (result.affectedRows === 0) return reject(new Error(`Chapter with ID ${chapter.chapter_id} not found or does not belong to workstream ${workstream_id}.`));
                    resolve();
                });
            });
        });

        Promise.all(chapterPromises)
            .then(() => {
                db.commit(err => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: 'Failed to commit transaction.', details: err.message });
                        });
                    }
                    res.json({ success: 'Order updated successfully.' });
                });
            })
            .catch(error => {
                db.rollback(() => {
                    res.status(500).json({ error: 'Failed to update order.', details: error.message });
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
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0 || !results[0].pdf_file) {
            return res.status(404).send('PDF not found.');
        }
        const file = results[0];
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
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0 || !results[0].video_file) {
            return res.status(404).send('Video not found.');
        }
        const file = results[0];
        res.setHeader('Content-Type', file.video_mime_type);
        res.setHeader('Content-Disposition', `inline; filename="${file.video_filename}"`);
        res.send(file.video_file);
    });
});

// Delete a chapter
app.delete('/chapters/:id', (req, res) => {
    const { id } = req.params;
    const getAssessmentsSql = 'SELECT assessment_id FROM assessments WHERE chapter_id = ?';
    db.query(getAssessmentsSql, [id], (err, assessments) => {
        if (err) return res.status(500).json({ error: `Failed to fetch assessments: ${err.message}` });

        const deleteTheChapter = () => {
            const deleteChapterSql = 'DELETE FROM module_chapters WHERE chapter_id = ?';
            db.query(deleteChapterSql, [id], (err, result) => {
                if (err) return res.status(500).json({ error: `Failed to delete chapter: ${err.message}` });
                if (result.affectedRows === 0) return res.status(404).json({ error: 'Chapter not found.' });
                res.json({ success: 'Chapter and all associated content deleted successfully.' });
            });
        }

        if (assessments.length > 0) {
            const assessmentIds = assessments.map(a => a.assessment_id);
            const deleteQuestionsSql = 'DELETE FROM questions WHERE assessment_id IN (?)';
            db.query(deleteQuestionsSql, [assessmentIds], (err, result) => {
                if (err) return res.status(500).json({ error: `Failed to delete questions: ${err.message}` });
                
                const deleteAssessmentsSql = 'DELETE FROM assessments WHERE chapter_id = ?';
                db.query(deleteAssessmentsSql, [id], (err, result) => {
                    if (err) return res.status(500).json({ error: `Failed to delete assessments: ${err.message}` });
                    deleteTheChapter();
                });
            });
        } else {
            deleteTheChapter();
        }
    });
});

// Update chapter publish status
app.put('/chapters/:id/publish', (req, res) => {
    const { id } = req.params;
    const { is_published } = req.body;

    if (is_published === undefined) {
        return res.status(400).json({ error: 'is_published field is required.' });
    }

    const sql = 'UPDATE module_chapters SET is_published = ? WHERE chapter_id = ?';
    db.query(sql, [is_published, id], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found.' });
        }
        res.json({ success: `Chapter ${is_published ? 'published' : 'unpublished'} successfully!` });
    });
});

// Get chapter PDF file
app.get('/chapters/:id/pdf', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT pdf_file FROM module_chapters WHERE chapter_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0 || !results[0].pdf_file) {
            return res.status(404).json({ error: 'PDF not found.' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.send(results[0].pdf_file);
    });
});

// Get chapter video file
app.get('/chapters/:id/video', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT video_file FROM module_chapters WHERE chapter_id = ?';
    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0 || !results[0].video_file) {
            return res.status(404).json({ error: 'Video not found.' });
        }
        res.setHeader('Content-Type', 'video/mp4'); // Adjust content type if needed
        res.send(results[0].video_file);
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
    const { title } = req.body;

    if (title === undefined) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    const sql = `UPDATE assessments SET title = ? WHERE assessment_id = ?`;

    db.query(sql, [title, id], (err, result) => {
        if (err) {
            console.error(`Error updating assessment ${id}:`, err);
            return res.status(500).json({ error: 'Database error while updating assessment.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Assessment not found.' });
        }
        res.json({ success: 'Assessment updated successfully.' });
    });
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

    db.beginTransaction(err => {
        if (err) { 
            console.error('Transaction start error:', err);
            return res.status(500).json({ error: 'Database error.' });
        }

        const deleteSql = 'DELETE FROM answers WHERE user_id = ? AND question_id IN (?)';
        db.query(deleteSql, [userId, questionIds], (deleteErr, deleteResult) => {
            if (deleteErr) {
                return db.rollback(() => {
                    console.error('Error deleting old answers:', deleteErr);
                    res.status(500).json({ error: 'Database error while updating answers.' });
                });
            }

            const getQuestionsSql = 'SELECT question_id, correct_answer, (SELECT chapter_id FROM assessments WHERE assessment_id = ?) as chapter_id FROM questions WHERE question_id IN (?)';
            db.query(getQuestionsSql, [assessmentId, questionIds], (fetchErr, questions) => {
                if (fetchErr || questions.length === 0) {
                    return db.rollback(() => {
                        console.error('Error fetching questions or no questions found:', fetchErr);
                        res.status(500).json({ error: 'Database error while fetching question details.' });
                    });
                }

                const correctAnswersMap = questions.reduce((map, row) => {
                    map[row.question_id] = row.correct_answer;
                    return map;
                }, {});

                const chapterId = questions[0].chapter_id;

                const insertValues = answers.map(ans => {
                    const score = (correctAnswersMap[ans.questionId] && ans.answer === correctAnswersMap[ans.questionId]) ? 1 : 0;
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
                    if (percentage > 50 && chapterId) {
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
                                res.status(201).json({ success: 'Answers submitted successfully.', totalScore });
                            });
                        });
                    } else {
                        // Commit transaction without marking chapter as complete
                        db.commit(commitErr => {
                            if (commitErr) {
                                return db.rollback(() => res.status(500).json({ error: 'Database error on commit.' }));
                            }
                            res.status(201).json({ success: 'Answers submitted successfully.', totalScore });
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

// Delete Question
app.delete('/questions/:id', (req, res) => {
    const { id } = req.params;

    db.beginTransaction(err => {
        if (err) { return res.status(500).json({ error: 'Database error.' }); }

        const getAssessmentIdSql = 'SELECT assessment_id FROM questions WHERE question_id = ?';
        db.query(getAssessmentIdSql, [id], (err, results) => {
            if (err || results.length === 0) {
                return db.rollback(() => res.status(404).json({ error: 'Question not found.' }));
            }
            const assessmentId = results[0].assessment_id;

            const deleteSql = 'DELETE FROM questions WHERE question_id = ?';
            db.query(deleteSql, [id], (err, result) => {
                if (err) {
                    return db.rollback(() => res.status(500).json({ error: err.message }));
                }
                if (result.affectedRows === 0) {
                    return db.rollback(() => res.status(404).json({ error: 'Question not found during deletion.' }));
                }

                const updatePointsSql = 'UPDATE assessments SET total_points = total_points - 1 WHERE assessment_id = ?';
                db.query(updatePointsSql, [assessmentId], (err, updateResult) => {
                    if (err) {
                        return db.rollback(() => res.status(500).json({ error: 'Failed to update points.' }));
                    }
                    db.commit(err => {
                        if (err) { return db.rollback(() => res.status(500).json({ error: 'DB commit error.'}))}
                        res.json({ success: 'Question deleted successfully.' });
                    });
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

    const sql = `
        SELECT
            w.workstream_id,
            w.title,
            w.description,
            w.image_type,
            w.created_at,
            (
                SELECT COUNT(*)
                FROM module_chapters mc
                WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE
            ) AS chapters_count,
            (
                SELECT COUNT(a.assessment_id)
                FROM assessments a
                JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
                WHERE mc.workstream_id = w.workstream_id AND mc.is_published = TRUE
            ) AS assessments_count,
            COALESCE(
                ROUND(
                    (
                        SELECT COUNT(DISTINCT up.chapter_id) * 100.0
                        FROM user_progress up
                        JOIN module_chapters mc ON up.chapter_id = mc.chapter_id
                        WHERE mc.workstream_id = w.workstream_id 
                        AND mc.is_published = TRUE
                        AND up.user_id = ?
                        AND up.is_completed = TRUE
                    ) / NULLIF(
                        (
                            SELECT COUNT(*)
                            FROM module_chapters mc
                            WHERE mc.workstream_id = w.workstream_id 
                            AND mc.is_published = TRUE
                        ), 0
                    )
                ), 0
            ) AS progress
        FROM
            workstreams w
        WHERE
            w.is_published = TRUE
    `;
    
    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching employee workstreams:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// Get all published chapters for a specific workstream for employees
app.get('/employee/workstreams/:workstream_id/chapters', (req, res) => {
    const { workstream_id } = req.params;
    const sql = 'SELECT chapter_id, workstream_id, title, content, order_index, pdf_filename, video_filename FROM module_chapters WHERE workstream_id = ? AND is_published = TRUE ORDER BY order_index ASC';
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

// Get assessment results for a user
app.get('/users/:userId/assessment-results', (req, res) => {
    const { userId } = req.params;

    const sql = `
        SELECT 
            assessments.assessment_id,
            assessments.title,
            SUM(answers.score) AS user_score,
            (SELECT COUNT(*) FROM questions WHERE questions.assessment_id = assessments.assessment_id) AS total_questions
        FROM answers
        JOIN questions ON answers.question_id = questions.question_id
        JOIN assessments ON questions.assessment_id = assessments.assessment_id
        WHERE answers.user_id = ?
        GROUP BY assessments.assessment_id, assessments.title;
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

// Start server
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});