import express from 'express';

const router = express.Router();

// Get user tasks, todos, and upcoming assignments
router.get('/tasks/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Get upcoming assessments with deadlines
        const upcomingAssessmentsSql = `
            SELECT 
                a.assessment_id,
                a.title,
                a.deadline,
                a.description,
                mc.title as chapter_title,
                w.title as workstream_title,
                CASE 
                    WHEN EXISTS (
                        SELECT 1 FROM answers ans 
                        JOIN questions q ON ans.question_id = q.question_id 
                        WHERE q.assessment_id = a.assessment_id AND ans.user_id = ?
                    ) THEN 1 
                    ELSE 0 
                END as is_completed
            FROM assessments a
            LEFT JOIN module_chapters mc ON a.chapter_id = mc.chapter_id
            LEFT JOIN workstreams w ON mc.workstream_id = w.workstream_id
            WHERE a.deadline IS NOT NULL 
            AND a.deadline > NOW()
            AND NOT EXISTS (
                SELECT 1 FROM answers ans 
                JOIN questions q ON ans.question_id = q.question_id 
                WHERE q.assessment_id = a.assessment_id AND ans.user_id = ?
                GROUP BY q.assessment_id
                HAVING COUNT(DISTINCT q.question_id) = COUNT(DISTINCT ans.question_id)
                AND AVG(ans.score) = 1
            )
            ORDER BY a.deadline ASC
            LIMIT 10
        `;
        
        const [upcomingAssessments] = await req.db.promise().query(upcomingAssessmentsSql, [userId, userId]);
        
        // Get recent assessment results for feedback
        const recentFeedbackSql = `
            SELECT 
                a.assessment_id,
                a.title,
                AVG(ans.score) as avg_score,
                COUNT(DISTINCT q.question_id) as total_questions,
                COUNT(DISTINCT ans.question_id) as answered_questions,
                MAX(ans.answered_at) as completed_at
            FROM assessments a
            JOIN questions q ON a.assessment_id = q.assessment_id
            LEFT JOIN answers ans ON q.question_id = ans.question_id AND ans.user_id = ?
            WHERE ans.user_id IS NOT NULL
            GROUP BY a.assessment_id, a.title
            HAVING COUNT(DISTINCT ans.question_id) = COUNT(DISTINCT q.question_id)
            ORDER BY MAX(ans.answered_at) DESC
            LIMIT 5
        `;
        
        const [recentFeedback] = await req.db.promise().query(recentFeedbackSql, [userId]);
        
        // Format the data for frontend
        const todos = upcomingAssessments
            .filter(assessment => {
                const deadline = new Date(assessment.deadline);
                const now = new Date();
                const timeDiff = deadline.getTime() - now.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                return hoursDiff <= 24 && hoursDiff > 0; // Due within 24 hours
            })
            .map(assessment => ({
                id: assessment.assessment_id,
                title: assessment.title,
                dueDate: assessment.deadline,
                completed: assessment.is_completed === 1,
                type: 'assessment',
                workstream: assessment.workstream_title,
                chapter: assessment.chapter_title
            }));
        
        const upcomingTasks = upcomingAssessments
            .filter(assessment => {
                const deadline = new Date(assessment.deadline);
                const now = new Date();
                const timeDiff = deadline.getTime() - now.getTime();
                const hoursDiff = timeDiff / (1000 * 60 * 60);
                return hoursDiff > 24; // Due after 24 hours
            })
            .map(assessment => ({
                id: assessment.assessment_id,
                title: assessment.title,
                dueDate: assessment.deadline,
                type: 'assessment',
                workstream: assessment.workstream_title,
                chapter: assessment.chapter_title
            }));
        
        const formattedFeedback = recentFeedback.map(feedback => {
            const percentage = Math.round((feedback.avg_score || 0) * 100);
            const isPassed = percentage >= 75;
            
            return {
                id: feedback.assessment_id,
                title: feedback.title,
                score: `${Math.round(feedback.avg_score * feedback.total_questions)} out of ${feedback.total_questions}`,
                status: isPassed ? 'Complete' : 'Incomplete',
                percentage: percentage,
                type: 'feedback',
                completedAt: feedback.completed_at
            };
        });
        
        res.json({
            todos: todos,
            upcomingTasks: upcomingTasks,
            recentFeedback: formattedFeedback
        });
        
    } catch (error) {
        console.error('Error fetching user tasks:', error);
        res.status(500).json({ error: 'Failed to fetch user tasks', details: error.message });
    }
});

// Mark a task as completed
router.put('/tasks/:taskId/complete', async (req, res) => {
    const { taskId } = req.params;
    const userId = req.body.userId || req.query.userId;
    
    try {
        // For now, we'll just return success since task completion 
        // is handled through the assessment submission process
        res.json({ success: true, message: 'Task marked as completed' });
    } catch (error) {
        console.error('Error marking task complete:', error);
        res.status(500).json({ error: 'Failed to mark task complete', details: error.message });
    }
});

// Get user progress summary for dashboard KPIs
router.get('/progress/:userId', async (req, res) => {
    const { userId } = req.params;
    
    try {
        // Get workstream progress
        const progressSql = `
            SELECT 
                w.workstream_id,
                w.title,
                COALESCE(wp.progress_percent, 0) as progress,
                COALESCE(wp.completed, 0) as completed
            FROM workstreams w
            LEFT JOIN workstream_progress wp ON w.workstream_id = wp.workstream_id AND wp.user_id = ?
            WHERE w.is_published = 1
            ORDER BY w.created_at DESC
        `;
        
        const [workstreams] = await req.db.promise().query(progressSql, [userId]);
        
        // Calculate KPIs
        const inProgress = workstreams.filter(ws => ws.progress > 0 && ws.progress < 100).length;
        const completed = workstreams.filter(ws => ws.completed === 1).length;
        const notStarted = workstreams.filter(ws => ws.progress === 0).length;
        
        res.json({
            workstreams: workstreams,
            kpis: {
                inProgress: inProgress,
                completed: completed,
                notStarted: notStarted,
                total: workstreams.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching user progress:', error);
        res.status(500).json({ error: 'Failed to fetch user progress', details: error.message });
    }
});

export default router;
