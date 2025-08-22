import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'

// Import modular route files
import loginRoutes from './routes/auth/Login.js'
import registerRoutes from './routes/auth/Register.js'
import aUsersRoutes from './routes/admin/A_Users.js'
import aModulesRoutes from './routes/admin/A_Modules.js'
import aWorkstreamsRoutes from './routes/admin/A_Workstreams.js'
import workstreamCreateRoutes from './routes/admin/WorkstreamCreate.js'
import workstreamEditRoutes from './routes/admin/WorkstreamEdit.js'
import chapterCreateRoutes from './routes/admin/ChapterCreate.js'
import chapterEditRoutes from './routes/admin/ChapterEdit.js'
import aAssessmentRoutes from './routes/admin/A_Assessment.js'
import assessmentCreateRoutes from './routes/admin/AssessmentCreate.js'
import assessmentEditRoutes from './routes/admin/AssessmentEdit.js'
import aAnalyticsRoutes from './routes/admin/A_Analytics.js'
import aLeaderboardRoutes from './routes/admin/A_Leaderboard.js'

import eModulesRoutes from './routes/employee/E_Modules.js'
import viewModulesRoutes from './routes/employee/ViewModules.js'
import takeAssessmentsRoutes from './routes/employee/TakeAssessments.js'
import eAssessmentsRoutes from './routes/employee/E_Assessments.js'
import eDashboardRoutes from './routes/employee/E_Dashboard.js'
import eLeaderboardRoutes from './routes/employee/E_Leaderboard.js'

const app = express()

// Middleware
app.use(express.json())
app.use(cors())

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
app.use('/', loginRoutes)           // Login.jsx
app.use('/', registerRoutes)        // Register.jsx
app.use('/', aUsersRoutes)          // A_Users.jsx
app.use('/', aModulesRoutes)        // A_Modules.jsx
app.use('/', aWorkstreamsRoutes)    // A_Workstreams.jsx
app.use('/', workstreamCreateRoutes) // WorkstreamCreate.jsx
app.use('/', workstreamEditRoutes)  // WorkstreamEdit.jsx
app.use('/', chapterCreateRoutes)   // ChapterCreate.jsx
app.use('/', chapterEditRoutes)     // ChapterEdit.jsx
app.use('/', aAssessmentRoutes)     // A_Assessment.jsx
app.use('/', assessmentCreateRoutes) // AssessmentCreate.jsx
app.use('/', assessmentEditRoutes)  // AssessmentEdit.jsx
app.use('/', aAnalyticsRoutes)      // A_Analytics.jsx
app.use('/', aLeaderboardRoutes)    // A_Leaderboard.jsx

app.use('/', eModulesRoutes)        // E_Modules.jsx
app.use('/', viewModulesRoutes)     // ViewModules.jsx
app.use('/', takeAssessmentsRoutes) // TakeAssessments.jsx
app.use('/', eAssessmentsRoutes)    // E_Assessments.jsx
app.use('/employee', eDashboardRoutes)      // E_Dashboard.jsx
app.use('/', eLeaderboardRoutes)    // E_Leaderboard.jsx

// Start server
const PORT = process.env.PORT || 8081
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
