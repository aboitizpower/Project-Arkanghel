import express from 'express';
import multer from 'multer';

const router = express.Router();

// Multer configuration for handling image uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Create a new workstream - Used by WorkstreamCreate.jsx
router.post('/workstreams', upload.single('image'), (req, res) => {
    console.log('=== WORKSTREAM_CREATE POST /workstreams ROUTE HIT ==='); // Debug log
    const { title, description, deadline } = req.body;
    const image = req.file ? req.file.buffer : null;
    const image_type = req.file ? req.file.mimetype : null;

    console.log('WorkstreamCreate received:', { title, description, deadline }); // Debug log

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
            console.log('WorkstreamCreate: Deadline already in MySQL format:', deadlineValue); // Debug log
        } else {
            // Try to parse as ISO string and convert
            const deadlineDate = new Date(deadline);
            if (isNaN(deadlineDate.getTime())) {
                console.log('Invalid deadline format:', deadline); // Debug log
                return res.status(400).json({ error: 'Invalid deadline format. Please use a valid date.' });
            }
            // Convert to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
            deadlineValue = deadlineDate.toISOString().slice(0, 19).replace('T', ' ');
            console.log('WorkstreamCreate: Converted deadline to MySQL format:', deadlineValue); // Debug log
        }
    }

    const sql = 'INSERT INTO workstreams (title, description, image, image_type, deadline) VALUES (?, ?, ?, ?, ?)';
    const params = [title, description, image, image_type, deadlineValue];
    
    console.log('WorkstreamCreate executing SQL:', sql, 'with params:', params); // Debug log
    
    req.db.query(sql, params, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ success: 'Workstream created successfully!', workstream_id: result.insertId });
    });
});

export default router;
