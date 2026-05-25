import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  DollarSign, Clock, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Download, Search, X, CreditCard,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

/* ─── Static UI config for KPI cards ───────────────────────────── */
const KPI_CONFIG = [
  { label:'Total Revenue (YTD)',  icon: DollarSign,    iconBg:'bg-indigo-500/15', iconColor:'text-indigo-400'  },
  { label:'Pending Invoices',     icon: Clock,         iconBg:'bg-amber-500/15',  iconColor:'text-amber-400'   },
  { label:'Collected This Month', icon: CheckCircle,   iconBg:'bg-emerald-500/15',iconColor:'text-emerald-400' },
  { label:'Overdue Invoices',     icon: AlertTriangle, iconBg:'bg-rose-500/15',   iconColor:'text-rose-400'    },
];

/* ─── Dept revenue colours ──────────────────────────────────────── */
const DEPT_COLORS = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

/* ─── Bill status maps ──────────────────────────────────────────── */
const PAY_STATUS_MAP = {
  PENDING:  { label: 'Pending',  bg: 'bg-amber-50   dark:bg-amber-500/15',   text: 'text-amber-700   dark:text-amber-300'   },
  PAID:     { label: 'Paid',     bg: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' },
  FAILED:   { label: 'Failed',   bg: 'bg-rose-50    dark:bg-rose-500/15',    text: 'text-rose-700    dark:text-rose-300'    },
  REFUNDED: { label: 'Refunded', bg: 'bg-blue-50    dark:bg-blue-500/15',    text: 'text-blue-700    dark:text-blue-300'    },
  PARTIAL:  { label: 'Partial',  bg: 'bg-purple-50  dark:bg-purple-500/15',  text: 'text-purple-700  dark:text-purple-300'  },
};
const BILL_STATUS_MAP = {
  GENERATED: { label: 'Active',    bg: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-600 dark:text-slate-300' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-rose-50   dark:bg-rose-500/15',  text: 'text-rose-700  dark:text-rose-300'  },
  VOID:      { label: 'Void',      bg: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-600 dark:text-slate-300'  },
};

const PAYMENT_METHODS = [
  { value: 'CASH',      label: 'Cash'      },
  { value: 'CARD',      label: 'Card'      },
  { value: 'UPI',       label: 'UPI'       },
  { value: 'ONLINE',    label: 'Online'    },
  { value: 'INSURANCE', label: 'Insurance' },
];

/* ─── Custom chart tooltips ─────────────────────────────────────── */
const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-card-lg text-[12px]">
      <p className="text-tx3 mb-1.5 font-medium">{label}</p>
      <p className="text-indigo-400">Revenue: <span className="font-bold text-tx1">₹{payload[0]?.value?.toLocaleString()}</span></p>
      {payload[1] && <p className="text-rose-400">Expenses: <span className="font-bold text-tx1">₹{payload[1]?.value?.toLocaleString()}</span></p>}
    </div>
  );
};

const DeptTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-card-lg text-[12px]">
      <p className="text-tx3 mb-1">{label}</p>
      <p className="font-bold text-tx1">₹{payload[0]?.value?.toLocaleString()}</p>
    </div>
  );
};

/* ─── Animation variants ────────────────────────────────────────── */
const containerV = { animate: { transition: { staggerChildren: 0.07 } } };
const itemV = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } },
};

