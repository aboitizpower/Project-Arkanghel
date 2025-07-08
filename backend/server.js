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
    // Note: This is a simplified cascade delete. For production, use transactions and more robust error handling.
    const getChaptersSql = 'SELECT chapter_id FROM module_chapters WHERE workstream_id = ?';
    db.query(getChaptersSql, [id], (err, chapters) => {
        if (err) return res.status(500).json({ error: `Failed to fetch chapters: ${err.message}` });

        if (chapters.length > 0) {
            const chapterIds = chapters.map(c => c.chapter_id);
            const getAssessmentsSql = `SELECT assessment_id FROM assessments WHERE chapter_id IN (${chapterIds.join(',')})`;
            db.query(getAssessmentsSql, (err, assessments) => {
                if (err) return res.status(500).json({ error: `Failed to fetch assessments: ${err.message}` });

                if (assessments.length > 0) {
                    const assessmentIds = assessments.map(a => a.assessment_id);
                    const deleteQuestionsSql = `DELETE FROM questions WHERE assessment_id IN (${assessmentIds.join(',')})`;
                    db.query(deleteQuestionsSql, (err, result) => {
                        if (err) return res.status(500).json({ error: `Failed to delete questions: ${err.message}` });
                        
                        const deleteAssessmentsSql = `DELETE FROM assessments WHERE assessment_id IN (${assessmentIds.join(',')})`;
                        db.query(deleteAssessmentsSql, (err, result) => {
                            if (err) return res.status(500).json({ error: `Failed to delete assessments: ${err.message}` });
                        });
                    });
                }
                const deleteChaptersSql = 'DELETE FROM module_chapters WHERE workstream_id = ?';
                db.query(deleteChaptersSql, [id], (err, result) => {
                    if (err) return res.status(500).json({ error: `Failed to delete chapters: ${err.message}` });
                });
            });
        }
        const deleteWorkstreamSql = 'DELETE FROM workstreams WHERE workstream_id = ?';
        db.query(deleteWorkstreamSql, [id], (err, result) => {
            if (err) return res.status(500).json({ error: `Failed to delete workstream: ${err.message}` });
            res.json({ success: 'Workstream and all associated content deleted successfully!' });
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
    const { chapter_id, title, total_points } = req.body;

    // Get the highest current order_index for the given chapter_id
    const getMaxOrderIndexSql = 'SELECT MAX(order_index) as max_order FROM assessments WHERE chapter_id = ?';
    db.query(getMaxOrderIndexSql, [chapter_id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error while fetching max order index.', details: err.message });
        }

        const nextOrderIndex = (results[0].max_order === null) ? 0 : results[0].max_order + 1;

        const sql = 'INSERT INTO assessments (chapter_id, title, total_points, order_index) VALUES (?, ?, ?, ?)';
        db.query(sql, [chapter_id, title, total_points, nextOrderIndex], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Database error while creating assessment.', details: err.message });
            }
            res.status(201).json({ success: 'Assessment created', assessment_id: result.insertId, order_index: nextOrderIndex });
        });
    });
});

