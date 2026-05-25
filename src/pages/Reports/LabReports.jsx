/**
 * LabReports.jsx — Lab Reports / Diagnostic Reports Workspace
 *
 * Primary view for all lab order management. Shows aggregate stats,
 * filterable/searchable paginated table of lab orders, and entry
 * point to the per-order detail workspace.
 *
 * @project MediFlow Hospital Management System
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, Search, ChevronRight, RefreshCw,
  ClipboardList, Clock, CheckCircle2, XCircle,
  AlertCircle, Activity, ChevronLeft, Eye,
  ArrowUpDown, TestTube2, Loader2,
} from 'lucide-react';
import { get } from '../../utils/apiService';
import { parseApiError } from '../../utils/errorHandler';

/* ─── Animation variants ─────────────────────────────────────────────────── */
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};
const stagger = {
  animate: { transition: { staggerChildren: 0.06 } },
};
const cardVariant = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

/* ─── Status config ──────────────────────────────────────────────────────── */
const STATUS_CONFIG = {
  ORDERED:          { label: 'Ordered',         color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  SAMPLE_COLLECTED: { label: 'Sample Collected', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  IN_PROGRESS:      { label: 'In Progress',      color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  COMPLETED:        { label: 'Completed',        color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  CANCELLED:        { label: 'Cancelled',        color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const PRIORITY_CONFIG = {
  NORMAL: { label: 'Normal', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  URGENT: { label: 'Urgent', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  STAT:   { label: 'STAT',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

const FILTER_TABS = [
  { key: 'ALL',              label: 'All Orders' },
  { key: 'ORDERED',          label: 'Ordered' },
  { key: 'SAMPLE_COLLECTED', label: 'Collected' },
  { key: 'IN_PROGRESS',      label: 'In Progress' },
  { key: 'COMPLETED',        label: 'Completed' },
  { key: 'CANCELLED',        label: 'Cancelled' },
];

/* ─── Sub-components ─────────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, accent, loading }) => (
  <motion.div variants={cardVariant}
    className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
      <Icon className="w-5 h-5" strokeWidth={2} />
    </div>
    <div>
      <p className="text-xs font-medium text-tx3 uppercase tracking-wide">{label}</p>
      {loading
        ? <div className="h-6 w-12 bg-surface rounded animate-pulse mt-0.5" />
        : <p className="text-xl font-bold text-tx1 leading-tight">{value}</p>
      }
    </div>
  </motion.div>
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITY_CONFIG[priority] || { label: priority, color: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const SkeletonRow = () => (
  <tr className="border-b border-border">
    {[...Array(7)].map((_, i) => (
      <td key={i} className="px-4 py-3.5">
        <div className="h-4 bg-surface rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
      </td>
    ))}
  </tr>
);

/* ─── Main Component ─────────────────────────────────────────────────────── */
const LabReports = () => {
  const navigate = useNavigate();

  const [labOrders, setLabOrders]       = useState([]);
  const [stats, setStats]               = useState({ total: 0, ordered: 0, inProgress: 0, completed: 0 });
  const [loading, setLoading]           = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [currentPage, setCurrentPage]   = useState(0);
  const [totalPages, setTotalPages]     = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const PAGE_SIZE = 10;

  /* ─── Fetch lab orders ─────────────────────────────────────────────────── */
  const fetchLabOrders = useCallback(async (page = 0, searchTerm = '', filter = 'ALL') => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      // Pass status filter to backend — server-side filtering gives correct totals and pagination
      if (filter !== 'ALL') params.set('status', filter);

      const data = await get(`/api/v1/lab-orders?${params}`);

      if (data && data.content) {
        setLabOrders(data.content);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
      } else {
        setLabOrders([]);
        setTotalPages(0);
        setTotalElements(0);
      }
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ─── Fetch aggregate stats ────────────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      // Use size=1 — only totalElements matters; avoids fetching all records for counting
      const [allData, orderedData, collectedData, inProgressData, completedData] = await Promise.all([
        get('/api/v1/lab-orders?page=0&size=1'),
        get('/api/v1/lab-orders?page=0&size=1&status=ORDERED'),
        get('/api/v1/lab-orders?page=0&size=1&status=SAMPLE_COLLECTED'),
        get('/api/v1/lab-orders?page=0&size=1&status=IN_PROGRESS'),
        get('/api/v1/lab-orders?page=0&size=1&status=COMPLETED'),
      ]);
      setStats({
        total:      allData?.totalElements       || 0,
        ordered:    (orderedData?.totalElements   || 0) + (collectedData?.totalElements || 0),
        inProgress: inProgressData?.totalElements || 0,
        completed:  completedData?.totalElements  || 0,
      });
    } catch {
      // Non-critical — silently fail stats
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabOrders(0, '', 'ALL');
    fetchStats();
  }, [fetchLabOrders, fetchStats]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchLabOrders(0, search, activeFilter);
  };

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(0);
    fetchLabOrders(0, search, filter);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    fetchLabOrders(page, search, activeFilter);
  };

  const handleRefresh = () => {
    setSearch('');
    setActiveFilter('ALL');
    setCurrentPage(0);
    fetchLabOrders(0, '', 'ALL');
    fetchStats();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate"
      className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-tx1">Lab Reports</h1>
            <p className="text-sm text-tx3">Diagnostic test orders and results</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-tx2 bg-surface border border-border hover:text-tx1 hover:bg-card transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <motion.div variants={stagger} initial="initial" animate="animate"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ClipboardList} label="Total Orders" value={stats.total}
          accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
          loading={statsLoading} />
        <StatCard icon={Clock} label="Pending / Collected" value={stats.ordered}
          accent="bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
          loading={statsLoading} />
        <StatCard icon={Activity} label="In Progress" value={stats.inProgress}
          accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={statsLoading} />
        <StatCard icon={CheckCircle2} label="Completed" value={stats.completed}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          loading={statsLoading} />
      </motion.div>

      {/* ── Search + filters ── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Search bar */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx3" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by order code, patient code, patient name…"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-surface border border-border rounded-xl text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-colors"
              />
            </div>
            <button type="submit"
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
              Search
            </button>
          </form>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 py-2 overflow-x-auto border-b border-border">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleFilterChange(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeFilter === tab.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-tx2 hover:text-tx1 hover:bg-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mx-5 mt-4 flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/40">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface/50">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">
                  <span className="flex items-center gap-1.5"><ArrowUpDown className="w-3 h-3" />Order Code</span>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">Patient</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">Doctor</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">Tests</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">Priority</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-tx3 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                : labOrders.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <TestTube2 className="w-10 h-10 text-tx3/40" />
                          <p className="text-sm font-medium text-tx2">No lab orders found</p>
                          <p className="text-xs text-tx3">
                            {search || activeFilter !== 'ALL'
                              ? 'Try adjusting your search or filter.'
                              : 'Lab orders are created during consultations when doctors order diagnostic tests.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )
                  : labOrders.map((order, idx) => (
                    <motion.tr
                      key={order.labOrderCode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { delay: idx * 0.03 } }}
                      className="border-b border-border hover:bg-surface/40 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/reports/${order.labOrderCode}`)}
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {order.labOrderCode}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-sm font-medium text-tx1">{order.patientName}</p>
                          <p className="text-[11px] text-tx3 font-mono">{order.patientCode}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-sm text-tx1">Dr. {order.doctorName}</p>
                          <p className="text-[11px] text-tx3 font-mono">{order.doctorCode}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-xs font-semibold text-tx1 border border-border">
                          <FlaskConical className="w-3 h-3 text-tx3" />
                          {order.testsCount}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <PriorityBadge priority={order.priority} />
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-tx3">
                        {formatDate(order.orderDate)}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/reports/${order.labOrderCode}`); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                          <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <p className="text-xs text-tx3">
              Page {currentPage + 1} of {totalPages} · {totalElements} total orders
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-tx2 bg-surface border border-border hover:text-tx1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-tx2 bg-surface border border-border hover:text-tx1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default LabReports;
