/**
 * Invoices.jsx — MediFlow Invoice History & Receipt Center
 *
 * A first-class operational module (not buried inside Billing) that allows:
 *  ADMIN   — view all invoices, preview/download any PDF
 *  PATIENT — view own invoices, preview/download own PDFs
 *  DOCTOR  — 403 (backend enforces; frontend shows error gracefully)
 *
 * Data source:
 *  List     → GET /api/v1/bills (admin) or /api/v1/bills/patient/{code} (patient)
 *  Preview  → GET /api/v1/invoices/{billCode}          (inline PDF)
 *  Download → GET /api/v1/invoices/{billCode}/download (attachment PDF)
 *
 * PDF requests use a direct fetch with the JWT Bearer token because
 * window.open() does not send Authorization headers.
 *
 * @project MediFlow Hospital Management System
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, X, Download, Eye,
  Clock, CheckCircle, XCircle, AlertCircle,
  TrendingUp, TrendingDown, Filter,
} from 'lucide-react';
import apiService from '../utils/apiService';

// ─── JWT token key (matches apiService.js TOKEN_KEY) ────────────────────────
const TOKEN_KEY = 'mediflow_token';

// ─── Status display maps ─────────────────────────────────────────────────────
const PAY_STATUS = {
  PAID:     { label: 'Paid',     icon: CheckCircle, bg: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' },
  PENDING:  { label: 'Pending',  icon: Clock,        bg: 'bg-amber-50   dark:bg-amber-500/15',   text: 'text-amber-700   dark:text-amber-300'   },
  FAILED:   { label: 'Failed',   icon: XCircle,      bg: 'bg-rose-50    dark:bg-rose-500/15',    text: 'text-rose-700    dark:text-rose-300'    },
  REFUNDED: { label: 'Refunded', icon: TrendingDown,  bg: 'bg-blue-50    dark:bg-blue-500/15',    text: 'text-blue-700    dark:text-blue-300'    },
  PARTIAL:  { label: 'Partial',  icon: TrendingUp,    bg: 'bg-purple-50  dark:bg-purple-500/15',  text: 'text-purple-700  dark:text-purple-300'  },
};

const METHOD_LABELS = {
  CASH: 'Cash', CARD: 'Card', UPI: 'UPI', ONLINE: 'Online', INSURANCE: 'Insurance',
};

// ─── Animation variants ───────────────────────────────────────────────────────
const containerV = { animate: { transition: { staggerChildren: 0.06 } } };
const itemV = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const toInvoiceNumber = (billCode) =>
  billCode && billCode.toUpperCase().startsWith('BILL-')
    ? 'INV-' + billCode.substring(5)
    : billCode ? 'INV-' + billCode : '—';

const fmtDate = (dt) =>
  dt ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtAmount = (amount) =>
  amount != null ? `₹${parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—';

// ─── PDF Blob Fetch (includes JWT Authorization header) ──────────────────────
const fetchPdfBlob = async (endpoint) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const resp = await fetch(endpoint, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const j = await resp.json(); msg = j.message || msg; } catch (_) {}
    const err = new Error(msg);
    err.status = resp.status;
    throw err;
  }
  return resp.blob();
};

// ─── Payment Method Badge ─────────────────────────────────────────────────────
const MethodBadge = ({ method }) => {
  if (!method) return <span className="text-[11px] text-tx3">—</span>;
  const colors = {
    CASH: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    CARD: 'bg-blue-50   dark:bg-blue-500/10   text-blue-700   dark:text-blue-300',
    UPI:  'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300',
    ONLINE:    'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    INSURANCE: 'bg-amber-50  dark:bg-amber-500/10  text-amber-700  dark:text-amber-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[method] || 'bg-surface text-tx2'}`}>
      {METHOD_LABELS[method] || method}
    </span>
  );
};

// ─── Action Buttons for each row ─────────────────────────────────────────────
const InvoiceActions = ({ bill, onPreview, onDownload, previewLoading, downloadLoading }) => {
  const isPaid      = bill.paymentStatus === 'PAID';
  const isCancelled = bill.billStatus === 'CANCELLED';
  const billCode    = bill.billCode;

  if (isCancelled) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-tx3">
        <XCircle className="w-3.5 h-3.5" /> Unavailable
      </span>
    );
  }

  if (!isPaid) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-500">
        <Clock className="w-3.5 h-3.5" /> Payment Pending
      </span>
    );
  }

  const pLoading = previewLoading === billCode;
  const dLoading = downloadLoading === billCode;

  return (
    <div className="flex items-center gap-2">
      {/* Preview */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onPreview(bill)}
        disabled={pLoading || dLoading}
        title="Open PDF in browser"
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium border border-border text-tx2 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-400/60 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50"
      >
        {pLoading
          ? <span className="w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          : <Eye className="w-3.5 h-3.5" />}
        Preview
      </motion.button>

      {/* Download */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onDownload(bill)}
        disabled={pLoading || dLoading}
        title="Download PDF"
        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60"
      >
        {dLoading
          ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          : <Download className="w-3.5 h-3.5" />}
        Download
      </motion.button>
    </div>
  );
};

