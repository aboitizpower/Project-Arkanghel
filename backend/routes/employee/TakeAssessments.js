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
            q.points,
            a.answer_id,
            a.answer_text,
            a.is_correct
        FROM questions q
        LEFT JOIN answers a ON q.question_id = a.question_id
        WHERE q.assessment_id = ?
        ORDER BY q.question_id, a.answer_id
    `;
    
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Group answers by question
        const questionsMap = {};
        results.forEach(row => {
            if (!questionsMap[row.question_id]) {
                questionsMap[row.question_id] = {
                    question_id: row.question_id,
                    assessment_id: row.assessment_id,
                    question_text: row.question_text,
                    question_type: row.question_type,
                    points: row.points,
                    answers: []
                };
            }
            
            if (row.answer_id) {
                questionsMap[row.question_id].answers.push({
                    answer_id: row.answer_id,
                    answer_text: row.answer_text,
                    is_correct: row.is_correct
                });
            }
        });
        
        const questions = Object.values(questionsMap);
        res.json(questions);
    });
});

// Submit assessment answers - Used by TakeAssessments.jsx (TakeAssessment.jsx)
router.post('/assessments/:id/submit', (req, res) => {
    const { id } = req.params;
    const { user_id, answers } = req.body;
    
    if (!user_id || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'user_id and answers array are required.' });
    }
    
    // First, get all questions and their correct answers for this assessment
    const questionsSql = `
        SELECT 
            q.question_id,
            q.points,
            a.answer_id,
            a.is_correct
        FROM questions q
        LEFT JOIN answers a ON q.question_id = a.question_id
        WHERE q.assessment_id = ?
    `;
    
    req.db.query(questionsSql, [id], (err, questionResults) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        // Calculate score
        let totalScore = 0;
        let totalQuestions = 0;
        const questionsMap = {};
        
        // Group by question
        questionResults.forEach(row => {
            if (!questionsMap[row.question_id]) {
                questionsMap[row.question_id] = {
                    points: row.points,
                    correctAnswers: []
                };
                totalQuestions++;
            }
            if (row.is_correct) {
                questionsMap[row.question_id].correctAnswers.push(row.answer_id);
            }
        });
        
        // Check user answers against correct answers
        answers.forEach(userAnswer => {
            const question = questionsMap[userAnswer.question_id];
            if (question) {
                const userAnswerIds = Array.isArray(userAnswer.selected_answers) 
                    ? userAnswer.selected_answers 
                    : [userAnswer.selected_answers];
                
                // Check if user's answers match correct answers exactly
                const correctAnswerIds = question.correctAnswers.sort();
                const userSortedAnswers = userAnswerIds.sort();
                
                if (JSON.stringify(correctAnswerIds) === JSON.stringify(userSortedAnswers)) {
                    totalScore += question.points;
                }
            }
        });
        
        // Save assessment result
        const resultSql = `
            INSERT INTO assessment_results (user_id, assessment_id, score, total_questions, completed_at)
            VALUES (?, ?, ?, ?, NOW())
        `;
        
        req.db.query(resultSql, [user_id, id, totalScore, totalQuestions], (err, result) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            res.json({
                success: 'Assessment submitted successfully!',
                result_id: result.insertId,
                score: totalScore,
                total_questions: totalQuestions
            });
        });
    });
});

export default router;
