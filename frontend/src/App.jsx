import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import React, { Suspense } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider.jsx';
import AuthWrapper from './components/auth/AuthWrapper';
import './components/auth/AuthButton.css'; // Import the CSS for transitions

import Login from './pages/Login';
import NotFound from './pages/NotFound';

import E_Dashboard from './pages/employee/E_Dashboard';
import E_Modules from './pages/employee/E_Modules';
import ViewModules from './pages/employee/ViewModules';
import TakeAssessments from './pages/employee/TakeAssessment';
import E_Leaderboard from './pages/employee/E_Leaderboard';
import E_Assessments from './pages/employee/E_Assessment';

import A_Analytics from './pages/admin/A_Analytics';
import A_Modules from './pages/admin/A_Modules';
import A_Assessment from './pages/admin/A_Assessment';
import A_Users from './pages/admin/A_Users';
import A_Leaderboard from './pages/admin/A_Leaderboard';

import WorkstreamCreate from './pages/admin/WorkstreamCreate';
import WorkstreamEdit from './pages/admin/WorkstreamEdit';
import ChapterCreate from './pages/admin/ChapterCreate';
import ChapterEdit from './pages/admin/ChapterEdit';
import AssessmentCreate from './pages/admin/AssessmentCreate';
import AssessmentEdit from './pages/admin/AssessmentEdit';



// Route guard for admin (must be outside App to use hooks)
// This component protects routes that require authentication.
function ProtectedRoute({ children, adminOnly = false }) {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        // User not logged in, redirect to login page
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    if (adminOnly && !user.isAdmin) {
        // User is not an admin, redirect to employee dashboard
        return <Navigate to="/employee/dashboard" replace />;
    }

    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <Suspense fallback={<div className="page-transition">Loading...</div>}>
                    <Routes>
                        <Route path="/" element={
                            <AuthWrapper>
                                <Login />
                            </AuthWrapper>
                        } />

                        {/* Protected Employee Routes */}
                        <Route path="/employee/dashboard" element={
                            <ProtectedRoute>
                                <AuthWrapper>
                                    <E_Dashboard />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/employee/modules" element={
                            <ProtectedRoute>
                                <AuthWrapper>
                                    <E_Modules />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/employee/modules/:moduleId" element={
                            <ProtectedRoute>
                                <AuthWrapper>
                                    <ViewModules />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/employee/assessment/:assessmentId" element={
                            <ProtectedRoute>
                                <AuthWrapper>
                                    <TakeAssessments />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/employee/assessments" element={
                            <ProtectedRoute>
                                <AuthWrapper>
                                    <E_Assessments />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/employee/leaderboard" element={
                            <ProtectedRoute>
                                <AuthWrapper>
                                    <E_Leaderboard />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />

                        {/* Protected Admin Routes */}
                        <Route path="/admin/analytics" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <A_Analytics />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/modules" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <A_Modules />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/assessment" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <A_Assessment />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/users" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <A_Users />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/leaderboard" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <A_Leaderboard />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/workstream/create" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <WorkstreamCreate />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/workstream/:workstreamId/edit" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <WorkstreamEdit />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/workstream/:workstreamId/chapter/create" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <ChapterCreate />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/workstream/:workstreamId/chapter/:chapterId/edit" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <ChapterEdit />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/workstream/:workstreamId/assessment/create" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <AssessmentCreate />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                        <Route path="/admin/assessment/:assessmentId/edit" element={
                            <ProtectedRoute adminOnly>
                                <AuthWrapper>
                                    <AssessmentEdit />
                                </AuthWrapper>
                            </ProtectedRoute>
                        } />
                    <Route path="/admin/workstream/:workstreamId/chapter/:chapterId/edit" element={<ProtectedRoute adminOnly={true}><ChapterEdit /></ProtectedRoute>} />
                    <Route path="/admin/workstream/:workstreamId/assessment/create" element={<ProtectedRoute adminOnly={true}><AssessmentCreate /></ProtectedRoute>} />
                    <Route path="/admin/assessment/:assessmentId/edit" element={<ProtectedRoute adminOnly={true}><AssessmentEdit /></ProtectedRoute>} />

                        <Route path="*" element={
                            <AuthWrapper>
                                <NotFound />
                            </AuthWrapper>
                        } />
                    </Routes>
                </Suspense>
            </Router>
        </AuthProvider>
    );
}
