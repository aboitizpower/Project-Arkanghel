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

// Security middleware - Helmet with enhanced CSP configuration
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'"], // Remove unsafe-inline and unsafe-eval for API endpoints
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https:", "wss:", "ws:"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        },
        reportOnly: false
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "same-origin" } // More restrictive
}));

// Additional explicit CSP header for any missed routes
app.use((req, res, next) => {
    if (!res.getHeader('Content-Security-Policy')) {
        res.setHeader('Content-Security-Policy', 
            "default-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
            "font-src 'self' https://fonts.gstatic.com; " +
            "script-src 'self'; " +
            "img-src 'self' data: https: blob:; " +
            "connect-src 'self' https: wss: ws:; " +
            "media-src 'self'; " +
            "object-src 'none'; " +
            "frame-src 'none'; " +
            "base-uri 'self'; " +
            "form-action 'self'"
        );
    }
    next();
});

// Apply CORS middleware after security middleware
app.use(corsMiddleware);
app.use(preflightMiddleware);

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
app.use('/', aUsersRoutes)          // A_Users.jsx
app.use('/', aModulesRoutes)        // A_Modules.jsx
app.use('/', workstreamCreateRoutes) // WorkstreamCreate.jsx
app.use('/', chapterCreateRoutes)   // ChapterCreate.jsx
app.use('/', chapterEditRoutes)     // ChapterEdit.jsx
app.use('/', aAssessmentRoutes)     // A_Assessment.jsx
app.use('/', assessmentCreateRoutes) // AssessmentCreate.jsx
app.use('/', assessmentEditRoutes)  // AssessmentEdit.jsx
app.use('/', aAnalyticsRoutes)     // A_Analytics.jsx
app.use('/', aLeaderboardRoutes)   // A_Leaderboard.jsx
app.use('/', aFeedbackRoutes);

app.use('/', eModulesRoutes)        // E_Modules.jsx
app.use('/', viewModulesRoutes)     // ViewModules.jsx
app.use('/', takeAssessmentsRoutes) // TakeAssessments.jsx
app.use('/', eAssessmentsRoutes)    // E_Assessments.jsx
app.use('/employee', eDashboardRoutes)  // E_Dashboard.jsx
app.use('/', eLeaderboardRoutes)    // E_Leaderboard.jsx
app.use('/employee', eTasksRoutes)  // TaskSidebar.jsx
app.use('/employee/certificates', certificatesRoutes)  // Certificate generation
app.use('/employee', eFeedbackRoutes);

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
