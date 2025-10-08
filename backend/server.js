import express from 'express';
import mysql from 'mysql2';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import helmet from 'helmet';

// Convert CORS middleware to use CommonJS require
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const corsModule = await import('./middleware/cors.js');
const { corsMiddleware, preflightMiddleware } = corsModule;

// Import authentication middleware
import { authenticateToken, requireAdmin, requireEmployee } from './middleware/auth.js';

// Import modular route files
import authRoutes from './routes/auth/authRoutes.js';
import aUsersRoutes from './routes/admin/A_Users.js';
import aModulesRoutes from './routes/admin/A_Modules.js';
import workstreamCreateRoutes from './routes/admin/WorkstreamCreate.js';
import workstreamEditRoutes from './routes/admin/WorkstreamEdit.js';
import chapterCreateRoutes from './routes/admin/ChapterCreate.js';
import chapterEditRoutes from './routes/admin/ChapterEdit.js';
import aAssessmentRoutes from './routes/admin/A_Assessment.js';
import assessmentCreateRoutes from './routes/admin/AssessmentCreate.js';
import assessmentEditRoutes from './routes/admin/AssessmentEdit.js';
import aAnalyticsRoutes from './routes/admin/A_Analytics.js';
import aLeaderboardRoutes from './routes/admin/A_Leaderboard.js';
import aFeedbackRoutes from './routes/admin/A_Feedback.js';

import eModulesRoutes from './routes/employee/E_Modules.js';
import viewModulesRoutes from './routes/employee/ViewModules.js';
import takeAssessmentsRoutes from './routes/employee/TakeAssessments.js';
import eAssessmentsRoutes from './routes/employee/E_Assessments.js';
import eDashboardRoutes from './routes/employee/E_Dashboard.js';
import eLeaderboardRoutes from './routes/employee/E_Leaderboard.js';
import eTasksRoutes from './routes/employee/E_Tasks.js';
import certificatesRoutes from './routes/employee/Certificates.js';
import eFeedbackRoutes from './routes/employee/E_Feedback.js';

// Import notification services with error handling
let notificationRoutes, notificationService;
try {
    notificationRoutes = (await import('./routes/notifications.js')).default;
    notificationService = (await import('./services/notificationService.js')).default;
    console.log('✅ Notification modules loaded successfully');
} catch (error) {
    console.error('❌ Failed to load notification modules:', error.message);
    console.log('🔄 Server will continue without notifications');
}

const app = express();

// Security middleware - Minimal Helmet configuration for development
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for development
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false, // Disable for development
    crossOriginOpenerPolicy: false
}));

// CSP disabled for development - uncomment for production
// app.use((req, res, next) => {
//     if (!res.getHeader('Content-Security-Policy')) {
//         res.setHeader('Content-Security-Policy', 
//             "default-src 'self'; " +
//             "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
//             "font-src 'self' https://fonts.gstatic.com; " +
//             "script-src 'self'; " +
//             "img-src 'self' data: https: http://localhost:8081 blob:; " +
//             "connect-src 'self' https: wss: ws:; " +
//             "media-src 'self'; " +
//             "object-src 'none'; " +
//             "frame-src 'none'; " +
//             "base-uri 'self'; " +
//             "form-action 'self'"
//         );
//     }
//     next();
// });

// Apply CORS middleware after security middleware
app.use(corsMiddleware);
app.use(preflightMiddleware);

// Additional CORS headers for image requests
app.use('/workstreams/:id/image', (req, res, next) => {
    console.log(`🔧 Setting CORS headers for image request: ${req.url}`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
});

// Additional security headers to prevent cross-domain issues
app.use((req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Enable XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Prevent embedding in frames from other domains
    res.setHeader('Content-Security-Policy', 'frame-ancestors \'none\'');
    // Additional cross-origin policies
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Strict transport security (if using HTTPS)
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    next();
});

// Other middleware
app.use(express.json());

// Database connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "password",
    database: "arkanghel_db"
})

// Middleware to attach database connection to request object
app.use((req, res, next) => {
    req.db = db
    next()
})

// Route registration - Each route file corresponds to frontend pages/components
app.use('/', authRoutes);

