import express from 'express';

const router = express.Router();

// Get assessment questions - Used by TakeAssessments.jsx (TakeAssessment.jsx)
router.get('/assessments/:id/questions', (req, res) => {
    const { id } = req.params;

    const sql = `
        SELECT 
            q.question_id,
            q.assessment_id,
            q.question_text,
            q.question_type,
            q.options, -- This contains the answer choices
            q.correct_answer
        FROM questions q
        WHERE q.assessment_id = ?
        ORDER BY q.question_id
    `;

    req.db.query(sql, [id], (err, results) => {
        if (err) {
            console.error('Failed to fetch assessment questions:', err);
            return res.status(500).json({ error: 'Database query failed while fetching questions.' });
        }

        const questions = results.map(row => {
            let answers = [];
            let optionsArray = [];

            // Handle options parsing with robust error handling
            if (row.options) {
                if (typeof row.options === 'string' && row.options.trim() !== '') {
                    try {
                        // First try to parse as JSON
                        if (row.options.trim().startsWith('[') || row.options.trim().startsWith('{')) {
                            optionsArray = JSON.parse(row.options);
                        } else {
                            // If not JSON format, split by comma
                            optionsArray = row.options.split(',').map(s => s.trim()).filter(s => s);
                        }
                    } catch (e) {
                        console.warn(`Failed to parse options for question ${row.question_id}:`, e.message);
                        console.warn(`Raw options data:`, row.options);
                        // Try splitting by comma as fallback
                        try {
                            optionsArray = row.options.split(',').map(s => s.trim()).filter(s => s);
                        } catch (fallbackError) {
                            console.error(`Complete failure to parse options for question ${row.question_id}`);
                            optionsArray = [];
                        }
                    }
                } else if (Array.isArray(row.options)) {
                    optionsArray = row.options;
                }

                // Create answers array from options
                answers = optionsArray.map((optionText, index) => ({
                    answer_id: index + 1,
                    answer_text: optionText.toString(),
                }));
            }

            console.log(`Question ${row.question_id} processed:`, {
                question_type: row.question_type,
                raw_options: row.options,
                parsed_options: optionsArray,
                answers_count: answers.length
            });

            return {
                question_id: row.question_id,
                assessment_id: row.assessment_id,
                question_text: row.question_text,
                question_type: row.question_type,
                correct_answer: row.correct_answer,
                answers: answers,
                options: optionsArray
            };
        });

        res.json(questions);
    });
});

