/**
 * LabReportDetail.jsx — Lab Order Detail / Clinical Diagnostic Workspace
 *
 * Shows the full picture of a lab order:
 *   • Patient & doctor summary
 *   • Ordered tests with per-test report status
 *   • Result entry / editing per test
 *   • File attachment upload & download
 *   • Report verification workflow
 *
 * @project MediFlow Hospital Management System
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical, ChevronLeft, User, Stethoscope,
  ClipboardList, CheckCircle2, AlertCircle,
  Upload, Download, FileText, Image,
  Plus, Save, ShieldCheck, Loader2, Lock,
  Activity, TestTube2, Eye, XCircle, FileBadge,
} from 'lucide-react';
import { get, post, put } from '../../utils/apiService';
import { parseApiError } from '../../utils/errorHandler';

/* ─── Animations ─────────────────────────────────────────────────────────── */
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

/* ─── Constants ──────────────────────────────────────────────────────────── */
const STATUS_CFG = {
  ORDERED:          { label: 'Ordered',         color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
  SAMPLE_COLLECTED: { label: 'Sample Collected', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  IN_PROGRESS:      { label: 'In Progress',      color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-100 dark:bg-amber-900/30' },
  COMPLETED:        { label: 'Completed',        color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  CANCELLED:        { label: 'Cancelled',        color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-100 dark:bg-red-900/30' },
};

const REPORT_STATUS_CFG = {
  PENDING:  { label: 'Pending',  color: 'text-slate-500 dark:text-slate-400',   bg: 'bg-slate-100 dark:bg-slate-700/50' },
  READY:    { label: 'Ready',    color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-900/30' },
  VERIFIED: { label: 'Verified', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
};

const ORDER_STATUS_STEPS = ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED'];

/* ─── Helper: fetch with auth (for file download) ──────────────────────── */
const fetchWithAuth = async (url) => {
  const token = localStorage.getItem('mediflow_token');
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error('Download failed');
  return resp;
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */
const Section = ({ title, icon: Icon, children, accent }) => (
  <div className="bg-card border border-border rounded-2xl overflow-hidden">
    <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-border ${accent || 'bg-surface/50'}`}>
      <Icon className="w-4 h-4 text-tx3" strokeWidth={2} />
      <h2 className="text-sm font-semibold text-tx1">{title}</h2>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const InfoRow = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4 py-1.5">
    <span className="text-xs font-medium text-tx3 whitespace-nowrap">{label}</span>
    <span className={`text-sm text-tx1 text-right ${mono ? 'font-mono' : ''}`}>{value || '—'}</span>
  </div>
);

const StatusBadge = ({ status, config }) => {
  const cfg = config[status] || { label: status, color: 'text-tx2', bg: 'bg-surface' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

/* ─── Status progress bar ────────────────────────────────────────────────── */
const StatusProgress = ({ status }) => {
  const currentIdx = ORDER_STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-0">
      {ORDER_STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const cfg = STATUS_CFG[step];
        return (
          <React.Fragment key={step}>
            <div className="flex flex-col items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${done ? 'bg-indigo-600 text-white' : 'bg-surface border-2 border-border text-tx3'}`}>
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <span className={`text-[9px] font-semibold whitespace-nowrap ${done ? 'text-indigo-600 dark:text-indigo-400' : 'text-tx3'}`}>
                {cfg.label}
              </span>
            </div>
            {idx < ORDER_STATUS_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 ${done && idx < currentIdx ? 'bg-indigo-600' : 'bg-border'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ─── Result Editor ──────────────────────────────────────────────────────── */
const ResultEditor = ({ item, existingReport, onSaved, labOrderCode }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    resultValue: existingReport?.resultValue || '',
    referenceRange: existingReport?.referenceRange || '',
    abnormalFlag: existingReport?.abnormalFlag || false,
    interpretation: existingReport?.interpretation || '',
    remarks: existingReport?.remarks || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isVerified = existingReport?.reportStatus === 'VERIFIED';

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (existingReport) {
        await put(`/api/v1/lab-reports/${existingReport.reportCode}`, form);
      } else {
        await post('/api/v1/lab-reports', {
          labOrderCode,
          labOrderItemId: item.id,
          ...form,
        });
      }
      onSaved();
      setOpen(false);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (isVerified) {
    return (
      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Report Verified — Read Only</span>
        </div>
        <div className="space-y-1">
          {existingReport.resultValue && <p className="text-sm text-tx1"><span className="text-xs text-tx3">Result: </span>{existingReport.resultValue}</p>}
          {existingReport.referenceRange && <p className="text-xs text-tx3">Range: {existingReport.referenceRange}</p>}
          {existingReport.abnormalFlag && <p className="text-xs font-semibold text-red-600 dark:text-red-400">⚠ Abnormal</p>}
        </div>
      </div>
    );
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {existingReport ? 'Edit Results' : 'Add Results'}
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-tx3 mb-1">Result Value</label>
              <input value={form.resultValue} onChange={e => setForm(f => ({ ...f, resultValue: e.target.value }))}
                placeholder="e.g. 12.5 g/dL"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-tx3 mb-1">Reference Range</label>
              <input value={form.referenceRange} onChange={e => setForm(f => ({ ...f, referenceRange: e.target.value }))}
                placeholder="e.g. 12.0–16.0 g/dL"
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-tx3 mb-1">Interpretation</label>
            <textarea value={form.interpretation} onChange={e => setForm(f => ({ ...f, interpretation: e.target.value }))}
              rows={2} placeholder="Clinical interpretation of result…"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-tx1 placeholder:text-tx3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-tx3 mb-1">Remarks</label>
            <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              placeholder="Additional remarks…"
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.abnormalFlag}
              onChange={e => setForm(f => ({ ...f, abnormalFlag: e.target.checked }))}
              className="w-4 h-4 rounded accent-red-500" />
            <span className="text-xs font-medium text-tx2">Mark as Abnormal</span>
          </label>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />{error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Save Results'}
            </button>
            <button onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-tx2 bg-surface border border-border hover:text-tx1 transition-colors">
              Cancel
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

/* ─── Attachment row ─────────────────────────────────────────────────────── */
const AttachmentRow = ({ attachment }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const resp = await fetchWithAuth(
        `/api/v1/lab-reports/attachments/${attachment.id}/download`
      );
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.originalFileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Silent
    } finally {
      setDownloading(false);
    }
  };

  const isImage = attachment.fileType?.startsWith('image/');
  const Icon = isImage ? Image : FileText;
  const sizeMB = attachment.fileSize ? (attachment.fileSize / 1024 / 1024).toFixed(2) : '?';

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-tx1 truncate">{attachment.originalFileName}</p>
          <p className="text-[11px] text-tx3">{sizeMB} MB · {attachment.fileType?.split('/')[1]?.toUpperCase()}</p>
        </div>
      </div>
      <button onClick={handleDownload} disabled={downloading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 disabled:opacity-60 transition-colors flex-shrink-0">
        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        {downloading ? 'Downloading…' : 'Download'}
      </button>
    </div>
  );
};

/* ─── PDF Action Buttons ─────────────────────────────────────────────────── */
const PdfActionButtons = ({ reportCode, reportStatus }) => {
  const [viewLoading, setViewLoading]         = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [pdfError, setPdfError]               = useState('');

  const fetchPdf = async (download) => {
    const setter = download ? setDownloadLoading : setViewLoading;
    setter(true);
    setPdfError('');
    try {
      const token = localStorage.getItem('mediflow_token');
      const url   = `/api/v1/lab-reports/${reportCode}/pdf${download ? '?download=true' : ''}`;
      const resp  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (resp.status === 403) {
        setPdfError('You do not have access to this report PDF.');
        return;
      }
      if (resp.status === 404) {
        setPdfError('Report PDF unavailable.');
        return;
      }
      if (!resp.ok) {
        setPdfError('Failed to load report PDF. Please try again.');
        return;
      }

      const blob    = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const filename = `LAB-REPORT-${reportCode}.pdf`;

      if (download) {
        const a      = document.createElement('a');
        a.href       = blobUrl;
        a.download   = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } else {
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      }
    } catch {
      setPdfError('Network error. Please check your connection and try again.');
    } finally {
      setter(false);
    }
  };

  const isVerified  = reportStatus === 'VERIFIED';
  const anyLoading  = viewLoading || downloadLoading;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold text-tx3 uppercase tracking-wide">Generated Report PDF</p>

      {!isVerified ? (
        <p className="text-xs text-tx3 italic flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          PDF available once report is verified
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {/* View PDF */}
          <button
            onClick={() => fetchPdf(false)}
            disabled={anyLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              text-teal-700 dark:text-teal-300
              bg-teal-50 dark:bg-teal-900/20
              border border-teal-200 dark:border-teal-800/40
              hover:bg-teal-100 dark:hover:bg-teal-900/30
              disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {viewLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Eye className="w-3.5 h-3.5" />}
            {viewLoading ? 'Loading…' : 'View PDF'}
          </button>

          {/* Download PDF */}
          <button
            onClick={() => fetchPdf(true)}
            disabled={anyLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              text-indigo-700 dark:text-indigo-300
              bg-indigo-50 dark:bg-indigo-900/20
              border border-indigo-200 dark:border-indigo-800/40
              hover:bg-indigo-100 dark:hover:bg-indigo-900/30
              disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {downloadLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileBadge className="w-3.5 h-3.5" />}
            {downloadLoading ? 'Preparing…' : 'Download PDF'}
          </button>
        </div>
      )}

      <AnimatePresence>
        {pdfError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {pdfError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Main Component ─────────────────────────────────────────────────────── */
const LabReportDetail = () => {
  const { labOrderCode } = useParams();
  const navigate = useNavigate();

  const [labOrder, setLabOrder]       = useState(null);
  const [reports, setReports]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Status update
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError]       = useState('');

  // File upload state keyed by reportCode
  const [uploadingFor, setUploadingFor] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const fileInputRefs = useRef({});

  // Verify state keyed by reportCode
  const [verifyingFor, setVerifyingFor] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, reportsData] = await Promise.all([
        get(`/api/v1/lab-orders/${labOrderCode}`),
        get(`/api/v1/lab-reports/order/${labOrderCode}`).catch(() => []),
      ]);
      setLabOrder(orderData);
      setReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, [labOrderCode]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Find report for a given item id
  const getReportForItem = (itemId) =>
    reports.find(r => r.labOrderItemId === itemId) || null;

  // Handle order status update
  const handleStatusUpdate = async (newStatus) => {
    setStatusUpdating(true);
    setStatusError('');
    try {
      await put(`/api/v1/lab-orders/${labOrderCode}/status`, { status: newStatus });
      await fetchData();
    } catch (err) {
      setStatusError(parseApiError(err).message);
    } finally {
      setStatusUpdating(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (reportCode, file) => {
    if (!file) return;
    setUploadingFor(reportCode);
    setUploadErrors(prev => ({ ...prev, [reportCode]: '' }));

    const token = localStorage.getItem('mediflow_token');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const resp = await fetch(`/api/v1/lab-reports/${reportCode}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!resp.ok || data.success === false) {
        throw new Error(data.message || 'Upload failed');
      }
      await fetchData();
    } catch (err) {
      setUploadErrors(prev => ({ ...prev, [reportCode]: err.message }));
    } finally {
      setUploadingFor(null);
    }
  };

  // Handle verify
  const handleVerify = async (reportCode) => {
    setVerifyingFor(reportCode);
    try {
      await put(`/api/v1/lab-reports/${reportCode}/verify`);
      await fetchData();
    } catch (err) {
      setUploadErrors(prev => ({ ...prev, [reportCode]: parseApiError(err).message }));
    } finally {
      setVerifyingFor(null);
    }
  };

  const formatDate = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const STATUS_ACTIONS = {
    ORDERED:          { next: 'SAMPLE_COLLECTED', label: 'Mark Sample Collected' },
    SAMPLE_COLLECTED: { next: 'IN_PROGRESS',      label: 'Mark In Progress' },
    IN_PROGRESS:      { next: 'COMPLETED',         label: 'Mark Completed' },
    COMPLETED:        null,
    CANCELLED:        null,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-tx3">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading lab order…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm text-tx2 text-center max-w-sm">{error}</p>
        <button onClick={() => navigate('/reports')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-surface border border-border text-tx2 hover:text-tx1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Reports
        </button>
      </div>
    );
  }

  if (!labOrder) return null;

  const nextAction = STATUS_ACTIONS[labOrder.status];

  return (
    <motion.div variants={fadeIn} initial="initial" animate="animate" className="space-y-6">

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/reports')}
          className="flex items-center gap-1.5 text-sm text-tx3 hover:text-tx1 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Lab Reports
        </button>
        <span className="text-tx3">/</span>
        <span className="text-sm font-semibold text-tx1 font-mono">{labOrder.labOrderCode}</span>
      </div>

      {/* ── Header ── */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <p className="text-lg font-bold text-tx1 font-mono">{labOrder.labOrderCode}</p>
              <p className="text-xs text-tx3">Ordered on {formatDate(labOrder.orderDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={labOrder.status} config={STATUS_CFG} />
            {labOrder.priority !== 'NORMAL' && (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold
                ${labOrder.priority === 'STAT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                {labOrder.priority}
              </span>
            )}
          </div>
        </div>

        {/* Status progress */}
        {labOrder.status !== 'CANCELLED' && (
          <div className="mt-5 px-2">
            <StatusProgress status={labOrder.status} />
          </div>
        )}

        {/* Next action button */}
        {nextAction && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
            <button
              onClick={() => handleStatusUpdate(nextAction.next)}
              disabled={statusUpdating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {statusUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
              {statusUpdating ? 'Updating…' : nextAction.label}
            </button>
            {labOrder.status !== 'COMPLETED' && (
              <button
                onClick={() => handleStatusUpdate('CANCELLED')}
                disabled={statusUpdating}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60 transition-colors"
              >
                <XCircle className="w-4 h-4" /> Cancel Order
              </button>
            )}
            {statusError && <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{statusError}</p>}
          </div>
        )}
      </div>

      {/* ── Patient + Doctor cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Section title="Patient" icon={User}>
          <div className="divide-y divide-border/50">
            <InfoRow label="Name"         value={labOrder.patientName} />
            <InfoRow label="Patient Code" value={labOrder.patientCode} mono />
          </div>
        </Section>
        <Section title="Ordering Doctor" icon={Stethoscope}>
          <div className="divide-y divide-border/50">
            <InfoRow label="Name"        value={`Dr. ${labOrder.doctorName}`} />
            <InfoRow label="Doctor Code" value={labOrder.doctorCode} mono />
          </div>
        </Section>
      </div>

      {/* ── Order details ── */}
      {(labOrder.clinicalNotes || labOrder.instructions) && (
        <Section title="Order Notes" icon={ClipboardList}>
          <div className="space-y-3">
            {labOrder.clinicalNotes && (
              <div>
                <p className="text-[10px] font-semibold text-tx3 uppercase tracking-wide mb-1">Clinical Notes</p>
                <p className="text-sm text-tx1 leading-relaxed bg-surface rounded-xl p-3">{labOrder.clinicalNotes}</p>
              </div>
            )}
            {labOrder.instructions && (
              <div>
                <p className="text-[10px] font-semibold text-tx3 uppercase tracking-wide mb-1">Instructions</p>
                <p className="text-sm text-tx1 leading-relaxed bg-surface rounded-xl p-3">{labOrder.instructions}</p>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── Tests / Reports section ── */}
      <Section title={`Ordered Tests (${labOrder.testsCount || 0})`} icon={TestTube2}>
        {labOrder.items && labOrder.items.length > 0 ? (
          <div className="space-y-5">
            {labOrder.items.map((item, idx) => {
              const report = getReportForItem(item.id);
              const reportCfg = report ? REPORT_STATUS_CFG[report.reportStatus] : null;
              const isVerified = report?.reportStatus === 'VERIFIED';

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: idx * 0.05 } }}
                  className="border border-border rounded-xl overflow-hidden"
                >
                  {/* Test header */}
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-surface/60">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{idx + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-tx1">{item.testName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {item.testCode && <span className="text-[11px] font-mono text-tx3">{item.testCode}</span>}
                          {item.category && <span className="text-[11px] text-tx3">· {item.category}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {reportCfg ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${reportCfg.bg} ${reportCfg.color}`}>
                          {reportCfg.label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
                          No Report
                        </span>
                      )}
                      {report && !isVerified && (
                        <button
                          onClick={() => handleVerify(report.reportCode)}
                          disabled={verifyingFor === report.reportCode || report.reportStatus === 'PENDING'}
                          title={report.reportStatus === 'PENDING' ? 'Add results before verifying' : 'Verify this report'}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {verifyingFor === report.reportCode
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <ShieldCheck className="w-3 h-3" />}
                          Verify
                        </button>
                      )}
                      {isVerified && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
                    </div>
                  </div>

                  {/* Test body */}
                  <div className="p-4 space-y-4">
                    {item.remarks && (
                      <p className="text-xs text-tx3 italic">Note: {item.remarks}</p>
                    )}

                    {/* Result data if report exists */}
                    {report && report.resultValue && (
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-surface rounded-xl p-3">
                          <p className="text-[10px] font-semibold text-tx3 uppercase tracking-wide mb-1">Result</p>
                          <p className={`font-semibold ${report.abnormalFlag ? 'text-red-600 dark:text-red-400' : 'text-tx1'}`}>
                            {report.resultValue}
                            {report.abnormalFlag && <span className="ml-1.5 text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded px-1 py-0.5">ABNORMAL</span>}
                          </p>
                        </div>
                        {report.referenceRange && (
                          <div className="bg-surface rounded-xl p-3">
                            <p className="text-[10px] font-semibold text-tx3 uppercase tracking-wide mb-1">Reference Range</p>
                            <p className="text-tx1">{report.referenceRange}</p>
                          </div>
                        )}
                        {report.interpretation && (
                          <div className="col-span-2 bg-surface rounded-xl p-3">
                            <p className="text-[10px] font-semibold text-tx3 uppercase tracking-wide mb-1">Interpretation</p>
                            <p className="text-tx1 leading-relaxed">{report.interpretation}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Result editor */}
                    <ResultEditor
                      item={item}
                      existingReport={report}
                      labOrderCode={labOrderCode}
                      onSaved={fetchData}
                    />

                    {/* Attachment upload (only if report exists) */}
                    {report && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-semibold text-tx3 uppercase tracking-wide">Attachments</p>
                          {!isVerified && (
                            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 cursor-pointer transition-colors">
                              {uploadingFor === report.reportCode
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Upload className="w-3.5 h-3.5" />}
                              Upload File
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg"
                                disabled={uploadingFor === report.reportCode}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(report.reportCode, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>

                        {uploadErrors[report.reportCode] && (
                          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />{uploadErrors[report.reportCode]}
                          </p>
                        )}

                        {report.attachments && report.attachments.length > 0 ? (
                          <div className="space-y-2">
                            {report.attachments.map(att => (
                              <AttachmentRow key={att.id} attachment={att} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-tx3 italic">No files uploaded yet. Upload PDFs, scans, or images.</p>
                        )}
                      </div>
                    )}

                    {/* Generated Report PDF — View / Download */}
                    {report && (
                      <div className="pt-1 border-t border-border/50">
                        <PdfActionButtons
                          reportCode={report.reportCode}
                          reportStatus={report.reportStatus}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 gap-2">
            <TestTube2 className="w-8 h-8 text-tx3/40" />
            <p className="text-sm text-tx2">No tests found for this order</p>
          </div>
        )}
      </Section>
    </motion.div>
  );
};

export default LabReportDetail;
