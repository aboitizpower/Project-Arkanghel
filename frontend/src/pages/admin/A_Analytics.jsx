import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Analytics.css';
import { Users, FileCheck, BookOpenCheck, Filter } from "lucide-react";

const API_URL = 'http://localhost:8081';

const A_Analytics = () => {
    const [kpis, setKpis] = useState({ totalUsers: 0, averageScore: 0, userProgress: { completed: 0, pending: 0 } });
    const [engagementData, setEngagementData] = useState([]);
    const [topUsers, setTopUsers] = useState([]);
    const [assessmentTracker, setAssessmentTracker] = useState([]);
    const [criticalAreas, setCriticalAreas] = useState([]);
    const [workstreams, setWorkstreams] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [selectedWorkstream, setSelectedWorkstream] = useState('all');
    const [selectedTimeRange, setSelectedTimeRange] = useState('monthly');

    useEffect(() => {
        const fetchAllData = async () => {
            setLoading(true);
            try {
                // Fetch all data in parallel
                const [
                    kpisRes, 
                    engagementRes, 
                    leaderboardRes, 
                    trackerRes, 
                    criticalAreasRes,
                    workstreamsRes
                ] = await Promise.all([
                    axios.get(`${API_URL}/admin/analytics/kpis`, { params: { workstreamId: selectedWorkstream === 'all' ? null : selectedWorkstream } }),
                    axios.get(`${API_URL}/admin/analytics/engagement`, { params: { range: selectedTimeRange } }),
                    axios.get(`${API_URL}/leaderboard`),
                    axios.get(`${API_URL}/admin/analytics/assessment-tracker`),
                    axios.get(`${API_URL}/admin/analytics/critical-areas`),
                    axios.get(`${API_URL}/workstreams`)
                ]);

                setKpis(kpisRes.data);
                setEngagementData(engagementRes.data.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) })));
                setTopUsers(leaderboardRes.data.slice(0, 5));
                setAssessmentTracker(trackerRes.data);
                setCriticalAreas(criticalAreasRes.data);
                setWorkstreams(workstreamsRes.data);

            } catch (error) {
                console.error("Failed to fetch analytics data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [selectedWorkstream, selectedTimeRange]);


    return (
        <div className="analytics-container">
            <AdminSidebar />
            <main className="analytics-main">
                <div className="analytics-grid">
                    {/* KPI Cards - Row 1 */}
                    <div className="custom-card kpi-card">
                        <div className="custom-card-header">
                            <h3 className="custom-card-title">Total Users</h3>
                            <div className="custom-icon-box" style={{ backgroundImage: 'linear-gradient(135deg, #667eea 10%, #764ba2 100%)' }}><Users /></div>
                        </div>
                        <p className="custom-card-value">{kpis.totalUsers}</p>
                    </div>
                    <div className="custom-card kpi-card">
                        <div className="custom-card-header">
                            <h3 className="custom-card-title">Average Assessment Scores</h3>
                            <div className="custom-icon-box" style={{ backgroundImage: 'linear-gradient(135deg, #42e695 10%, #3bb2b8 100%)' }}><FileCheck /></div>
                        </div>
                        <p className="custom-card-value">{Math.round(kpis.averageScore)}%</p>
                    </div>
                    <div className="custom-card kpi-card">
                        <div className="custom-card-header">
                            <h3 className="custom-card-title">User Progress</h3>
                            <div className="filter-container">
                                <Filter size={14} />
                                <select value={selectedWorkstream} onChange={(e) => setSelectedWorkstream(e.target.value)} className="workstream-filter">
                                    <option value="all">All Workstreams</option>
                                    {workstreams.map((ws) => <option key={ws.workstream_id} value={ws.workstream_id}>{ws.title}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="user-progress-split">
                            <div className="user-progress-section">
                                <p className="user-progress-label">Completed</p>
                                <p className="custom-card-value" style={{ color: '#28a745' }}>{kpis.userProgress.completed}</p>
                            </div>
                            <div className="user-progress-section">
                                <p className="user-progress-label">Pending</p>
                                <p className="custom-card-value" style={{ color: '#fd7e14' }}>{kpis.userProgress.pending}</p>
                            </div>
                        </div>
                    </div>

                    {/* User Engagement Overview - Row 2 */}
                    <div className="analytics-paper engagement-card">
                        <div className="custom-card-header">
                            <h3 className="analytics-title">User Engagement Overview</h3>
                            <select value={selectedTimeRange} onChange={(e) => setSelectedTimeRange(e.target.value)} className="time-range-filter">
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
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

                    {/* Top User Tracker - Row 2 */}
                    <div className="analytics-paper top-user-card">
                        <h3 className="analytics-title">Top User Completed Tracker</h3>
                         {topUsers.map(user => (
                            <div key={user.user_id} className="leaderboard-item">
                                <span>{user.first_name} {user.last_name}</span>
                                <div className="leaderboard-progress">
                                    <div className="leaderboard-progress-bar" style={{ width: `${user.overall_progress}%` }}></div>
                                </div>
                                <span>{Math.round(user.overall_progress)}%</span>
                            </div>
                        ))}
                    </div>

                    {/* Assessment Tracker - Row 3 */}
                    <div className="analytics-paper assessment-tracker-card">
                         <h3 className="analytics-title">Training Module Assessment Tracker</h3>
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={assessmentTracker} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="title" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="passed" stackId="a" fill="#28a745" />
                                <Bar dataKey="failed" stackId="a" fill="#dc3545" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Critical Learning Areas - Row 3 */}
                    <div className="analytics-paper critical-areas-card">
                        <h3 className="analytics-title">Critical Learning Areas</h3>
                        {criticalAreas.length > 0 ? (
                            criticalAreas.map((area, index) => (
                                <div key={index} className="critical-list-item">{area}</div>
                            ))
                        ) : (
                            <p>No critical areas identified.</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default A_Analytics; 