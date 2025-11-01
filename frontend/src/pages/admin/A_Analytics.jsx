import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Analytics.css';
import { Users, TrendingUp, AlertTriangle, Activity, FileCheck, BookOpenCheck, Filter } from 'lucide-react';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';

import API_URL from '../../config/api';

const A_Analytics = () => {
    const [kpis, setKpis] = useState({ totalUsers: 0, averageScore: 0, userProgress: { completed: 0, pending: 0 } });
    const [engagementData, setEngagementData] = useState([]);
    const [topUsers, setTopUsers] = useState([]);
    const [assessmentTracker, setAssessmentTracker] = useState([]);
    const [criticalAreas, setCriticalAreas] = useState([]);
    const [workstreams, setWorkstreams] = useState([]);
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedWorkstream, setSelectedWorkstream] = useState('all');
    const [selectedTimeRange, setSelectedTimeRange] = useState('monthly');

    const processEngagementData = (data, range) => {
        const result = [];
        const dataMap = new Map(data.map(item => [item.date, item.value]));
        const now = new Date();

        // Helper to format date as YYYY-MM-DD without timezone shift
        const toLocalDateString = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        
        // Helper to format date as YYYY-MM
        const toLocalMonthString = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            return `${year}-${month}`;
        };

        switch (range) {
            case 'weekly':
                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(now.getDate() - i);
                    const dateString = toLocalDateString(d);
                    result.push({
                        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                        value: dataMap.get(dateString) || 0
                    });
                }
                break;
            case 'monthly':
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                     const d = new Date(now.getFullYear(), now.getMonth(), i);
                     const dateString = toLocalDateString(d);
                     result.push({
                        date: `${i}`,
                        value: dataMap.get(dateString) || 0
                     });
                }
                break;
            case 'quarterly':
                // Show last 3 months
                for (let i = 2; i >= 0; i--) {
                    const d = new Date();
                    d.setMonth(now.getMonth() - i);
                    const monthString = toLocalMonthString(d);
                    result.push({
                        date: d.toLocaleDateString('en-US', { month: 'short' }),
                        value: dataMap.get(monthString) || 0
                    });
                }
                break;
            case 'yearly':
                for (let i = 0; i < 12; i++) {
                    const d = new Date(now.getFullYear(), i, 1);
                    const monthString = toLocalMonthString(d);
                    result.push({
                        date: d.toLocaleDateString('en-US', { month: 'short' }),
                        value: dataMap.get(monthString) || 0
                    });
                }
                break;
            default:
        }
        return result;
    }

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                // Create headers with authorization
                const headers = {
                    'Authorization': `Bearer ${user?.token}`
                };

                // Fetch all data in parallel
                const [
                    kpisRes, 
                    engagementRes, 
                    leaderboardRes, 
                    trackerRes, 
                    criticalAreasRes,
                    workstreamsRes
                ] = await Promise.all([
                    axios.get(`${API_URL}/admin/analytics/kpis`, { 
                        params: { workstreamId: selectedWorkstream === 'all' ? null : selectedWorkstream },
                        headers 
                    }),
                    axios.get(`${API_URL}/admin/analytics/engagement`, { 
                        params: { range: selectedTimeRange },
                        headers 
                    }),
                    axios.get(`${API_URL}/admin/leaderboard`, { headers }),
                    axios.get(`${API_URL}/admin/analytics/assessment-tracker`, { headers }),
                    axios.get(`${API_URL}/admin/analytics/critical-areas`, { headers }),
                    axios.get(`${API_URL}/workstreams?published_only=true`, { headers })
                ]);

                console.log('🔍 KPIs API Response:', kpisRes.data);
                console.log('🔍 Engagement API Response:', engagementRes.data);
                console.log('🔍 Leaderboard API Response:', leaderboardRes.data);
                console.log('🔍 Assessment Tracker API Response:', trackerRes.data);
                console.log('🔍 Critical Areas API Response:', criticalAreasRes.data);
                console.log('🔍 Workstreams API Response:', workstreamsRes.data);
                
                setKpis(kpisRes.data);
                const processedEngagement = processEngagementData(engagementRes.data, selectedTimeRange);
                console.log('Raw engagement data from API:', engagementRes.data);
                console.log('Processed engagement data:', processedEngagement);
                setEngagementData(processedEngagement);
                setTopUsers(leaderboardRes.data.slice(0, 3));
                setAssessmentTracker(trackerRes.data);
                setCriticalAreas(criticalAreasRes.data);
                
                // Handle both old and new response formats for workstreams
                const workstreamsData = workstreamsRes.data?.workstreams || workstreamsRes.data || [];
                console.log('Workstreams response:', workstreamsRes.data);
                console.log('Processed workstreams data:', workstreamsData);
                setWorkstreams(Array.isArray(workstreamsData) ? workstreamsData : []);

            } catch (error) {
                console.error("Failed to fetch analytics data:", error);
            } finally {
                setLoading(false);
            }
        };

        if (user?.token) {
            fetchAllData();
        }
    }, [selectedWorkstream, selectedTimeRange, user]);


    return (
        <div className="analytics-container">
            <AdminSidebar />
            <main className="analytics-main">
                <LoadingOverlay loading={loading} />
                <h1 className="welcome-header">
                    Welcome, {user ? `${user.first_name} ${user.last_name}` : 'Admin'}!
                </h1>
                <div className="analytics-grid">
                    {/* KPI Cards - Row 1 */}
                    <div className="enhanced-kpi-card total-users-card">
                        <div className="kpi-card-content">
                            <div className="kpi-icon-container users-icon">
                                <Users size={16} />
                            </div>
                            <div className="kpi-details">
                                <h3 className="kpi-title">Total Users</h3>
                                <p className="kpi-value">{kpis.totalUsers}</p>
                            </div>
                        </div>
                        <div className="kpi-background-pattern"></div>
                    </div>

                    <div className="enhanced-kpi-card assessment-scores-card">
                        <div className="kpi-card-content">
                            <div className="kpi-icon-container scores-icon">
                                <FileCheck size={16} />
                            </div>
                            <div className="kpi-details">
                                <h3 className="kpi-title">Average Assessment Scores</h3>
                                <p className="kpi-value">{Math.round(kpis.averageScore)}%</p>
                            </div>
                        </div>
                        <div className="kpi-background-pattern"></div>
                    </div>

                    <div className="enhanced-kpi-card user-progress-card">
                        <div className="kpi-card-header-enhanced">
                            <div className="kpi-title-section">
                                <div className="kpi-icon-container progress-icon">
                                    <BookOpenCheck size={16} />
                                </div>
                                <h3 className="kpi-title">User Progress</h3>
                            </div>
                            <div className="filter-container-enhanced">
                                <Filter size={14} className="filter-icon" />
                                <select value={selectedWorkstream} onChange={(e) => setSelectedWorkstream(e.target.value)} className="workstream-filter-enhanced">
                                    <option value="all">All Workstreams</option>
                                    {workstreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.title}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="progress-metrics">
                            <div className="progress-metric completed-metric">
                                <div className="metric-icon completed-icon">✓</div>
                                <div className="metric-details">
                                    <span className="metric-label">Completed</span>
                                    <span className="metric-value">{kpis.userProgress.completed}</span>
                                </div>
                            </div>
                            <div className="progress-divider"></div>
                            <div className="progress-metric pending-metric">
                                <div className="metric-icon pending-icon">⏳</div>
                                <div className="metric-details">
                                    <span className="metric-label">Pending</span>
                                    <span className="metric-value">{kpis.userProgress.pending}</span>
                                </div>
                            </div>
                        </div>
                        <div className="kpi-background-pattern"></div>
                    </div>

                    {/* User Engagement Overview - Row 2 */}
                    <div className="analytics-paper engagement-card">
                        <div className="custom-card-header">
                            <h3 className="analytics-title">
                                <Activity className="title-icon" size={18} />
                                User Engagement Overview
                            </h3>
                            <select value={selectedTimeRange} onChange={(e) => setSelectedTimeRange(e.target.value)} className="time-range-filter">
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={engagementData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <defs><linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4e73df" stopOpacity={0.8}/><stop offset="95%" stopColor="#4e73df" stopOpacity={0}/></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Area type="monotone" dataKey="value" stroke="#4e73df" fillOpacity={1} fill="url(#colorEngagement)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Top Users Leaderboard - Row 3 */}
                    <div className="analytics-paper leaderboard-card">
                        <h3 className="analytics-title">
                            <Users className="title-icon" size={18} />
                            Top Users
                        </h3>
                        <div className="leaderboard-container">
                            {topUsers.map((user, index) => (
                                <div key={user.user_id} className="leaderboard-item">
                                    <div className="leaderboard-rank">
                                        <span className={`rank-badge rank-${index + 1}`}>#{index + 1}</span>
                                    </div>
                                    <div className="leaderboard-user-info">
                                        <div className="user-details">
                                            <span className="user-name">{user.first_name} {user.last_name}</span>
                                            <div className="leaderboard-progress">
                                                <div className="leaderboard-progress-bar" style={{ width: `${user.average_progress || user.progress_percent || 0}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="leaderboard-score">
                                        <span className="score-value">{Math.round(user.average_progress || user.progress_percent || 0)}%</span>
                                        <span className="score-label">Progress</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Assessment Tracker - Row 3 */}
                    <div className="analytics-paper assessment-tracker-card">
                        <h3 className="analytics-title">
                            <FileCheck className="title-icon" size={18} />
                            Assessment Tracker
                        </h3>
                        <div className="assessment-tracker-content">
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={assessmentTracker} margin={{ top: 20, right: 20, left: 0, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="passedGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#28a745" stopOpacity={0.9}/>
                                            <stop offset="95%" stopColor="#20c997" stopOpacity={0.8}/>
                                        </linearGradient>
                                        <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#dc3545" stopOpacity={0.9}/>
                                            <stop offset="95%" stopColor="#e74c3c" stopOpacity={0.8}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                                    <XAxis 
                                        dataKey="title" 
                                        tick={{ fontSize: 12, fill: '#6c757d' }}
                                        axisLine={{ stroke: '#dee2e6' }}
                                    />
                                    <YAxis 
                                        tick={{ fontSize: 12, fill: '#6c757d' }}
                                        axisLine={{ stroke: '#dee2e6' }}
                                    />
                                    <Tooltip 
                                        contentStyle={{
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #dee2e6',
                                            borderRadius: '8px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                        }}
                                    />
                                    <Legend 
                                        wrapperStyle={{ paddingTop: '10px' }}
                                        iconType="circle"
                                    />
                                    <Bar 
                                        dataKey="passed" 
                                        stackId="a" 
                                        fill="url(#passedGradient)"
                                        radius={[0, 0, 4, 4]}
                                        name="Passed"
                                    />
                                    <Bar 
                                        dataKey="failed" 
                                        stackId="a" 
                                        fill="url(#failedGradient)"
                                        radius={[4, 4, 0, 0]}
                                        name="Failed"
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Critical Learning Areas - Row 3 */}
                    <div className="analytics-paper critical-areas-card">
                        <h3 className="analytics-title">
                            <BookOpenCheck className="title-icon critical-icon" size={18} />
                            Critical Learning Areas
                        </h3>
                        <div className="critical-areas-content">
                            {criticalAreas.length > 0 ? (
                                criticalAreas.map((area, index) => (
                                    <div key={index} className="critical-area-item">
                                        <div className="critical-area-indicator">
                                            <span className="critical-rank">#{index + 1}</span>
                                        </div>
                                        <div className="critical-area-content">
                                            <span className="critical-area-name">{area}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="no-critical-areas">
                                    <div className="success-icon">✓</div>
                                    <p className="no-critical-message">No critical areas identified</p>
                                    <p className="no-critical-subtitle">All learning areas are performing well</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default A_Analytics; 