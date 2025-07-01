import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';

import E_Dashboard from './pages/employee/E_Dashboard';
import E_Modules from './pages/employee/E_Modules';
import E_Assessment from './pages/employee/E_Assessment';
import E_Leaderboard from './pages/employee/E_Leaderboard';

import A_Analytics from './pages/admin/A_Analytics';
import A_Modules from './pages/admin/A_Modules';
import A_Assessment from './pages/admin/A_Assessment';
import A_Users from './pages/admin/A_Users';
import A_Leaderboard from './pages/admin/A_Leaderboard';

export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Employee Routes */}
                <Route path="/employee/dashboard" element={<E_Dashboard />} />
                <Route path="/employee/modules" element={<E_Modules />} />
                <Route path="/employee/assessment" element={<E_Assessment />} />
                <Route path="/employee/leaderboard" element={<E_Leaderboard />} />

                {/* Admin Routes */}
                <Route path="/admin/analytics" element={<A_Analytics />} />
                <Route path="/admin/modules" element={<A_Modules />} />
                <Route path="/admin/assessment" element={<A_Assessment />} />
                <Route path="/admin/users" element={<A_Users />} />
                <Route path="/admin/leaderboard" element={<A_Leaderboard />} />

                <Route path="*" element={<NotFound />} />
            </Routes>
        </Router>
    );
}
