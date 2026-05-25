/**
 * ConsultationList.jsx — Clinical Encounter Overview
 *
 * Displays consultation records for the current user:
 *  ADMIN  → all consultations, browseable + searchable
 *  DOCTOR → their own consultations
 *  PATIENT → their own consultations (read-only)
 *
 * Stats strip (Total / Draft / Completed) always shows global counts for the
 * current scope via three parallel size=1 requests. The list is server-side
 * filtered by status so pagination is always correct.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Clock, CheckCircle2, AlertCircle,
  ChevronLeft, ChevronRight, Stethoscope,
  Calendar, FileText, ArrowRight, RefreshCw, Search,
} from 'lucide-react';
import apiService from '../../utils/apiService';
import { parseApiError } from '../../utils/errorHandler';

/* ─── Animation variants ─────────────────────────────────────────────────── */
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28 } },
};
const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};
const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/* ─── Status badge ───────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    DRAFT:     { label: 'Draft',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    COMPLETED: { label: 'Completed', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  };
  const { label, cls } = map[status] || { label: status, cls: 'bg-surface text-tx2' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${cls}`}>
      {status === 'DRAFT' ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
      {label}
    </span>
  );
};

/* ─── Stat card ──────────────────────────────────────────────────────────── */
const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-4.5 h-4.5 text-white" strokeWidth={2} />
    </div>
    <div>
      <p className="text-xs text-tx3 font-medium">{label}</p>
      <p className="text-xl font-bold text-tx1 leading-tight">{value}</p>
    </div>
  </div>
);