// Public image routes (no authentication required for images)
app.get('/workstreams/:id/image', (req, res) => {
    const { id } = req.params;
    console.log(`🖼️ Image request for workstream ID: ${id}`);
    
    // Check if database connection exists
    if (!req.db) {
        console.error(`❌ No database connection available`);
        return res.status(500).json({ error: 'Database connection not available' });
    }
    
    const sql = 'SELECT image, image_type FROM workstreams WHERE workstream_id = ?';
    console.log(`📝 Executing SQL: ${sql} with ID: ${id}`);
    
    req.db.query(sql, [id], (err, results) => {
        if (err) {
            console.error(`❌ Database error for workstream ${id}:`, err.message);
            return res.status(500).json({ error: err.message });
        }
        
        console.log(`📊 Query results for workstream ${id}:`, {
            resultCount: results.length,
            hasImage: results.length > 0 && !!results[0].image,
            imageType: results.length > 0 ? results[0].image_type : null,
            imageSize: results.length > 0 && results[0].image ? results[0].image.length : 0
        });
        
        if (results.length === 0) {
            console.log(`❌ No workstream found with ID: ${id}`);
            return res.status(404).json({ error: 'Workstream not found.' });
        }
        
        if (!results[0].image) {
            console.log(`❌ No image data for workstream ID: ${id}`);
            return res.status(404).json({ error: 'Image not found.' });
        }
        
        const { image, image_type } = results[0];
        console.log(`✅ Serving image for workstream ${id}, type: ${image_type}, size: ${image.length} bytes`);
        
        // Set CORS headers for image requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        res.setHeader('Content-Type', image_type);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.send(image);
    });
});

// Admin routes (require authentication and admin privileges)
app.use('/', authenticateToken, requireAdmin, aUsersRoutes)          // A_Users.jsx
app.use('/', authenticateToken, requireAdmin, aModulesRoutes)        // A_Modules.jsx
app.use('/', authenticateToken, requireAdmin, workstreamCreateRoutes) // WorkstreamCreate.jsx
app.use('/', authenticateToken, requireAdmin, chapterCreateRoutes)   // ChapterCreate.jsx
app.use('/', authenticateToken, requireAdmin, chapterEditRoutes)     // ChapterEdit.jsx
app.use('/', authenticateToken, requireAdmin, aAssessmentRoutes)     // A_Assessment.jsx
app.use('/', authenticateToken, requireAdmin, assessmentCreateRoutes) // AssessmentCreate.jsx
app.use('/', authenticateToken, requireAdmin, assessmentEditRoutes)  // AssessmentEdit.jsx
app.use('/', authenticateToken, requireAdmin, aAnalyticsRoutes)     // A_Analytics.jsx
app.use('/', authenticateToken, requireAdmin, aLeaderboardRoutes)   // A_Leaderboard.jsx
app.use('/', authenticateToken, requireAdmin, aFeedbackRoutes);

// Employee routes (require authentication)
app.use('/', authenticateToken, eModulesRoutes)        // E_Modules.jsx
app.use('/', authenticateToken, viewModulesRoutes)     // ViewModules.jsx
app.use('/', authenticateToken, takeAssessmentsRoutes) // TakeAssessments.jsx
app.use('/', authenticateToken, eAssessmentsRoutes)    // E_Assessments.jsx
app.use('/employee', authenticateToken, eDashboardRoutes)  // E_Dashboard.jsx
app.use('/', authenticateToken, eLeaderboardRoutes)    // E_Leaderboard.jsx
app.use('/employee', authenticateToken, eTasksRoutes)  // TaskSidebar.jsx
app.use('/employee/certificates', authenticateToken, certificatesRoutes)  // Certificate generation
app.use('/employee', authenticateToken, eFeedbackRoutes);

// Notification routes (only if loaded successfully)
if (notificationRoutes) {
    app.use('/api/notifications', notificationRoutes);
    console.log('✅ Notification routes registered');
}

// Initialize notification service (only if loaded successfully)
if (notificationService) {
    console.log('🔔 Starting notification service initialization...');
    notificationService.initialize()
        .then(() => {
            console.log('✅ Notification service initialized successfully');
        })
        .catch(err => {
            console.error('❌ Failed to initialize notification service:', err);
        });
} else {
    console.log('⚠️ Notification service not available');
}


// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    if (notificationService) {
        notificationService.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Shutting down gracefully...');
    if (notificationService) {
        notificationService.stop();
    }
    process.exit(0);
});

// Start server
const PORT = process.env.PORT || 8081
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
