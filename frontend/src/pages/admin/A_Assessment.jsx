import React, { useEffect, useState, useMemo } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import { FaStream, FaBookOpen, FaClipboardList, FaTasks } from 'react-icons/fa';
import '../../styles/admin/A_Assessment.css';
import '../../styles/admin/AdminCommon.css';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAuth } from '../../auth/AuthProvider';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8081';

const PAGE_SIZE = 4;

const getInitials = (first, last) => {
  if (!first && !last) return '?';
  return `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase();
};

const getAvatarColor = (first, last) => {
  const colors = [
    "#2563eb", "#f59e42", "#10b981", "#e11d48", "#6366f1",
    "#fbbf24", "#14b8a6", "#f43f5e", "#a21caf", "#0ea5e9"
  ];
  const str = (first || "") + (last || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const A_Assessment = () => {
  const { user } = useAuth(); // Get user from auth context
  // Filters
  const [workstreams, setWorkstreams] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedWorkstream, setSelectedWorkstream] = useState('');
  const [selectedChapter, setSelectedChapter] = useState('');

  // KPIs
  const [kpis, setKpis] = useState({
    totalWorkstreams: 0,
    totalChapters: 0,
    totalAssessments: 0,
    totalPublishedAssessments: 0,
    totalEmployees: 0,
    totalAssessmentsTaken: 0,
  });

  // Table data
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('completed_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  // Fetch workstreams on mount
  useEffect(() => {
    fetch(`${API_BASE}/workstreams?published_only=true`, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        console.log('A_Assessment - Workstreams response:', data);
        // Handle both response formats: structured response or direct array
        const workstreamsData = data?.workstreams || data || [];
        const finalWorkstreams = Array.isArray(workstreamsData) ? workstreamsData : [];
        console.log('A_Assessment - Processed workstreams:', finalWorkstreams);
        setWorkstreams(finalWorkstreams);
      })
      .catch(err => {
        console.error('Failed to fetch workstreams:', err);
        setWorkstreams([]); // Ensure workstreams is an array on error
      });
  }, []);

  // Fetch chapters when workstream changes
  useEffect(() => {
    if (selectedWorkstream) {
      fetch(`${API_BASE}/workstreams/${selectedWorkstream}/chapters`, {
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })
        .then(res => res.json())
        .then(data => setChapters(data));
    } else {
      setChapters([]);
    }
    setSelectedChapter('');
  }, [selectedWorkstream]);

  // Fetch KPIs from consolidated backend endpoint
  useEffect(() => {
    fetch(`${API_BASE}/kpi`, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        // Ensure all keys exist to prevent errors, providing default 0
        setKpis({
          totalWorkstreams: data.totalWorkstreams || 0,
          totalChapters: data.totalChapters || 0,
          totalAssessments: data.totalAssessments || 0,
          totalAssessmentsTaken: data.totalAssessmentsTaken || 0,
        });
      })
      .catch(err => {
        console.error('Failed to fetch KPIs:', err);
        // Set KPIs to 0 on error to avoid display issues
        setKpis({
          totalWorkstreams: 0,
          totalChapters: 0,
          totalAssessmentsTaken: 0,
        });
      });
  }, []);

  // Fetch results when filters change
  useEffect(() => {
    console.log('A_Assessment - useEffect triggered');
    console.log('A_Assessment - User object:', user ? 'Present' : 'Missing');
    console.log('A_Assessment - User token:', user?.token ? 'Present' : 'Missing');
    
    if (!user || !user.token) {
      console.log('A_Assessment - No user or token, skipping API call');
      setError('User authentication required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const url = new URL(`${API_BASE}/assessment-results`);
    if (selectedWorkstream) url.searchParams.append('workstream_id', selectedWorkstream);
    if (selectedChapter) url.searchParams.append('chapter_id', selectedChapter);

    console.log('A_Assessment - Fetching results with URL:', url.toString());
    console.log('A_Assessment - Filters:', { selectedWorkstream, selectedChapter });
    console.log('A_Assessment - Authorization header:', `Bearer ${user.token.substring(0, 20)}...`);

    fetch(url, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      }
    })
      .then(async res => {
        if (!res.ok) {
          // Get more detailed error from backend
          const errorData = await res.json().catch(() => ({ error: 'Failed to parse error response.' }));
          const errorTitle = errorData.error || 'Network error';
          const errorDetails = errorData.details || 'No specific details available.';
          throw new Error(`Error ${res.status}: ${errorTitle}\nDetails: ${errorDetails}`);
        }
        return res.json();
      })
      .then(data => {
        setResults(data);
      })
      .catch(err => {
        // Display the specific error message from the backend
        setError(err.message);
        console.error('Fetch error:', err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [selectedWorkstream, selectedChapter, user]);

  // Table filtering, sorting, searching, pagination
  const filteredResults = useMemo(() => {
    let filtered = results;

    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(row =>
        (`${row.first_name} ${row.last_name}`.toLowerCase().includes(s))
      );
    }

    // Note: Sorting logic might need adjustment based on the actual data keys.
    filtered = filtered.sort((a, b) => {
      let vA = a[sortBy];
      let vB = b[sortBy];

      // Handle different data types for sorting
      if (typeof vA === 'string' && typeof vB === 'string') {
        // Case-insensitive string comparison
        vA = vA.toLowerCase();
        vB = vB.toLowerCase();
      } else if (sortBy === 'completed_at') {
        // Date comparison
        vA = vA ? new Date(vA).getTime() : 0;
        vB = vB ? new Date(vB).getTime() : 0;
      } else if (sortBy === 'total_score') {
        // Score is calculated as a percentage for sorting
        vA = a.total_questions > 0 ? (a.user_score / a.total_questions) : 0;
        vB = b.total_questions > 0 ? (b.user_score / b.total_questions) : 0;
      }

      if (vA < vB) return sortDir === 'asc' ? -1 : 1;
      if (vA > vB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [results, search, sortBy, sortDir, selectedWorkstream, selectedChapter]);

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredResults.slice(start, start + PAGE_SIZE);
  }, [filteredResults, page]);

  const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE) || 1;

  // Table column definitions
  const columns = [
    { key: 'avatar', label: 'Avatar', sort: false },
    { key: 'employee', label: 'Name', sort: true },
    { key: 'assessment_title', label: 'Assessment Title', sort: true },
    { key: 'completed_at', label: 'Date Taken', sort: false },
    { key: 'total_score', label: 'Score', sort: false },
    { key: 'total_attempts', label: 'Number of Attempts', sort: true },
    { key: 'passed', label: 'Pass/Fail', sort: true },
  ];

  const handleSort = (key) => {
    if (!key) return;

    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  // Render
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <LoadingOverlay loading={loading} />
        {/* Header and Search Bar Row */}
        <div className="admin-header">
          <div className="header-left">
            <h1 className="admin-title">Assessment Management</h1>
          </div>
          <div className="header-right">
            <div className="search-container" style={{ width: '400px', maxWidth: '100%' }}>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Search by employee name..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>
        {/* Shared Content Container for KPIs, Filters, Table */}
        <div className="assessment-content-container">
          {/* KPI Panel */}
          <div className="assessment-kpi-row">
            <KPIBox label="Total Workstreams" value={kpis.totalWorkstreams} icon={<FaStream />} />
            <KPIBox label="Total Chapters" value={kpis.totalChapters} icon={<FaBookOpen />} />
            <KPIBox label="Total Assessments" value={kpis.totalAssessments} icon={<FaClipboardList />} />
            <KPIBox label="Total Assessments Taken" value={kpis.totalAssessmentsTaken} icon={<FaTasks />} />
          </div>
          {/* Filters Row */}
          <div className="assessment-filters-row">
            <label className="assessment-filter-label">
              Workstream:{' '}
              <select value={selectedWorkstream} onChange={e => { 
                console.log('A_Assessment - Workstream selected:', e.target.value);
                setSelectedWorkstream(e.target.value); 
                setPage(1); 
              }} className="assessment-filter-select">
                <option value="">All</option>
                {workstreams.map(ws => (
                  <option key={ws.id} value={ws.id} title={ws.title}>{ws.title}</option>
                ))}
              </select>
            </label>
            <label className="assessment-filter-label">
              Chapter:{' '}
              <select value={selectedChapter} onChange={e => { setSelectedChapter(e.target.value); setPage(1); }} disabled={!selectedWorkstream} className="assessment-filter-select">
                <option value="">All</option>
                {chapters.map(ch => (
                  <option key={ch.chapter_id} value={ch.chapter_id} title={ch.title}>{ch.title}</option>
                ))}
              </select>
            </label>
          </div>
          {/* Table */}
          <div className="admin-table-container">
            {loading ? (
              <p style={{ padding: 32, textAlign: 'center' }}>Loading...</p>
            ) : error ? (
              <p style={{ color: 'red', padding: 32, textAlign: 'center' }}>{error}</p>
            ) : (
              <>
                <table className="admin-table assessment-table">
                  <thead>
                    <tr>
                      {columns.map(col => (
                                                <th 
                          key={col.key} 
                          onClick={() => col.sort && handleSort(col.key)}
                          className={`${col.sort ? 'sortable-header' : ''} ${col.key === 'avatar' ? 'avatar-col' : ''} ${col.key === 'employee' ? 'name-col' : ''}`}
                        >
                          {col.label}
                          {col.sort && sortBy === col.key && (
                            <span className="sort-indicator">{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                  {paginatedResults.length === 0 ? (
                    <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 24 }}>No results found.</td></tr>
                  ) : paginatedResults.map((row, i) => (
                    <tr key={row.result_id || i} className={i % 2 ? 'odd-row' : 'even-row'}>
                                            <td className="avatar-col">
                        <div className="assessment-table-avatar" style={{ backgroundColor: getAvatarColor(row.first_name, row.last_name) }}>
                          {getInitials(row.first_name, row.last_name)}
                        </div>
                      </td>
                      <td className="name-col">{row.first_name} {row.last_name}</td>
                      <td className="assessment-title-cell">
                        <div className="assessment-title-container">
                          <div className="workstream-title">Anomaly Detection</div>
                          <div className="chapter-title">{row.assessment_title}</div>
                        </div>
                      </td>
                      <td className="date-taken-cell">
                        {row.completed_at === 'N/A' ? (
                          'N/A'
                        ) : (
                          <div className="date-time-container">
                            <div className="date-line">
                              <span className="date-icon">📅</span>
                              <span className="date-text">
                                {new Date(row.completed_at).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </span>
                            </div>
                            <div className="time-line">
                              <span className="time-icon">🕐</span>
                              <span className="time-text">
                                {new Date(row.completed_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td>{`${row.user_score} / ${row.total_questions}`}</td>
                      <td>{row.total_attempts === 'N/A' ? 'N/A' : row.total_attempts}</td>
                      <td>
                        <span className={`status-badge ${row.passed === 'N/A' ? 'na' : row.passed ? 'passed' : 'failed'}`}>
                          {row.passed === 'N/A' ? 'N/A' : row.passed ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="pagination-wrapper">
                <div className="pagination-container">
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    &laquo;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setPage(i + 1)}
                      className={`pagination-btn${page === i + 1 ? ' active' : ''}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    className="pagination-btn"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    &raquo;
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </main>
  </div>
  );
};

function KPIBox({ label, value, icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon-wrapper">
        {icon}
      </div>
      <div className="kpi-text-wrapper">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
      </div>
    </div>
  );
}

export default A_Assessment;