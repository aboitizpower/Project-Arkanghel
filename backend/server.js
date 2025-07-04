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

// Read all workstreams
app.get('/workstreams', (req, res) => {
    const sql = 'SELECT workstream_id, title, description, image_type, created_at FROM workstreams';
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

// Module Chapters CRUD

// Create a new chapter
app.post('/chapters', upload.fields([{ name: 'pdf_file', maxCount: 1 }, { name: 'video_file', maxCount: 1 }]), (req, res) => {
    const { workstream_id, title, content, order_index } = req.body;
    if (!workstream_id || !title || !content || !order_index) {
        return res.status(400).json({ error: 'Workstream ID, title, content, and order index are required.' });
    }
    console.log('Creating chapter. Files received:', req.files);
    const pdfFile = req.files?.pdf_file?.[0]?.buffer || null;
    const videoFile = req.files?.video_file?.[0]?.buffer || null;
    const sql = 'INSERT INTO module_chapters (workstream_id, title, content, order_index, pdf_file, video_file) VALUES (?, ?, ?, ?, ?, ?)';
    db.query(sql, [workstream_id, title, content, order_index, pdfFile, videoFile], (err, result) => {
        if (err) {
            console.error('Error creating chapter:', err);
            return res.status(500).json({ error: 'Database error while creating chapter.' });
        }
        res.status(201).json({ success: 'Chapter created successfully.', chapterId: result.insertId });
    });
});

// Get all chapters for a specific workstream
app.get('/workstreams/:workstream_id/chapters', (req, res) => {
    const { workstream_id } = req.params;
    const sql = 'SELECT chapter_id, workstream_id, title, content, order_index, created_at, pdf_file IS NOT NULL as has_pdf, video_file IS NOT NULL as has_video FROM module_chapters WHERE workstream_id = ? ORDER BY order_index ASC';
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

// Update a chapter
app.put('/chapters/:id', upload.fields([{ name: 'pdf_file', maxCount: 1 }, { name: 'video_file', maxCount: 1 }]), (req, res) => {
    const { id } = req.params;
    const { title, content, order_index } = req.body;
    if (!title || !content || !order_index) {
        return res.status(400).json({ error: 'Title, content, and order index are required.' });
    }
    console.log(`Updating chapter ${id}. Files received:`, req.files);
    const pdfFile = req.files?.pdf_file?.[0];
    const videoFile = req.files?.video_file?.[0];
    let sql = 'UPDATE module_chapters SET title = ?, content = ?, order_index = ?';
    const params = [title, content, order_index];
    if (pdfFile) {
        sql += ', pdf_file = ?';
        params.push(pdfFile.buffer);
    }
    if (videoFile) {
        sql += ', video_file = ?';
        params.push(videoFile.buffer);
    }
    sql += ' WHERE chapter_id = ?';
    params.push(id);
    db.query(sql, params, (err, result) => {
        if (err) {
            console.error(`Error updating chapter ${id}:`, err);
            return res.status(500).json({ error: 'Database error while updating chapter.' });
        }
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Chapter not found.' });
        res.json({ success: 'Chapter updated successfully.' });
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
    const sql = 'INSERT INTO assessments (chapter_id, title, total_points) VALUES (?, ?, ?)';
    db.query(sql, [chapter_id, title, total_points], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ success: 'Assessment created', assessment_id: result.insertId });
    });
});

// Get Assessments for a Chapter
app.get('/chapters/:chapter_id/assessments', (req, res) => {
    const { chapter_id } = req.params;
    const sql = 'SELECT * FROM assessments WHERE chapter_id = ?';
    db.query(sql, [chapter_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
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
app.get('/assessments/:assessment_id/questions', (req, res) => {
    const { assessment_id } = req.params;
    const sql = 'SELECT * FROM questions WHERE assessment_id = ?';
    db.query(sql, [assessment_id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const questions = results.map(q => {
            let parsedOptions = null;
            if (q.options) {
                try {
                    parsedOptions = JSON.parse(q.options);
                } catch (e) {
                    console.error(`Failed to parse options for question ${q.question_id}:`, q.options);
                    parsedOptions = null; 
                }
            }
            return {
                ...q,
                options: parsedOptions
            };
        });
        res.json(questions);
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
        res.json({ success: 'Question deleted' });
    });
});


app.listen(8081, ()=>{
    console.log('Server is running on port 8081')
})