import React, { useEffect, useState, useMemo } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/admin/A_Assessment.css';
import '../../styles/admin/AdminCommon.css';
import LoadingOverlay from '../../components/LoadingOverlay';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8081';

const PAGE_SIZE = 10;

const A_Assessment = () => {
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

  // Table controls
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date_taken');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  // Fetch workstreams on mount
  useEffect(() => {
    fetch(`${API_BASE}/workstreams`)
      .then(res => res.json())
      .then(data => {
        setWorkstreams(data);
      });
  }, []);

  // Fetch chapters when workstream changes
  useEffect(() => {
    if (selectedWorkstream) {
      fetch(`${API_BASE}/workstreams/${selectedWorkstream}/chapters`)
        .then(res => res.json())
        .then(data => setChapters(data));
    } else {
      setChapters([]);
    }
    setSelectedChapter('');
  }, [selectedWorkstream]);

  // Fetch KPIs from backend endpoints
  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/kpi/total-workstreams`).then(res => res.json()),
      fetch(`${API_BASE}/kpi/total-chapters`).then(res => res.json()),
      fetch(`${API_BASE}/kpi/total-assessments`).then(res => res.json()),
      fetch(`${API_BASE}/kpi/total-assessments-taken`).then(res => res.json()),
    ]).then(([ws, ch, as, taken]) => {
      setKpis({
        totalWorkstreams: ws.count,
        totalChapters: ch.count,
        totalAssessments: as.count,
        totalAssessmentsTaken: taken.count,
      });
    });
  }, [selectedWorkstream, selectedChapter]);

  // Fetch results when filters change
  useEffect(() => {
    setLoading(true);
    setError(null);
    // Fetch results
    const params = [];
    if (selectedWorkstream) params.push(`workstreamId=${selectedWorkstream}`);
    if (selectedChapter) params.push(`chapterId=${selectedChapter}`);
    const url = `${API_BASE}/admin/assessments/results${params.length ? '?' + params.join('&') : ''}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) {
          setError(data && data.error ? data.error : 'Failed to load data.');
          setResults([]);
          setLoading(false);
          console.error('Unexpected response from /admin/assessments/results:', data);
          return;
        }
        setResults(data);
        setLoading(false);
      })
      .catch((err) => {
        setError('Failed to load data.');
        setLoading(false);
        console.error('Fetch error:', err);
      });
  }, [selectedWorkstream, selectedChapter]);

  // Table filtering, sorting, searching, pagination
  const filteredResults = useMemo(() => {
    let filtered = results;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(row =>
        (`${row.first_name} ${row.last_name}`.toLowerCase().includes(s))
      );
    }
    filtered = filtered.sort((a, b) => {
      let vA = a[sortBy], vB = b[sortBy];
      if (sortBy === 'date_taken') {
        vA = vA ? new Date(vA) : 0;
        vB = vB ? new Date(vB) : 0;
      }
      if (vA < vB) return sortDir === 'asc' ? -1 : 1;
      if (vA > vB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [results, search, sortBy, sortDir]);

  const paginatedResults = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredResults.slice(start, start + PAGE_SIZE);
  }, [filteredResults, page]);

  const totalPages = Math.ceil(filteredResults.length / PAGE_SIZE) || 1;

  // Table column definitions
  const columns = [
    { key: 'employee', label: 'Employee Name', sort: false },
    { key: 'assessment_title', label: 'Assessment Title', sort: true },
    { key: 'date_taken', label: 'Date Taken', sort: true },
    { key: 'total_score', label: 'Score', sort: true },
    { key: 'num_attempts', label: 'Number of Attempts', sort: true },
    { key: 'pass_fail', label: 'Pass/Fail', sort: true },
  ];

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
            <KPIBox label="Total Workstreams" value={kpis.totalWorkstreams} />
            <KPIBox label="Total Chapters" value={kpis.totalChapters} />
            <KPIBox label="Total Assessments" value={kpis.totalAssessments} />
            <KPIBox label="Total Assessments Taken" value={kpis.totalAssessmentsTaken} />
          </div>
          {/* Filters Row */}
          <div className="assessment-filters-row">
            <label className="assessment-filter-label">
            Workstream:{' '}
              <select value={selectedWorkstream} onChange={e => { setSelectedWorkstream(e.target.value); setPage(1); }} className="assessment-filter-select">
              <option value="">All</option>
              {workstreams.map(ws => (
                <option key={ws.workstream_id} value={ws.workstream_id} title={ws.title}>{ws.title}</option>
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
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Assessment Title</th>
                    <th>Date Taken</th>
                    <th>Score</th>
                    <th>Number of Attempts</th>
                    <th>Pass/Fail</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResults.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>No results found.</td></tr>
                  ) : paginatedResults.map((row, i) => (
                    <tr key={i} className={i % 2 ? 'odd-row' : 'even-row'}>
                      <td>{row.first_name} {row.last_name}</td>
                      <td>{row.assessment_title}</td>
                      <td>{row.date_taken ? new Date(row.date_taken).toLocaleString() : '-'}</td>
                      <td>{row.total_score ?? '-'}</td>
                      <td>{row.num_attempts ?? '-'}</td>
                      <td>{row.pass_fail ?? '-'}</td>
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

function KPIBox({ label, value }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 1px 4px #0001', padding: 16, minWidth: 160, textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 14, color: '#555', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default A_Assessment; 