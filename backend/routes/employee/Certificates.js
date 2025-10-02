import express from 'express';
import { generateCertificate, checkWorkstreamCompletion } from '../../utils/certificateGenerator.js';

const router = express.Router();

/**
 * Generate and download certificate for completed workstream
 * GET /employee/certificates/:workstreamId
 */
router.get('/:workstreamId', async (req, res) => {
    try {
        const { workstreamId } = req.params;
        const userId = req.query.userId;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }

        if (!workstreamId) {
            return res.status(400).json({
                success: false,
                error: 'Workstream ID is required'
            });
        }

        console.log(`Certificate request for user ${userId}, workstream ${workstreamId}`);

        // Check if user has completed the workstream
        const completionStatus = await checkWorkstreamCompletion(req.db, parseInt(userId), parseInt(workstreamId));

        if (completionStatus.error) {
            return res.status(400).json({
                success: false,
                error: completionStatus.error
            });
        }

        if (!completionStatus.isCompleted) {
            return res.status(400).json({
                success: false,
                error: 'Workstream not completed. Certificate can only be generated for 100% completed workstreams.',
                progress: completionStatus.progress
            });
        }

        console.log('Workstream completion verified, generating certificate...');

        // Generate certificate
        const certificateData = {
            userName: completionStatus.userName,
            workstreamTitle: completionStatus.workstreamTitle,
            completionDate: completionStatus.completionDate,
            userEmail: completionStatus.userEmail
        };

        const pdfBuffer = await generateCertificate(certificateData);

        // Set response headers for PDF download
        const filename = `Certificate_${completionStatus.workstreamTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${completionStatus.userName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);

        console.log(`Certificate generated successfully: ${filename}`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Error generating certificate:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate certificate. Please try again later.'
        });
    }
});

/**
 * Check if user can download certificate (workstream completion status)
 * GET /employee/certificates/:workstreamId/status
 */
router.get('/:workstreamId/status', async (req, res) => {
    try {
        const { workstreamId } = req.params;
        const userId = req.query.userId;

        if (!userId || !workstreamId) {
            return res.status(400).json({
                success: false,
                error: 'User ID and Workstream ID are required'
            });
        }

        const completionStatus = await checkWorkstreamCompletion(req.db, parseInt(userId), parseInt(workstreamId));

        res.json({
            success: true,
            canDownloadCertificate: completionStatus.isCompleted,
            progress: completionStatus.progress,
            workstreamTitle: completionStatus.workstreamTitle,
            error: completionStatus.error
        });

    } catch (error) {
        console.error('Error checking certificate status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check certificate status'
        });
    }
});

export default router;