// Get Assessments for a Chapter
app.get('/chapters/:chapter_id/assessments', (req, res) => {
    const { chapter_id } = req.params;
    const sql = 'SELECT * FROM assessments WHERE chapter_id = ? ORDER BY order_index ASC';
    db.query(sql, [chapter_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Update an assessment
app.put('/assessments/:id', (req, res) => {
    const { id } = req.params;
    const { title, total_points, order_index } = req.body;

    // Build the query dynamically based on provided fields
    let fieldsToUpdate = [];
    let params = [];

    if (title !== undefined) {
        fieldsToUpdate.push('title = ?');
        params.push(title);
    }
    if (total_points !== undefined) {
        fieldsToUpdate.push('total_points = ?');
        params.push(total_points);
    }
    if (order_index !== undefined) {
        fieldsToUpdate.push('order_index = ?');
        params.push(order_index);
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id);

    const sql = `UPDATE assessments SET ${fieldsToUpdate.join(', ')} WHERE assessment_id = ?`;

    db.query(sql, params, (err, result) => {
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
    const { userId, answers } = req.body; // `answers` is an array of { questionId, answer }

    if (!userId || !answers || !Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ error: 'User ID and a non-empty array of answers are required.' });
    }

    const questionIds = answers.map(a => a.questionId);

    // Use a transaction to ensure atomicity: delete old answers and insert new ones together.
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

            // The 'points' column does not exist. We will query only for the correct answer.
            const getCorrectAnswersSql = 'SELECT question_id, correct_answer FROM questions WHERE question_id IN (?)';
            db.query(getCorrectAnswersSql, [questionIds], (fetchErr, questions) => {
                if (fetchErr) {
                    return db.rollback(() => {
                        console.error('Error fetching correct answers:', fetchErr);
                        res.status(500).json({ error: 'Database error while fetching correct answers.' });
                    });
                }

                const correctAnswersMap = questions.reduce((map, row) => {
                    map[row.question_id] = row.correct_answer;
                    return map;
                }, {});

                // Each correct answer is worth 1 point.
                const insertValues = answers.map(ans => {
                    const correctAnswer = correctAnswersMap[ans.questionId];
                    const score = (correctAnswer && ans.answer === correctAnswer) ? 1 : 0;
                    return [ans.questionId, userId, ans.answer, score];
                });

                const totalScore = insertValues.reduce((sum, current) => sum + current[3], 0);

                if (insertValues.length === 0) {
                    // Nothing to insert, but no error. Commit the deletion.
                    return db.commit(commitErr => {
                        if (commitErr) {
                            return db.rollback(() => res.status(500).json({ error: 'Database error.' }));
                        }
                        res.status(201).json({ success: 'Answers submitted successfully.', affectedRows: 0, totalScore: 0 });
                    });
                }

                const insertSql = 'INSERT INTO answers (question_id, user_id, user_answer, score) VALUES ?';
                db.query(insertSql, [insertValues], (insertErr, insertResult) => {
                    if (insertErr) {
                        return db.rollback(() => {
                            console.error('Error inserting new answers:', insertErr);
                            res.status(500).json({ error: 'Database error while saving answers.' });
                        });
                    }

                    db.commit(commitErr => {
                        if (commitErr) {
                            return db.rollback(() => {
                                console.error('Commit error:', commitErr);
                                res.status(500).json({ error: 'Database error on commit.' });
                            });
                        }
                        res.status(201).json({ 
                            success: 'Answers submitted successfully.', 
                            affectedRows: insertResult.affectedRows, 
                            totalScore 
                        });
                    });
                });
            });
        });
    });
});

// Delete Assessment
app.delete('/assessments/:id', (req, res) => {
    const { id } = req.params;
    // First delete questions associated with the assessment
    const deleteQuestionsSql = 'DELETE FROM questions WHERE assessment_id = ?';
    db.query(deleteQuestionsSql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: `Failed to delete questions: ${err.message}` });

        const deleteAssessmentSql = 'DELETE FROM assessments WHERE assessment_id = ?';
        db.query(deleteAssessmentSql, [id], (err, result) => {
            if (err) return res.status(500).json({ error: `Failed to delete assessment: ${err.message}` });
            res.json({ success: 'Assessment and its questions deleted successfully!' });
        });
    });
});

// Create Question
app.post('/questions', (req, res) => {
    const { assessment_id, question_text, question_type, correct_answer, options } = req.body;
    const sql = 'INSERT INTO questions (assessment_id, question_text, question_type, correct_answer, options) VALUES (?, ?, ?, ?, ?)';
    db.query(sql, [assessment_id, question_text, question_type, correct_answer, JSON.stringify(options || null)], (err, result) => {
        if (err) {
            console.error('Error creating question:', err);
            return res.status(500).json({ error: 'Failed to create question.' });
        }
        res.status(201).json({ success: 'Question created', question_id: result.insertId });
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
    const sql = 'DELETE FROM questions WHERE question_id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Question not found.' });
        res.json({ success: 'Question deleted successfully.' });
    });
});

// --- Employee-facing Endpoints ---

// Get all published workstreams for employees
app.get('/employee/workstreams', (req, res) => {
    const sql = 'SELECT workstream_id, title, description, image_type, created_at FROM workstreams WHERE is_published = TRUE';
    db.query(sql, (err, results) => {
        if (err) {
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

// Start server
const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});