/* ─── Pay Bill Modal ────────────────────────────────────────────── */
const PayBillModal = ({ bill, onClose, onPaid }) => {
  const [method,  setMethod]  = useState('');
  const [paying,  setPaying]  = useState(false);
  const [error,   setError]   = useState('');

  const handlePay = async () => {
    if (!method) { setError('Please select a payment method.'); return; }
    setPaying(true);
    setError('');
    try {
      const updated = await apiService.put(`/api/v1/bills/${bill.billCode}/pay`, { paymentMethod: method });
      onPaid(updated);
    } catch (err) {
      const d = err?.response?.data;
      setError(d?.message || 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-tx1">Pay Bill</h2>
            <p className="text-xs text-tx3 font-mono mt-0.5">{bill.billCode}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-tx3 hover:text-tx1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bill summary */}
        <div className="bg-surface/60 border border-border rounded-xl divide-y divide-border mb-5">
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-[12px] text-tx3">Appointment</span>
            <span className="text-[12px] font-mono text-indigo-400">{bill.appointmentCode}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-[12px] text-tx3">Patient</span>
            <span className="text-[13px] font-medium text-tx1">{bill.patientName}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-[12px] text-tx3">Doctor</span>
            <span className="text-[13px] text-tx2">{bill.doctorName}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-[12px] text-tx3">Consultation Fee</span>
            <span className="text-[13px] text-tx1">₹{bill.consultationFee}</span>
          </div>
          {parseFloat(bill.taxAmount) > 0 && (
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[12px] text-tx3">Tax</span>
              <span className="text-[13px] text-tx2">₹{bill.taxAmount}</span>
            </div>
          )}
          {parseFloat(bill.discountAmount) > 0 && (
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-[12px] text-tx3">Discount</span>
              <span className="text-[13px] text-emerald-400">−₹{bill.discountAmount}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-4 py-3 bg-indigo-500/5 rounded-b-xl">
            <span className="text-[13px] font-semibold text-tx1">Total Amount</span>
            <span className="text-[17px] font-bold text-indigo-400">₹{bill.totalAmount}</span>
          </div>
        </div>

        {/* Payment method selector */}
        <div className="mb-5">
          <label className="text-[11px] font-semibold text-tx3 uppercase tracking-wide mb-2 block">
            Payment Method <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map(m => (
              <button key={m.value} type="button"
                onClick={() => { setMethod(m.value); setError(''); }}
                className={`h-10 rounded-xl text-[12px] font-medium transition-colors border
                  ${method === m.value
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-surface border-border text-tx2 hover:border-indigo-500/60 hover:text-indigo-600 dark:hover:text-indigo-300'}`}>
                {m.label}
              </button>
            ))}
          </div>
          {error && <p className="text-[11px] text-rose-400 mt-2">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={paying}
            className="flex-1 h-10 rounded-xl text-[13px] font-medium text-tx2 border border-border hover:bg-surface transition-colors disabled:opacity-40">
            Cancel
          </button>
          <motion.button onClick={handlePay} disabled={paying} whileTap={{ scale: 0.97 }}
            className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {paying
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing…</>
              : <><CreditCard className="w-3.5 h-3.5" />Pay ₹{bill.totalAmount}</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─── Main component ────────────────────────────────────────────── */
const Billing = () => {
  const { theme } = useTheme();
  const location  = useLocation();

  // ── Tab / search state ─────────────────────────────────────────
  // searchInput: controlled value of the text field (what the user is typing)
  // searchTerm:  committed search that drives the API call (set on form submit / clear)
  const [billFilter,    setBillFilter]    = useState('ALL');
  const [searchInput,   setSearchInput]   = useState(location.state?.patientCode ?? '');
  const [searchTerm,    setSearchTerm]    = useState(location.state?.patientCode ?? '');

  // ── KPI / chart state ──────────────────────────────────────────
  const [kpiCards,      setKpiCards]      = useState(KPI_CONFIG.map(c => ({ ...c, value: '—', trend: 0, sub: '—' })));
  const [revenueTrend,  setRevenueTrend]  = useState([]);
  const [deptRevenue,   setDeptRevenue]   = useState([]);

  // ── Bills table state ──────────────────────────────────────────
  const [bills,         setBills]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [billsError,    setBillsError]    = useState('');
  const [payTarget,     setPayTarget]     = useState(null);
  const [page,          setPage]          = useState(0);
  const [totalPages,    setTotalPages]    = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  /* ── Load KPI / chart data once on mount ─────────────────────── */
  useEffect(() => {
    Promise.all([
      apiService.get('/api/v1/billing/stats').catch(() => null),
      apiService.get('/api/v1/billing/revenue-trend').catch(() => []),
      apiService.get('/api/v1/billing/department-revenue').catch(() => []),
    ]).then(([stats, revTrend, deptRev]) => {
      if (stats) {
        setKpiCards([
          { ...KPI_CONFIG[0], value: stats.totalRevenueFormatted ?? '—', trend: stats.revenueTrend   ?? 0, sub: stats.revenueSub   ?? '—' },
          { ...KPI_CONFIG[1], value: stats.pendingInvoices       ?? '—', trend: stats.pendingTrend   ?? 0, sub: stats.pendingSub   ?? '—' },
          { ...KPI_CONFIG[2], value: stats.collectedFormatted    ?? '—', trend: stats.collectedTrend ?? 0, sub: stats.collectedSub ?? '—' },
          { ...KPI_CONFIG[3], value: stats.overdueInvoices       ?? '—', trend: stats.overdueTrend   ?? 0, sub: stats.overdueSub   ?? '—' },
        ]);
      }
      if (Array.isArray(revTrend)) setRevenueTrend(revTrend);
      if (Array.isArray(deptRev)) {
        setDeptRevenue(deptRev.map((d, i) => ({ ...d, color: d.color ?? DEPT_COLORS[i % DEPT_COLORS.length] })));
      }
    });
  }, []);

  /* ── Server-side fetch — fires whenever search, tab, or page changes ── */
  useEffect(() => {
    const doFetch = async () => {
      setLoading(true);
      setBillsError('');
      try {
        const params = new URLSearchParams({ page, size: 10 });
        if (searchTerm.trim()) params.set('search', searchTerm.trim());
        if (billFilter !== 'ALL') params.set('status', billFilter);

        const data = await apiService.get(`/api/v1/bills?${params.toString()}`);
        const list = Array.isArray(data) ? data : (data?.content ?? []);
        setBills(list);
        setTotalPages(data?.totalPages ?? 0);
        setTotalElements(data?.totalElements ?? list.length);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 403) setBillsError('Access denied. Admin role required to view all bills.');
        else setBillsError('Failed to load bills. Please try again.');
        setBills([]);
        setTotalPages(0);
        setTotalElements(0);
      } finally {
        setLoading(false);
      }
    };
    doFetch();
  }, [searchTerm, billFilter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Commit search on form submit — resets tab and page to avoid stale results */
  const handleSearch = e => {
    e.preventDefault();
    setBillFilter('ALL');
    setPage(0);
    setSearchTerm(searchInput.trim());
  };

  /* Clear search — resets all filter state; useEffect auto-refetches */
  const handleClearSearch = () => {
    setSearchInput('');
    setBillsError('');
    setBillFilter('ALL');
    setPage(0);
    setSearchTerm('');
  };

  /* Tab change — resets page so we never land on an empty page */
  const handleTabChange = tab => {
    setBillFilter(tab);
    setPage(0);
  };

  /* Update the changed bill in-place without a full refetch */
  const handlePaid = updatedBill => {
    setBills(prev => prev.map(b => b.billCode === updatedBill.billCode ? updatedBill : b));
    setPayTarget(null);
  };

  const fmtDate = dt => dt
    ? new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const tickColor = theme === 'dark' ? '#475569' : '#94A3B8';

  /* Human-readable empty-state message based on active filters */
  const emptyMessage = () => {
    if (searchTerm && billFilter !== 'ALL')
      return `No ${billFilter.toLowerCase()} bills matching "${searchTerm}"`;
    if (searchTerm)
      return `No bills found for "${searchTerm}"`;
    if (billFilter !== 'ALL')
      return `No ${billFilter.toLowerCase()} bills found`;
    return 'No billing records in the system yet';
  };

  return (
    <motion.div variants={containerV} initial="initial" animate="animate">

      {/* ── Header ── */}
      <motion.div variants={itemV} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold text-tx1">Billing & Revenue</h1>
          <p className="text-sm text-tx3 mt-0.5">Financial overview and payment processing</p>
        </div>
        <button className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-medium border border-border text-tx2 hover:text-tx1 hover:bg-surface transition-colors">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </motion.div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {kpiCards.map((card) => {
          const Trend = card.trend >= 0 ? TrendingUp : TrendingDown;
          return (
            <motion.div key={card.label} variants={itemV}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className="bg-card border border-border rounded-2xl p-5 cursor-default">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} strokeWidth={2} />
                </div>
                <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full
                  ${card.trend >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'}`}>
                  <Trend className="w-3 h-3" />{Math.abs(card.trend)}%
                </span>
              </div>
              <div className="text-[1.5rem] font-bold text-tx1 mb-0.5 tabular-nums">{card.value}</div>
              <div className="text-[13px] font-medium text-tx2">{card.label}</div>
              <div className="text-[11px] text-tx3 mt-0.5">{card.sub}</div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Charts row ── */}
      {(revenueTrend.length > 0 || deptRevenue.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">

          {/* Revenue vs Expenses — 2/3 */}
          <motion.div variants={itemV} className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-[15px] font-semibold text-tx1">Revenue vs Expenses</h2>
                <p className="text-xs text-tx3 mt-0.5">Last 7 months</p>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-tx1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />Revenue</span>
                <span className="flex items-center gap-1.5 text-tx1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />Expenses</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueTrend} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F43F5E" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <Tooltip content={<RevenueTooltip />} cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }} />
                <Area type="monotone" dataKey="revenue"  stroke="#6366F1" strokeWidth={2}   fill="url(#revGradB)" dot={false} activeDot={{ r: 4, fill:'#6366F1', strokeWidth:0 }} />
                <Area type="monotone" dataKey="expenses" stroke="#F43F5E" strokeWidth={1.5} fill="url(#expGrad)"  dot={false} activeDot={{ r: 4, fill:'#F43F5E', strokeWidth:0 }} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Department revenue bar — 1/3 */}
          <motion.div variants={itemV} className="bg-card border border-border rounded-2xl p-5">
            <h2 className="text-[15px] font-semibold text-tx1 mb-1">By Department</h2>
            <p className="text-xs text-tx3 mb-4">Revenue breakdown</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptRevenue} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis type="number" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                <YAxis type="category" dataKey="dept" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<DeptTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={14}>
                  {deptRevenue.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      )}

      {/* ── Bills & Payments ── */}
      <motion.div variants={itemV} className="bg-card border border-border rounded-2xl overflow-hidden">

        {/* Search section */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3">
            <div>
              <h2 className="text-[15px] font-semibold text-tx1">Bills & Payments</h2>
              <p className="text-xs text-tx3 mt-0.5">
                {searchTerm
                  ? `Results for "${searchTerm}" — ${totalElements} found`
                  : `All bills — ${totalElements} total`}
              </p>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 h-10 bg-surface border border-border rounded-xl px-3 transition-all focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/10">
              <Search className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by bill, appointment, or patient code — e.g. BILL-2026-0001"
                className="flex-1 bg-transparent text-[13px] text-tx1 placeholder:text-tx3 outline-none min-w-0"
              />
              {searchInput && (
                <button type="button" onClick={handleClearSearch}
                  className="p-0.5 rounded hover:bg-rose-500/10 text-tx3 hover:text-rose-400 transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <motion.button type="submit" whileTap={{ scale: 0.97 }}
              disabled={loading}
              className="h-10 px-4 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {loading
                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Search className="w-3.5 h-3.5" />}
              Search
            </motion.button>
          </form>
        </div>

        {/* Filter tabs — always visible (server-side filtering, no stale client state) */}
        {!billsError && !loading && (
          <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-border">
            {['ALL', 'PENDING', 'PAID', 'CANCELLED'].map(f => (
              <button key={f} onClick={() => handleTabChange(f)}
                className={`h-8 px-3 rounded-lg text-[11px] font-medium transition-colors
                  ${billFilter === f ? 'bg-indigo-600 text-white' : 'bg-surface border border-border text-tx2 hover:text-tx1'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-tx3">
              {totalElements} bill{totalElements !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Content area */}
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : billsError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-[13px] font-medium text-rose-400">{billsError}</p>
            <button onClick={handleClearSearch}
              className="text-[12px] text-tx3 hover:text-tx2 transition-colors mt-1">
              Clear search
            </button>
          </div>
        ) : bills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-1">
            <p className="text-[13px] font-medium text-tx2">No bills found</p>
            <p className="text-[12px] text-tx3">{emptyMessage()}</p>
          </div>
        ) : (
          /* Bills table */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Bill / Appointment', 'Patient', 'Doctor', 'Amount', 'Generated', 'Payment Status', 'Action'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-tx3 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {bills.map((bill, i) => {
                    const ps     = PAY_STATUS_MAP[bill.paymentStatus] || PAY_STATUS_MAP.PENDING;
                    const canPay = bill.paymentStatus === 'PENDING' && bill.billStatus !== 'CANCELLED';
                    return (
                      <motion.tr
                        key={bill.billCode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-surface/70 transition-colors"
                      >
                        {/* Bill / Appointment codes */}
                        <td className="px-5 py-3.5">
                          <p className="font-mono text-[12px] font-semibold text-indigo-400">{bill.billCode}</p>
                          <p className="font-mono text-[10px] text-tx3 mt-0.5">{bill.appointmentCode}</p>
                        </td>

                        {/* Patient */}
                        <td className="px-5 py-3.5">
                          <p className="text-[13px] text-tx1">{bill.patientName}</p>
                          <p className="font-mono text-[10px] text-tx3">{bill.patientCode}</p>
                        </td>

                        {/* Doctor */}
                        <td className="px-5 py-3.5 text-[13px] text-tx2 whitespace-nowrap">{bill.doctorName}</td>

                        {/* Amount */}
                        <td className="px-5 py-3.5">
                          <p className="text-[14px] font-bold text-tx1">₹{bill.totalAmount}</p>
                          <p className="text-[10px] text-tx3">Fee ₹{bill.consultationFee}</p>
                        </td>

                        {/* Generated date */}
                        <td className="px-5 py-3.5 text-[12px] text-tx3 whitespace-nowrap">{fmtDate(bill.generatedAt)}</td>

                        {/* Payment status badge */}
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${ps.bg} ${ps.text}`}>
                            {ps.label}
                          </span>
                          {bill.paymentStatus === 'PAID' && bill.paidAt && (
                            <p className="text-[10px] text-tx3 mt-1">{fmtDate(bill.paidAt)}</p>
                          )}
                        </td>

                        {/* Action */}
                        <td className="px-5 py-3.5">
                          {canPay ? (
                            <motion.button
                              whileTap={{ scale: 0.96 }}
                              onClick={() => setPayTarget(bill)}
                              className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap">
                              <CreditCard className="w-3.5 h-3.5" />
                              Pay Now
                            </motion.button>
                          ) : bill.paymentStatus === 'PAID' ? (
                            <span className="text-[11px] text-tx3">
                              {bill.paymentMethod
                                ? bill.paymentMethod.charAt(0) + bill.paymentMethod.slice(1).toLowerCase()
                                : '—'}
                            </span>
                          ) : (
                            <span className={`text-[11px] font-medium ${BILL_STATUS_MAP[bill.billStatus]?.text ?? 'text-tx3'}`}>
                              {BILL_STATUS_MAP[bill.billStatus]?.label ?? '—'}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !billsError && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <span className="text-[12px] text-tx3">{totalElements} bills total</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="h-8 px-3 rounded-lg text-[12px] font-medium border border-border text-tx2 hover:text-tx1 hover:bg-surface transition-colors disabled:opacity-40">
                ← Prev
              </button>
              <span className="text-[12px] text-tx2 tabular-nums min-w-[60px] text-center">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="h-8 px-3 rounded-lg text-[12px] font-medium border border-border text-tx2 hover:text-tx1 hover:bg-surface transition-colors disabled:opacity-40">
                Next →
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Pay Bill Modal */}
      <AnimatePresence>
        {payTarget && (
          <PayBillModal
            bill={payTarget}
            onClose={() => setPayTarget(null)}
            onPaid={handlePaid}
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
};

export default Billing;
