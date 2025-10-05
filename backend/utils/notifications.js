import { notifyAllActiveUsers } from '../services/emailService.js';

export const sendWorkstreamNotification = async (workstreamData) => {
    return await notifyAllActiveUsers('workstream', {
        id: workstreamData.id,
        title: workstreamData.title,
        description: workstreamData.description,
        deadline: workstreamData.deadline
    });
};

export const sendChapterNotification = async (chapterData, workstreamTitle) => {
    return await notifyAllActiveUsers('chapter', {
        id: chapterData.id,
        title: chapterData.title,
        description: chapterData.description,
        workstreamTitle,
        deadline: chapterData.deadline
    });
};

export const sendAssessmentNotification = async (assessmentData, parentTitle, parentType) => {
    return await notifyAllActiveUsers('assessment', {
        id: assessmentData.id,
        title: assessmentData.title,
        parentTitle,
        parentType,
        deadline: assessmentData.deadline
    });
};

export const sendCompletionNotification = async (workstreamData, userId) => {
    // Get user details
    const [users] = await pool.execute(
        'SELECT email, CONCAT(first_name, " ", last_name) as name FROM users WHERE id = ?',
        [userId]
    );
    
    if (users.length === 0) {
        throw new Error('User not found');
    }
    
    const user = users[0];
    
    // Send completion email to the specific user
    return await sendEmail('completion', {
        id: workstreamData.id,
        title: workstreamData.title,
        recipientName: user.name
    }, user.email, user.name);
};