/* ─── Skeleton card ──────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
    <div className="flex justify-between mb-3">
      <div className="h-4 bg-surface rounded w-28" />
      <div className="h-5 bg-surface rounded-full w-20" />
    </div>
    <div className="space-y-2 mb-4">
      <div className="h-3 bg-surface rounded w-full" />
      <div className="h-3 bg-surface rounded w-3/4" />
    </div>
    <div className="h-3 bg-surface rounded w-1/2" />
  </div>
);

/* ─── Consultation Card ──────────────────────────────────────────────────── */
const ConsultationCard = ({ consultation, onOpen }) => {
  const date = consultation.appointmentDate
    ? new Date(consultation.appointmentDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

  return (
    <motion.div
      variants={cardVariants}
      className="group bg-card border border-border rounded-xl p-5 hover:border-indigo-500/50 hover:shadow-card transition-all duration-200 cursor-pointer"
      onClick={() => onOpen(consultation.consultationCode)}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] text-tx3 font-mono mb-0.5">{consultation.consultationCode}</p>
          <h3 className="text-sm font-semibold text-tx1 leading-tight">
            {consultation.patientName || '—'}
          </h3>
        </div>
        <StatusBadge status={consultation.consultationStatus} />
      </div>

      {/* Diagnosis callout (for completed) */}
      {consultation.consultationStatus === 'COMPLETED' && consultation.diagnosis && (
        <div className="mb-3 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/30 rounded-lg">
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mb-0.5">Diagnosis</p>
          <p className="text-xs text-tx1 line-clamp-2">{consultation.diagnosis}</p>
        </div>
      )}

      {/* Chief complaint for draft */}
      {consultation.consultationStatus === 'DRAFT' && consultation.chiefComplaint && (
        <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg">
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-0.5">Chief Complaint</p>
          <p className="text-xs text-tx1 line-clamp-2">{consultation.chiefComplaint}</p>
        </div>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-tx3">
        <span className="flex items-center gap-1">
          <Stethoscope className="w-3 h-3" />
          {consultation.doctorName || '—'}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {date}
        </span>
        {consultation.consultationType && (
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {consultation.consultationType.replace('_', ' ')}
          </span>
        )}
      </div>

      {/* Prescription count */}
      {consultation.prescriptionItems && consultation.prescriptionItems.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] text-tx3">
            {consultation.prescriptionItems.length} prescription item{consultation.prescriptionItems.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* CTA */}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="text-[11px] text-tx3">
          {consultation.consultationStatus === 'DRAFT' ? 'Continue editing' : 'View record'}
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </motion.div>
  );
};

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function ConsultationList() {
  const navigate = useNavigate();

  const [consultations, setConsultations] = useState([]);
  const [totalPages, setTotalPages]       = useState(1);
  const [page, setPage]                   = useState(0);
  const [statusFilter, setStatusFilter]   = useState('ALL');
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [searchCode, setSearchCode]       = useState('');

  // Global stats (total/draft/completed) — fetched separately from the list
  // so they show accurate counts regardless of which status tab is active.
  const [stats, setStats] = useState({ total: 0, draft: 0, completed: 0 });

  // Read user profile stored at login — stable across renders.
  const userInfo = useMemo(() => {
    const stored = apiService.getStoredUser() || {};
    return {
      roles:       stored.roles       || [],
      doctorCode:  stored.doctorCode  || null,
      patientCode: stored.patientCode || null,
    };
  }, []);

  const isAdmin   = userInfo.roles.includes('ROLE_ADMIN');
  const isDoctor  = userInfo.roles.includes('ROLE_DOCTOR');
  const isPatient = userInfo.roles.includes('ROLE_PATIENT');

  /**
   * The base API path for list + stats requests (no page/size/status appended).
   * Returns null when no valid endpoint exists for the current user/search state.
   *
   * CONS- codes are handled separately (single-item lookup) — this returns null for them.
   */
  const baseEndpoint = useMemo(() => {
    if (searchCode.startsWith('CONS-')) return null;               // Single lookup
    if (isAdmin && searchCode.startsWith('PAT-'))
      return `/api/v1/consultations/patient/${searchCode}`;
    if (isAdmin && searchCode.startsWith('DOC-'))
      return `/api/v1/consultations/doctor/${searchCode}`;
    if (isAdmin) return `/api/v1/consultations`;                   // Admin: all
    if (isDoctor && userInfo.doctorCode)
      return `/api/v1/consultations/doctor/${userInfo.doctorCode}`;
    if (isPatient && userInfo.patientCode)
      return `/api/v1/consultations/patient/${userInfo.patientCode}`;
    return null;
  }, [isAdmin, isDoctor, isPatient, userInfo.doctorCode, userInfo.patientCode, searchCode]);

  /**
   * Fetch global stats (total / draft / completed) for the current scope.
   * Three parallel size=1 requests — lightweight, always accurate regardless
   * of which status tab is selected in the list.
   * Re-runs only when the scope changes (role, codes, search), NOT on page/filter changes.
   */
  const fetchStats = useCallback(async () => {
    if (!baseEndpoint) return;
    try {
      const [allData, draftData, completedData] = await Promise.all([
        apiService.get(`${baseEndpoint}?page=0&size=1`),
        apiService.get(`${baseEndpoint}?page=0&size=1&status=DRAFT`),
        apiService.get(`${baseEndpoint}?page=0&size=1&status=COMPLETED`),
      ]);
      setStats({
        total:     allData.totalElements       || 0,
        draft:     draftData.totalElements     || 0,
        completed: completedData.totalElements || 0,
      });
    } catch {
      // Stats are supplementary — don't surface errors here
    }
  }, [baseEndpoint]);

  /**
   * Fetch the paginated consultation list for the current page + status filter.
   * Status filtering is server-side — the backend receives ?status=DRAFT|COMPLETED.
   */
  const fetchConsultations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // ── Single CONS- lookup ────────────────────────────────────────────────
      if (searchCode.startsWith('CONS-')) {
        const single = await apiService.get(`/api/v1/consultations/${searchCode}`);
        setConsultations([single]);
        setTotalPages(1);
        setStats({
          total:     1,
          draft:     single.consultationStatus === 'DRAFT'     ? 1 : 0,
          completed: single.consultationStatus === 'COMPLETED' ? 1 : 0,
        });
        return;
      }

      // ── No valid scope (doctor/patient missing code in profile) ────────────
      if (!baseEndpoint) {
        setError(
          'Unable to load consultations: user profile is incomplete. ' +
          'Please log out and log back in to refresh your session.'
        );
        setConsultations([]);
        return;
      }

      // ── Paginated list with server-side status filter ──────────────────────
      const statusParam = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
      const data = await apiService.get(
        `${baseEndpoint}?page=${page}&size=12${statusParam}`
      );

      setConsultations(data.content || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      const { message } = parseApiError(err);
      setError(message);
      setConsultations([]);
    } finally {
      setLoading(false);
    }
  }, [baseEndpoint, page, statusFilter, searchCode]);

  // Stats run when scope changes (baseEndpoint), not on filter/page changes.
  useEffect(() => { fetchStats(); }, [fetchStats]);
  // List runs on any dependency change (page, filter, scope).
  useEffect(() => { fetchConsultations(); }, [fetchConsultations]);

  const TABS = [
    { key: 'ALL',       label: 'All' },
    { key: 'DRAFT',     label: 'Draft' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const searchPlaceholder = isAdmin
    ? 'Search by CONS-…, PAT-…, or DOC-… code'
    : 'Search by CONS-… code';

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="min-h-screen bg-page p-6 lg:p-8"
    >
      {/* ── Page header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-tx1">Consultations</h1>
        </div>
        <p className="text-sm text-tx3 ml-12">Clinical encounter records and prescriptions</p>
      </div>

      {/* ── Stats strip — global counts, always accurate ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon={ClipboardList} label="Total"     value={stats.total}     color="bg-indigo-500" />
        <StatCard icon={Clock}         label="Draft"     value={stats.draft}     color="bg-amber-500"  />
        <StatCard icon={CheckCircle2}  label="Completed" value={stats.completed} color="bg-emerald-500" />
      </div>

      {/* ── Search + filter row ── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx3" />
          <input
            type="text"
            value={searchCode}
            onChange={e => { setSearchCode(e.target.value.toUpperCase()); setPage(0); }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={() => { fetchConsultations(); fetchStats(); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-sm text-tx2 hover:text-tx1 hover:border-indigo-400 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* ── Status filter tabs ── */}
      <div className="flex gap-1 mb-5 bg-surface p-1 rounded-xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(0); }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-card text-tx1 shadow-sm'
                : 'text-tx3 hover:text-tx2'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-sm text-red-700 dark:text-red-300"
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cards grid ── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : consultations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="w-12 h-12 text-tx3 mb-3 opacity-40" />
          <p className="text-tx2 font-medium mb-1">No consultations found</p>
          <p className="text-sm text-tx3">
            {statusFilter !== 'ALL'
              ? `No ${statusFilter.toLowerCase()} consultations`
              : isAdmin
                ? 'No consultations exist in the system yet'
                : 'Start a consultation from an IN_PROGRESS appointment'}
          </p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {consultations.map(c => (
            <ConsultationCard
              key={c.consultationCode}
              consultation={c}
              onOpen={code => navigate(`/consultations/${code}`)}
            />
          ))}
        </motion.div>
      )}

      {/* ── Pagination ── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-card border border-border text-tx2 hover:text-tx1 hover:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-tx3 font-medium">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-card border border-border text-tx2 hover:text-tx1 hover:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