// ─── Notification Toast ───────────────────────────────────────────────────────
const Toast = ({ message, type, onDismiss }) => (
  <motion.div
    initial={{ opacity: 0, y: -16 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -12 }}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-[13px] font-medium shadow-lg
      ${type === 'error'
        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
        : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'}`}
  >
    {type === 'error'
      ? <AlertCircle className="w-4 h-4 flex-shrink-0" />
      : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
    <span className="flex-1">{message}</span>
    <button onClick={onDismiss} className="p-0.5 rounded hover:opacity-70 transition-opacity flex-shrink-0">
      <X className="w-3.5 h-3.5" />
    </button>
  </motion.div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const Invoices = () => {
  const [bills,           setBills]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [searchInput,     setSearchInput]     = useState('');
  const [searchedQuery,   setSearchedQuery]   = useState('');
  const [viewMode,        setViewMode]        = useState('all');   // 'all' | 'search'
  const [statusFilter,    setStatusFilter]    = useState('ALL');
  const [page,            setPage]            = useState(0);
  const [totalPages,      setTotalPages]      = useState(0);
  const [totalElements,   setTotalElements]   = useState(0);
  const [previewLoading,  setPreviewLoading]  = useState(null);
  const [downloadLoading, setDownloadLoading] = useState(null);
  const [toast,           setToast]           = useState(null);   // { message, type }

  // ── Data loading ────────────────────────────────────────────────────────────

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const loadAllBills = useCallback(async (p = 0) => {
    setLoading(true);
    setError('');
    setViewMode('all');
    setSearchedQuery('');
    setStatusFilter('ALL');
    try {
      const data = await apiService.get(`/api/v1/bills?page=${p}&size=10`);
      const list = Array.isArray(data) ? data : (data?.content ?? []);
      setBills(list);
      setPage(p);
      setTotalPages(data?.totalPages ?? 0);
      setTotalElements(data?.totalElements ?? list.length);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) {
        setError('Access denied. Admin role required to view all invoices.');
      } else {
        setError('Failed to load invoices. Please try again.');
      }
      setBills([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAllBills(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Search ──────────────────────────────────────────────────────────────────

  const handleSearch = async (e) => {
    e?.preventDefault();
    const raw = searchInput.trim();
    if (!raw) { loadAllBills(0); return; }

    setLoading(true);
    setError('');
    setBills([]);
    setStatusFilter('ALL');
    setViewMode('search');
    setSearchedQuery(raw);

    try {
      // Invoice number search: INV-2026-0001 → BILL-2026-0001
      // Bill code search:      BILL-2026-0001 → direct lookup
      // Anything else:         treat as patient code search
      const upper = raw.toUpperCase();
      if (upper.startsWith('INV-')) {
        const billCode = 'BILL-' + raw.substring(4);
        const bill = await apiService.get(`/api/v1/bills/${billCode}`);
        setBills(bill ? [bill] : []);
      } else if (upper.startsWith('BILL-')) {
        const bill = await apiService.get(`/api/v1/bills/${raw}`);
        setBills(bill ? [bill] : []);
      } else {
        // Patient code (or partial — try exact match first)
        const data = await apiService.get(`/api/v1/bills/patient/${raw}?page=0&size=50`);
        const list = Array.isArray(data) ? data : (data?.content ?? []);
        setBills(list);
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403)      setError('Access denied. You can only view your own invoices.');
      else if (status === 404) setError(`No records found for: "${raw}"`);
      else                     setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setSearchInput('');
    setError('');
    loadAllBills(0);
  };

  // ── PDF actions ─────────────────────────────────────────────────────────────

  const handlePreview = async (bill) => {
    setPreviewLoading(bill.billCode);
    try {
      const blob = await fetchPdfBlob(`/api/v1/invoices/${bill.billCode}`);
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // Revoke after 60 s — long enough for the new tab to load
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      const msg = err.status === 422
        ? 'Invoice not available. Only PAID bills have invoices.'
        : err.status === 403
          ? 'Access denied. You can only preview your own invoices.'
          : 'Preview failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleDownload = async (bill) => {
    setDownloadLoading(bill.billCode);
    try {
      const blob     = await fetchPdfBlob(`/api/v1/invoices/${bill.billCode}/download`);
      const url      = URL.createObjectURL(blob);
      const anchor   = document.createElement('a');
      anchor.href    = url;
      anchor.download = `Invoice_${toInvoiceNumber(bill.billCode)}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast(`Invoice ${toInvoiceNumber(bill.billCode)} downloaded.`, 'success');
    } catch (err) {
      const msg = err.status === 422
        ? 'Invoice not available. Only PAID bills have downloadable invoices.'
        : err.status === 403
          ? 'Access denied. You can only download your own invoices.'
          : 'Download failed. Please try again.';
      showToast(msg, 'error');
    } finally {
      setDownloadLoading(null);
    }
  };

  // ── Client-side status filter ────────────────────────────────────────────────
  const filteredBills = statusFilter === 'ALL'
    ? bills
    : statusFilter === 'CANCELLED'
      ? bills.filter(b => b.billStatus === 'CANCELLED')
      : bills.filter(b => b.paymentStatus === statusFilter);

  // ── Stats strip ──────────────────────────────────────────────────────────────
  const paidCount    = bills.filter(b => b.paymentStatus === 'PAID').length;
  const pendingCount = bills.filter(b => b.paymentStatus === 'PENDING').length;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <motion.div variants={containerV} initial="initial" animate="animate">

      {/* ── Toast notification ── */}
      <div className="fixed top-4 right-4 z-50 w-80">
        <AnimatePresence>
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onDismiss={() => setToast(null)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* ── Page header ── */}
      <motion.div variants={itemV} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-indigo-400" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-tx1">Invoices</h1>
            <p className="text-sm text-tx3 mt-0.5">Invoice history, receipts & PDF downloads</p>
          </div>
        </div>
      </motion.div>

      {/* ── Stats strip (visible when data is loaded) ── */}
      {!loading && bills.length > 0 && (
        <motion.div variants={itemV} className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-card border border-border rounded-2xl px-5 py-4">
            <p className="text-[11px] font-semibold text-tx3 uppercase tracking-wide mb-1">
              {viewMode === 'all' ? 'Total Invoices' : 'Invoices Found'}
            </p>
            <p className="text-2xl font-bold text-tx1 tabular-nums">
              {viewMode === 'all' ? totalElements : bills.length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-2xl px-5 py-4">
            <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide mb-1">Paid</p>
            <p className="text-2xl font-bold text-emerald-500 tabular-nums">{paidCount}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl px-5 py-4 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-500 tabular-nums">{pendingCount}</p>
          </div>
        </motion.div>
      )}

      {/* ── Main card ── */}
      <motion.div variants={itemV} className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* Search bar */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-tx1">Invoice Records</h2>
              <p className="text-xs text-tx3 mt-0.5">
                {viewMode === 'search'
                  ? `Results for "${searchedQuery}"`
                  : `All invoices — ${totalElements} total`}
              </p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 h-10 bg-surface border border-border rounded-xl px-3
              transition-all focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/10">
              <Search className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by Invoice # (INV-…), Bill Code (BILL-…), or Patient Code (PAT-…)"
                className="flex-1 bg-transparent text-[13px] text-tx1 placeholder:text-tx3 outline-none min-w-0"
              />
              {searchInput && (
                <button type="button" onClick={handleClear}
                  className="p-0.5 rounded hover:bg-rose-500/10 text-tx3 hover:text-rose-400 transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.97 }}
              disabled={!searchInput.trim() || loading}
              className="h-10 px-4 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && viewMode === 'search'
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Search className="w-3.5 h-3.5" />}
              Search
            </motion.button>
          </form>
        </div>

        {/* Status filter tabs */}
        {!loading && !error && bills.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border">
            <Filter className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
            {['ALL', 'PAID', 'PENDING', 'CANCELLED'].map(f => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`h-8 px-3 rounded-lg text-[11px] font-medium transition-colors
                  ${statusFilter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-surface border border-border text-tx2 hover:text-tx1'}`}
              >
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
                {f !== 'ALL' && (
                  <span className="ml-1.5 opacity-70">
                    ({f === 'CANCELLED'
                      ? bills.filter(b => b.billStatus === 'CANCELLED').length
                      : bills.filter(b => b.paymentStatus === f).length})
                  </span>
                )}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-tx3">
              {filteredBills.length} record{filteredBills.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>

        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-[13px] font-medium text-rose-400">{error}</p>
            {viewMode === 'search' && (
              <button onClick={handleClear}
                className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors">
                ← Back to all invoices
              </button>
            )}
          </div>

        ) : filteredBills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FileText className="w-10 h-10 text-tx3" strokeWidth={1} />
            <p className="text-[13px] font-medium text-tx2">No invoices found</p>
            <p className="text-[12px] text-tx3">
              {viewMode === 'search'
                ? `No records matching "${searchedQuery}"`
                : statusFilter !== 'ALL'
                  ? `No ${statusFilter.toLowerCase()} invoices in this view`
                  : 'No billing records in the system yet'}
            </p>
            {viewMode === 'search' && (
              <button onClick={handleClear}
                className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors mt-1">
                ← Back to all invoices
              </button>
            )}
          </div>

        ) : (
          /* ── Invoice Table ── */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    'Invoice #', 'Bill Code', 'Patient', 'Doctor',
                    'Amount', 'Method', 'Status', 'Paid Date', 'Actions',
                  ].map(h => (
                    <th key={h}
                      className="text-left px-4 py-3 text-[10px] font-semibold text-tx3 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredBills.map((bill, i) => {
                    const ps = PAY_STATUS[bill.paymentStatus] || PAY_STATUS.PENDING;
                    const StatusIcon = ps.icon;

                    return (
                      <motion.tr
                        key={bill.billCode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-surface/70 transition-colors"
                      >
                        {/* Invoice # */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-[12px] font-bold text-indigo-400">
                            {toInvoiceNumber(bill.billCode)}
                          </span>
                        </td>

                        {/* Bill Code */}
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-[11px] text-tx3">{bill.billCode}</span>
                        </td>

                        {/* Patient */}
                        <td className="px-4 py-3.5">
                          <p className="text-[13px] text-tx1 font-medium">{bill.patientName || '—'}</p>
                          <p className="font-mono text-[10px] text-tx3">{bill.patientCode}</p>
                        </td>

                        {/* Doctor */}
                        <td className="px-4 py-3.5 text-[13px] text-tx2 whitespace-nowrap">
                          {bill.doctorName || '—'}
                        </td>

                        {/* Amount */}
                        <td className="px-4 py-3.5">
                          <p className="text-[14px] font-bold text-tx1">{fmtAmount(bill.totalAmount)}</p>
                          <p className="text-[10px] text-tx3">Fee {fmtAmount(bill.consultationFee)}</p>
                        </td>

                        {/* Payment method badge */}
                        <td className="px-4 py-3.5">
                          <MethodBadge method={bill.paymentMethod} />
                        </td>

                        {/* Payment status */}
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${ps.bg} ${ps.text}`}>
                            <StatusIcon className="w-3 h-3" />
                            {ps.label}
                          </span>
                        </td>

                        {/* Paid date */}
                        <td className="px-4 py-3.5 text-[12px] text-tx3 whitespace-nowrap">
                          {bill.paymentStatus === 'PAID' ? fmtDate(bill.paidAt) : '—'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5">
                          <InvoiceActions
                            bill={bill}
                            onPreview={handlePreview}
                            onDownload={handleDownload}
                            previewLoading={previewLoading}
                            downloadLoading={downloadLoading}
                          />
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination — all-bills view only */}
        {!loading && !error && viewMode === 'all' && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <span className="text-[12px] text-tx3">{totalElements} invoices total</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => loadAllBills(page - 1)}
                className="h-8 px-3 rounded-lg text-[12px] font-medium border border-border text-tx2 hover:text-tx1 hover:bg-surface transition-colors disabled:opacity-40">
                ← Prev
              </button>
              <span className="text-[12px] text-tx2 tabular-nums min-w-[60px] text-center">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => loadAllBills(page + 1)}
                className="h-8 px-3 rounded-lg text-[12px] font-medium border border-border text-tx2 hover:text-tx1 hover:bg-surface transition-colors disabled:opacity-40">
                Next →
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default Invoices;
