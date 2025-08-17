import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WorkstreamProvider } from './context/WorkstreamContext';
import React, { createContext, useContext, useState, useEffect } from 'react';

import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

import E_Dashboard from './pages/employee/E_Dashboard';
import E_Modules from './pages/employee/E_Modules';
import ViewModules from './pages/employee/ViewModules';
import TakeAssessments from './pages/employee/TakeAssessment';
import E_Leaderboard from './pages/employee/E_Leaderboard';
import E_Assessments from './pages/employee/E_AssessmentResults';

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

// Auth context for user state
export const AuthContext = createContext();

function AuthProvider({ children }) {
    const [user, setUserState] = useState(null);
    const [loading, setLoading] = useState(true);
    // On mount, initialize user from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('user');
            if (stored) setUserState(JSON.parse(stored));
        } catch {}
        setLoading(false);
    }, []);
    // When setUser is called, update both state and localStorage
    const setUser = (userObj) => {
        setUserState(userObj);
        if (userObj) {
            localStorage.setItem('user', JSON.stringify(userObj));
        } else {
            localStorage.removeItem('user');
        }
    };
    if (loading) return null; // or a spinner if you want
    return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>;
}

function useAuth() {
    const ctx = useContext(AuthContext);
    return ctx ? ctx.user : null;
}

// Route guard for admin (must be outside App to use hooks)
function RequireAdmin({ children }) {
    const user = useAuth();
    const location = useLocation();
    if (!user) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }
    // Only block if user is not admin
    if (!user.isAdmin) {
        return <Navigate to="/employee/dashboard" state={{ from: location }} replace />;
    }
    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <WorkstreamProvider>
                <Router>
                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Employee Routes */}
                    <Route path="/employee/dashboard" element={<E_Dashboard />} />
                    <Route path="/employee/modules" element={<E_Modules />} />
                    <Route path="/employee/modules/:moduleId" element={<ViewModules />} />
                    <Route path="/employee/assessment/:assessmentId" element={<TakeAssessments />} />
                    <Route path="/employee/assessments" element={<E_Assessments />} />
                    <Route path="/employee/leaderboard" element={<E_Leaderboard />} />

                    {/* Admin Routes - protected */}
                    <Route path="/admin/analytics" element={<RequireAdmin><A_Analytics /></RequireAdmin>} />
                    <Route path="/admin/modules" element={<RequireAdmin><A_Modules /></RequireAdmin>} />
                    <Route path="/admin/assessment" element={<RequireAdmin><A_Assessment /></RequireAdmin>} />
                    <Route path="/admin/users" element={<RequireAdmin><A_Users /></RequireAdmin>} />
                    <Route path="/admin/leaderboard" element={<RequireAdmin><A_Leaderboard /></RequireAdmin>} />

                    {/* Admin Workstream/Chapter/Assessment CRUD Routes - protected */}
                    <Route path="/admin/workstream/create" element={<RequireAdmin><WorkstreamCreate /></RequireAdmin>} />
                    <Route path="/admin/workstream/:workstreamId/edit" element={<RequireAdmin><WorkstreamEdit /></RequireAdmin>} />
                    <Route path="/admin/workstream/:workstreamId/chapter/create" element={<RequireAdmin><ChapterCreate /></RequireAdmin>} />
                    <Route path="/admin/workstream/:workstreamId/chapter/:chapterId/edit" element={<RequireAdmin><ChapterEdit /></RequireAdmin>} />
                    <Route path="/admin/workstream/:workstreamId/assessment/create" element={<RequireAdmin><AssessmentCreate /></RequireAdmin>} />
                    <Route path="/admin/assessment/:assessmentId/edit" element={<RequireAdmin><AssessmentEdit /></RequireAdmin>} />

                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Router>
        </WorkstreamProvider>
        </AuthProvider>
    );
}