// Submit assessment answers - Used by TakeAssessments.jsx (TakeAssessment.jsx)
router.post('/assessments/:id/submit', async (req, res) => {
    const { id: assessment_id } = req.params;
    const { user_id, answers: userAnswers } = req.body;

    console.log('Submission received:', { assessment_id, user_id, userAnswers });

    if (!user_id || !userAnswers || !Array.isArray(userAnswers)) {
        return res.status(400).json({ error: 'user_id and answers array are required.' });
    }

    try {
        // First, let's check if the assessment_results table exists, if not use user_progress
        const questionsSql = `SELECT question_id, correct_answer FROM questions WHERE assessment_id = ?`;
        const [questions] = await req.db.promise().query(questionsSql, [assessment_id]);
        
        if (questions.length === 0) {
            return res.status(404).json({ error: 'No questions found for this assessment.' });
        }

        const correctAnswersMap = new Map(questions.map(q => [q.question_id, q.correct_answer]));
        console.log('Correct answers map:', Object.fromEntries(correctAnswersMap));

        let totalScore = 0;
        let correctAnswers = 0;

        // Get the questions with their options to properly compare answers
        const questionsWithOptionsSql = `SELECT question_id, correct_answer, options, question_type FROM questions WHERE assessment_id = ?`;
        const [questionsWithOptions] = await req.db.promise().query(questionsWithOptionsSql, [assessment_id]);
        
        // Process each answer and calculate score
        for (const userAnswer of userAnswers) {
            const { question_id, answer: provided_answer } = userAnswer;
            const questionData = questionsWithOptions.find(q => q.question_id === question_id);
            
            if (!questionData) {
                console.log(`Question ${question_id} not found`);
                continue;
            }

            let is_correct = false;
            const correct_answer = questionData.correct_answer;
            
            console.log(`Question ${question_id}: provided="${provided_answer}", correct="${correct_answer}", type="${questionData.question_type}"`);

            if (questionData.question_type === 'multiple_choice' || questionData.question_type === 'true_false') {
                // For multiple choice/true_false, correct_answer might be an index
                let optionsArray = [];
                if (questionData.options) {
                    try {
                        if (typeof questionData.options === 'string') {
                            if (questionData.options.trim().startsWith('[')) {
                                optionsArray = JSON.parse(questionData.options);
                            } else {
                                optionsArray = questionData.options.split(',').map(s => s.trim()).filter(s => s);
                            }
                        } else if (Array.isArray(questionData.options)) {
                            optionsArray = questionData.options;
                        }
                    } catch (e) {
                        console.warn(`Failed to parse options for question ${question_id}`);
                    }
                }
                
                console.log(`Question ${question_id} options:`, optionsArray);
                
                // Check if correct_answer is an index (number) or the actual text
                const correctAnswerNum = parseInt(correct_answer);
                if (!isNaN(correctAnswerNum) && optionsArray.length > correctAnswerNum) {
                    // correct_answer is an index
                    const correctText = optionsArray[correctAnswerNum];
                    is_correct = correctText?.toString().trim().toLowerCase() === provided_answer?.toString().trim().toLowerCase();
                    console.log(`Comparing by index: correct="${correctText}" vs provided="${provided_answer}"`);
                } else {
                    // correct_answer is the actual text
                    let cleanCorrectAnswer = correct_answer?.toString().trim();
                    // Remove quotes if present
                    if (cleanCorrectAnswer?.startsWith('"') && cleanCorrectAnswer?.endsWith('"')) {
                        cleanCorrectAnswer = cleanCorrectAnswer.slice(1, -1);
                    }
                    is_correct = cleanCorrectAnswer?.toLowerCase() === provided_answer?.toString().trim().toLowerCase();
                    console.log(`Comparing by text: correct="${cleanCorrectAnswer}" vs provided="${provided_answer}"`);
                }
            } else {
                // For identification/short_answer, do direct text comparison
                let cleanCorrectAnswer = correct_answer?.toString().trim();
                if (cleanCorrectAnswer?.startsWith('"') && cleanCorrectAnswer?.endsWith('"')) {
                    cleanCorrectAnswer = cleanCorrectAnswer.slice(1, -1);
                }
                is_correct = cleanCorrectAnswer?.toLowerCase() === provided_answer?.toString().trim().toLowerCase();
            }

            const score = is_correct ? 1 : 0;
            totalScore += score;
            if (is_correct) correctAnswers++;

            console.log(`Question ${question_id} result: ${is_correct ? 'CORRECT' : 'INCORRECT'}`);
        }

        // Try to insert into assessment_results table, if it fails, try other approaches
        try {
            const insertResultSql = `
                INSERT INTO assessment_results (user_id, assessment_id, score, total_questions, submitted_at) 
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                    score = VALUES(score), 
                    total_questions = VALUES(total_questions), 
                    submitted_at = NOW()
            `;
            await req.db.promise().query(insertResultSql, [user_id, assessment_id, totalScore, questions.length]);
            console.log('Successfully inserted into assessment_results');
        } catch (tableError) {
            console.log('assessment_results table not found, trying user_progress with chapter_id');
            
            try {
                // Get the chapter_id for this assessment
                const [assessmentInfo] = await req.db.promise().query('SELECT chapter_id FROM assessments WHERE assessment_id = ?', [assessment_id]);
                const chapter_id = assessmentInfo[0]?.chapter_id;
                
                if (chapter_id) {
                    // First, let's check what columns exist in user_progress table
                    try {
                        const [columns] = await req.db.promise().query('DESCRIBE user_progress');
                        const columnNames = columns.map(col => col.Field);
                        console.log('user_progress table columns:', columnNames);
                        
                        // Build the SQL based on available columns
                        let insertSql = '';
                        let values = [];
                        let updateSql = '';
                        
                        // Based on your actual schema: progress_id, user_id, chapter_id, is_completed, completion_time
                        insertSql = `
                            INSERT INTO user_progress (user_id, chapter_id, is_completed, completion_time) 
                            VALUES (?, ?, 1, NOW())
                            ON DUPLICATE KEY UPDATE 
                                is_completed = 1, 
                                completion_time = NOW()
                        `;
                        values = [user_id, chapter_id];
                        
                        await req.db.promise().query(insertSql, values);
                        console.log('Successfully inserted into user_progress with chapter_id');
                        
                    } catch (describeError) {
                        console.log('Could not describe user_progress table, using known schema');
                        // Use the exact schema from your database
                        const basicSql = `
                            INSERT INTO user_progress (user_id, chapter_id, is_completed, completion_time) 
                            VALUES (?, ?, 1, NOW())
                            ON DUPLICATE KEY UPDATE is_completed = 1, completion_time = NOW()
                        `;
                        await req.db.promise().query(basicSql, [user_id, chapter_id]);
                        console.log('Successfully inserted progress record with known schema');
                    }
                } else {
                    console.log('No chapter_id found for assessment');
                    
                    // Try to create a custom assessment results table entry
                    try {
                        const createTableSql = `
                            CREATE TABLE IF NOT EXISTS assessment_submissions (
                                id INT AUTO_INCREMENT PRIMARY KEY,
                                user_id INT NOT NULL,
                                assessment_id INT NOT NULL,
                                score INT NOT NULL,
                                total_questions INT NOT NULL,
                                percentage DECIMAL(5,2) NOT NULL,
                                submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                UNIQUE KEY unique_submission (user_id, assessment_id)
                            )
                        `;
                        await req.db.promise().query(createTableSql);
                        
                        const percentage = Math.round((correctAnswers / questions.length) * 100);
                        const insertSubmissionSql = `
                            INSERT INTO assessment_submissions (user_id, assessment_id, score, total_questions, percentage) 
                            VALUES (?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE 
                                score = VALUES(score), 
                                total_questions = VALUES(total_questions), 
                                percentage = VALUES(percentage),
                                submitted_at = CURRENT_TIMESTAMP
                        `;
                        await req.db.promise().query(insertSubmissionSql, [user_id, assessment_id, totalScore, questions.length, percentage]);
                        console.log('Successfully created and inserted into assessment_submissions table');
                    } catch (createError) {
                        console.log('Could not create assessment_submissions table:', createError.message);
                        console.log('Assessment completed but not saved to database due to schema limitations');
                    }
                }
            } catch (progressError) {
                console.log('Failed to insert into user_progress:', progressError.message);
                console.log('Assessment completed but not saved to database');
            }
        }

        const percentage = Math.round((correctAnswers / questions.length) * 100);

        res.json({
            success: true,
            message: 'Assessment submitted successfully!',
            totalScore: totalScore,
            correctAnswers: correctAnswers,
            totalQuestions: questions.length,
            percentage: percentage
        });

    } catch (err) {
        console.error('Failed to submit assessment:', err);
        console.error('Error details:', err.message);
        res.status(500).json({ 
            error: 'Failed to submit assessment', 
            details: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

export default router;
