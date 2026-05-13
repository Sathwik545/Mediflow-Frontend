/**
 * Billing.jsx — MediFlow HMS Billing & Revenue Page
 *
 * Features:
 *   - 4 revenue KPI cards
 *   - Revenue trend AreaChart (Recharts)
 *   - Department revenue BarChart
 *   - Invoice table with payment status badges
 *
 * @project MediFlow Hospital Management System
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  DollarSign, Clock, CheckCircle, AlertTriangle,
  TrendingUp, TrendingDown, Download,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

/* ─── Static UI config for KPI cards (icon / colour only) ──────── */
const KPI_CONFIG = [
  { label:'Total Revenue (YTD)',  icon: DollarSign,    iconBg:'bg-indigo-500/10', iconColor:'text-indigo-400'  },
  { label:'Pending Invoices',     icon: Clock,         iconBg:'bg-amber-500/10',  iconColor:'text-amber-400'   },
  { label:'Collected This Month', icon: CheckCircle,   iconBg:'bg-emerald-500/10',iconColor:'text-emerald-400' },
  { label:'Overdue Invoices',     icon: AlertTriangle, iconBg:'bg-rose-500/10',   iconColor:'text-rose-400'    },
];

/* ─── Dept revenue colours ──────────────────────────────────────── */
const DEPT_COLORS = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

/* ─── Status badge ──────────────────────────────────────────────── */
const STATUS_MAP = {
  PAID:    { label:'Paid',    bg:'bg-emerald-500/10', text:'text-emerald-400' },
  PENDING: { label:'Pending', bg:'bg-amber-500/10',   text:'text-amber-400'   },
  OVERDUE: { label:'Overdue', bg:'bg-rose-500/10',    text:'text-rose-400'    },
};

const PayBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.PENDING;
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

/* ─── Custom tooltips ───────────────────────────────────────────── */
const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-card-lg text-[12px]">
      <p className="text-tx3 mb-1.5 font-medium">{label}</p>
      <p className="text-indigo-400">Revenue: <span className="font-bold text-tx1">${payload[0]?.value?.toLocaleString()}</span></p>
      {payload[1] && <p className="text-rose-400">Expenses: <span className="font-bold text-tx1">${payload[1]?.value?.toLocaleString()}</span></p>}
    </div>
  );
};

const DeptTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-card-lg text-[12px]">
      <p className="text-tx3 mb-1">{label}</p>
      <p className="font-bold text-tx1">${payload[0]?.value?.toLocaleString()}</p>
    </div>
  );
};

/* ─── Animation variants ────────────────────────────────────────── */
const containerV = { animate: { transition: { staggerChildren: 0.07 } } };
const itemV = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } },
};

/* ─── Main component ────────────────────────────────────────────── */
const Billing = () => {
  const { theme } = useTheme();
  const [invoiceFilter, setInvoiceFilter] = useState('ALL');

  const [kpiCards,     setKpiCards]     = useState(KPI_CONFIG.map(c => ({ ...c, value: '—', trend: 0, sub: '—' })));
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [deptRevenue,  setDeptRevenue]  = useState([]);
  const [invoices,     setInvoices]     = useState([]);

  useEffect(() => {
    Promise.all([
      apiService.get('/api/v1/billing/stats').catch(() => null),
      apiService.get('/api/v1/billing/revenue-trend').catch(() => []),
      apiService.get('/api/v1/billing/department-revenue').catch(() => []),
      apiService.get('/api/v1/billing/invoices').catch(() => []),
    ]).then(([stats, revTrend, deptRev, invList]) => {
      if (stats) {
        setKpiCards([
          { ...KPI_CONFIG[0], value: stats.totalRevenueFormatted  ?? '—', trend: stats.revenueTrend      ?? 0, sub: stats.revenueSub      ?? '—' },
          { ...KPI_CONFIG[1], value: stats.pendingInvoices        ?? '—', trend: stats.pendingTrend      ?? 0, sub: stats.pendingSub      ?? '—' },
          { ...KPI_CONFIG[2], value: stats.collectedFormatted     ?? '—', trend: stats.collectedTrend    ?? 0, sub: stats.collectedSub    ?? '—' },
          { ...KPI_CONFIG[3], value: stats.overdueInvoices        ?? '—', trend: stats.overdueTrend      ?? 0, sub: stats.overdueSub      ?? '—' },
        ]);
      }
      if (Array.isArray(revTrend)) setRevenueTrend(revTrend);
      if (Array.isArray(deptRev)) {
        setDeptRevenue(deptRev.map((d, i) => ({ ...d, color: d.color ?? DEPT_COLORS[i % DEPT_COLORS.length] })));
      }
      const inv = Array.isArray(invList) ? invList : (invList?.content ?? []);
      setInvoices(inv);
    });
  }, []);

  const filteredInvoices = invoiceFilter === 'ALL'
    ? invoices
    : invoices.filter(inv => inv.status === invoiceFilter);

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const tickColor = theme === 'dark' ? '#475569' : '#94A3B8';

  return (
    <motion.div variants={containerV} initial="initial" animate="animate">

      {/* ── Header ── */}
      <motion.div variants={itemV} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
        <div>
          <h1 className="text-2xl font-bold text-tx1">Billing & Revenue</h1>
          <p className="text-sm text-tx3 mt-0.5">Financial overview</p>
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
                  ${card.trend >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
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
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">

        {/* Revenue vs Expenses — 2/3 */}
        <motion.div variants={itemV} className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-tx1">Revenue vs Expenses</h2>
              <p className="text-xs text-tx3 mt-0.5">Last 7 months</p>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-tx2"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />Revenue</span>
              <span className="flex items-center gap-1.5 text-tx2"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" />Expenses</span>
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
                tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
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
                tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="dept" tick={{ fill: tickColor, fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<DeptTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={14}>
                {deptRevenue.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Invoice table ── */}
      <motion.div variants={itemV} className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold text-tx1">Recent Invoices</h2>
            <p className="text-xs text-tx3 mt-0.5">{filteredInvoices.length} invoices</p>
          </div>
          <div className="flex gap-2">
            {['ALL', 'PAID', 'PENDING', 'OVERDUE'].map(f => (
              <button key={f} onClick={() => setInvoiceFilter(f)}
                className={`h-8 px-3 rounded-lg text-[11px] font-medium transition-colors
                  ${invoiceFilter === f ? 'bg-indigo-600 text-white' : 'bg-surface border border-border text-tx2 hover:text-tx1'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Invoice', 'Patient', 'Doctor', 'Amount', 'Date', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-tx3 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-tx3 text-sm">No invoices found.</td>
                </tr>
              ) : (
                filteredInvoices.map((inv, i) => (
                  <motion.tr key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-[12px] font-semibold text-indigo-400">{inv.id}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-tx1 whitespace-nowrap">{inv.patient}</td>
                    <td className="px-5 py-3.5 text-[13px] text-tx2 whitespace-nowrap">{inv.doctor}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-[14px] font-bold text-tx1">${inv.amount}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-tx3 whitespace-nowrap">{inv.date}</td>
                    <td className="px-5 py-3.5"><PayBadge status={inv.status} /></td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Billing;
