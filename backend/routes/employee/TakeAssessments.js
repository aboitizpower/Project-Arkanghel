import express from 'express';
import notificationService from '../../services/notificationService.js';

const router = express.Router();

// Get assessment details - Used by TakeAssessment.jsx (employee access)
router.get('/assessments/:id', (req, res) => {
    const { id } = req.params;
    
    const assessmentSql = `
        SELECT 
            a.*,
            mc.title as chapter_title,
            w.title as workstream_title,
            w.deadline
        FROM assessments a
        JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
        JOIN workstreams w ON mc.workstream_id = w.workstream_id
        WHERE a.assessment_id = ?
    `;
    
    req.db.query(assessmentSql, [id], (err, assessmentResults) => {
        if (err) {
            console.error('Failed to fetch assessment details:', err);
            return res.status(500).json({ error: 'Database query failed while fetching assessment details.' });
        }
        if (assessmentResults.length === 0) {
            return res.status(404).json({ error: 'Assessment not found.' });
        }
        
        const assessment = assessmentResults[0];
        res.json(assessment);
    });
});

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

            // Handle True/False questions specially - they should always have True/False options
            if (row.question_type === 'true_false') {
                optionsArray = ['True', 'False'];
                answers = [
                    { answer_id: 1, answer_text: 'True' },
                    { answer_id: 2, answer_text: 'False' }
                ];
            } else if (row.options) {
                // Handle options parsing for other question types
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
        let answerScores = []; // Track individual answer scores

        console.log('Correct answers map:', correctAnswersMap);

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

            // Add to answerScores array
            answerScores.push({ question_id, score });

            console.log(`Question ${question_id} result: ${is_correct ? 'CORRECT' : 'INCORRECT'}`);
        }

        // Store individual answers in the answers table and mark chapter as complete
        try {
            // Get the chapter_id for this assessment
            const [assessmentInfo] = await req.db.promise().query('SELECT chapter_id FROM assessments WHERE assessment_id = ?', [assessment_id]);
            const chapter_id = assessmentInfo[0]?.chapter_id;
            
            if (chapter_id) {
                // Check if user already has a perfect score for this assessment
                const perfectScoreCheckSql = `
                    SELECT 
                        COUNT(q.question_id) as total_questions,
                        COALESCE(SUM(ans.score), 0) as total_score
                    FROM questions q
                    LEFT JOIN answers ans ON q.question_id = ans.question_id AND ans.user_id = ?
                    WHERE q.assessment_id = ?
                `;
                const [perfectScoreCheck] = await req.db.promise().query(perfectScoreCheckSql, [user_id, assessment_id]);
                const previousResult = perfectScoreCheck[0];
                const hadPerfectScore = previousResult && previousResult.total_questions > 0 && 
                                     previousResult.total_score === previousResult.total_questions;

                // If user already had a perfect score, don't allow retaking
                if (hadPerfectScore) {
                    return res.status(403).json({
                        error: 'Assessment already completed with perfect score. Retaking is not allowed.',
                        locked: true,
                        previous_score: 100
                    });
                }

                // Store individual answers in the answers table
                for (const answer of userAnswers) {
                    const { question_id, answer: user_answer } = answer;
                    const score = answerScores.find(a => a.question_id === question_id)?.score || 0;
                    
                    const insertAnswerSql = `
                        INSERT INTO answers (question_id, user_id, user_answer, score, answered_at) 
                        VALUES (?, ?, ?, ?, NOW())
                        ON DUPLICATE KEY UPDATE 
                            user_answer = VALUES(user_answer), 
                            score = VALUES(score), 
                            answered_at = NOW()
                    `;
                    await req.db.promise().query(insertAnswerSql, [question_id, user_id, user_answer, score]);
                }
                console.log('Successfully stored answers in answers table');
                
                // Mark chapter as complete in user_progress if assessment passed
                const passingScore = 75; // Default passing score
                const passed = (totalScore / questions.length) * 100 >= passingScore;
                
                // Always update progress if passed, regardless of previous attempts
                if (passed) {
                    const insertProgressSql = `
                        INSERT INTO user_progress (user_id, chapter_id, is_completed, completion_time) 
                        VALUES (?, ?, 1, NOW())
                        ON DUPLICATE KEY UPDATE 
                            is_completed = 1, 
                            completion_time = NOW()
                    `;
                    await req.db.promise().query(insertProgressSql, [user_id, chapter_id]);
                    console.log('Successfully marked chapter as complete in user_progress');
                    
                    // Check if this completes the entire workstream
                    await checkWorkstreamCompletion(user_id, chapter_id, req.db);
                } else {
                    // If failed, ensure progress is not marked as complete
                    const updateProgressSql = `
                        INSERT INTO user_progress (user_id, chapter_id, is_completed, completion_time) 
                        VALUES (?, ?, 0, NOW())
                        ON DUPLICATE KEY UPDATE 
                            is_completed = 0, 
                            completion_time = NOW()
                    `;
                    await req.db.promise().query(updateProgressSql, [user_id, chapter_id]);
                    console.log('Marked chapter as incomplete in user_progress due to failed assessment');
                }
            } else {
                console.log('No chapter_id found for assessment');
            }
        } catch (progressError) {
            console.log('Failed to store assessment results:', progressError.message);
            console.log('Assessment completed but not saved to database');
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

// Helper function to check if workstream is completed
async function checkWorkstreamCompletion(userId, chapterId, db) {
    try {
        // Get the workstream for this chapter
        const [workstreamResult] = await db.promise().query(
            'SELECT workstream_id FROM module_chapters WHERE chapter_id = ?',
            [chapterId]
        );
        
        if (workstreamResult.length === 0) return;
        
        const workstreamId = workstreamResult[0].workstream_id;
        
        // Check if all chapters in this workstream are completed by this user
        const [completionCheck] = await db.promise().query(`
            SELECT 
                COUNT(*) as total_chapters,
                SUM(CASE WHEN up.is_completed = 1 THEN 1 ELSE 0 END) as completed_chapters
            FROM module_chapters mc
            LEFT JOIN user_progress up ON mc.chapter_id = up.chapter_id AND up.user_id = ?
            WHERE mc.workstream_id = ? AND mc.is_published = 1
        `, [userId, workstreamId]);
        
        const { total_chapters, completed_chapters } = completionCheck[0];
        
        // If all chapters are completed, send completion notification
        if (total_chapters > 0 && completed_chapters === total_chapters) {
            console.log(`User ${userId} completed workstream ${workstreamId}`);
            await notificationService.notifyCompletion(userId, workstreamId);
        }
    } catch (error) {
        console.error('Error checking workstream completion:', error);
    }
}

export default router;
