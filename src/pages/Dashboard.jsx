/**
 * Dashboard.jsx — MediFlow HMS Overview Dashboard
 *
 * Sections:
 *   1. Page header (greeting + date)
 *   2. KPI stat cards  — animated counters, trend indicators
 *   3. Charts row      — Revenue AreaChart + Appointment distribution PieChart
 *   4. Recent appointments table
 *
 * @project MediFlow Hospital Management System
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, Stethoscope, Calendar, DollarSign,
  TrendingUp, TrendingDown, ArrowRight,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../utils/apiService';

/* ─── Chart colour mapping for appointment distribution ────────── */
const APPT_COLOR_MAP = {
  PAYMENT_PENDING: '#F59E0B',
  CONFIRMED:       '#3B82F6',
  IN_PROGRESS:     '#8B5CF6',
  COMPLETED:       '#10B981',
  CANCELLED:       '#F43F5E',
  NO_SHOW:         '#64748B',
  Completed:       '#10B981',
  'In Progress':   '#8B5CF6',
  Cancelled:       '#F43F5E',
};
const APPT_COLORS_FALLBACK = ['#10B981', '#3B82F6', '#8B5CF6', '#F43F5E'];

/* ─── Static UI config for KPI cards (icon / colour only) ──────── */
const KPI_CONFIG = [
  { label: 'Total Patients',        prefix: '', suffix: '', icon: Users,       iconBg: 'bg-indigo-500/15',  iconColor: 'text-indigo-400'  },
  { label: 'Active Doctors',        prefix: '', suffix: '', icon: Stethoscope, iconBg: 'bg-cyan-500/15',    iconColor: 'text-cyan-400'    },
  { label: "Today's Appointments",  prefix: '', suffix: '', icon: Calendar,    iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400' },
  { label: 'Monthly Revenue',       prefix: '$',suffix: '', icon: DollarSign,  iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-400'   },
];

/* ─── Helpers ───────────────────────────────────────────────────── */

const STATUS_MAP = {
  PAYMENT_PENDING: { label: 'Payment Pending', bg: 'bg-amber-50   dark:bg-amber-500/15',   text: 'text-amber-700   dark:text-amber-300',   dot: 'bg-amber-500   dark:bg-amber-400'   },
  CONFIRMED:       { label: 'Confirmed',        bg: 'bg-blue-50    dark:bg-blue-500/15',    text: 'text-blue-700    dark:text-blue-300',    dot: 'bg-blue-500    dark:bg-blue-400'    },
  IN_PROGRESS:     { label: 'In Progress',      bg: 'bg-purple-50  dark:bg-purple-500/15',  text: 'text-purple-700  dark:text-purple-300',  dot: 'bg-purple-500  dark:bg-purple-400'  },
  COMPLETED:       { label: 'Completed',        bg: 'bg-emerald-50 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  CANCELLED:       { label: 'Cancelled',        bg: 'bg-rose-50    dark:bg-rose-500/15',    text: 'text-rose-700    dark:text-rose-300',    dot: 'bg-rose-500    dark:bg-rose-400'    },
  NO_SHOW:         { label: 'No Show',          bg: 'bg-slate-100  dark:bg-slate-500/15',   text: 'text-slate-600   dark:text-slate-300',   dot: 'bg-slate-500   dark:bg-slate-400'   },
};

const TYPE_MAP = {
  IN_PERSON: { label: 'In-Person', bg: 'bg-slate-100 dark:bg-slate-500/15', text: 'text-slate-600 dark:text-slate-300' },
  ONLINE:    { label: 'Online',    bg: 'bg-cyan-50   dark:bg-cyan-500/15',  text: 'text-cyan-700  dark:text-cyan-300'  },
  FOLLOW_UP: { label: 'Follow-up', bg: 'bg-purple-50 dark:bg-purple-500/15',text: 'text-purple-700 dark:text-purple-300'},
};

const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.PAYMENT_PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
};

/* ─── Animated counter hook ─────────────────────────────────────── */
const useCountUp = (end, duration = 1600) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null;
    const step = ts => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(eased * end));
      if (p < 1) requestAnimationFrame(step);
      else setVal(end);
    };
    const id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [end, duration]);
  return val;
};

/* ─── Custom Recharts tooltip ───────────────────────────────────── */
const RevenueTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2.5 shadow-card-lg">
      <p className="text-[11px] text-tx3 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-tx1">${payload[0].value.toLocaleString()}</p>
    </div>
  );
};

/* ─── Framer Motion variants ────────────────────────────────────── */
const containerV = { animate: { transition: { staggerChildren: 0.07 } } };
const itemV = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ─── KPI Card ──────────────────────────────────────────────────── */
const KpiCard = ({ card }) => {
  const count = useCountUp(card.value);
  const Trend = card.trend >= 0 ? TrendingUp : TrendingDown;
  return (
    <motion.div
      variants={itemV}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="bg-card border border-border rounded-2xl p-5 cursor-default select-none"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
          <card.icon className={`w-5 h-5 ${card.iconColor}`} strokeWidth={2} />
        </div>
        <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full
          ${card.trend >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'}`}>
          <Trend className="w-3 h-3" />
          {Math.abs(card.trend)}%
        </span>
      </div>
      <div className="text-[1.7rem] font-bold text-tx1 leading-none mb-1 tabular-nums">
        {card.prefix}{count.toLocaleString()}{card.suffix}
      </div>
      <div className="text-[13px] font-medium text-tx2">{card.label}</div>
      <div className="text-[11px] text-tx3 mt-0.5">{card.sub}</div>
    </motion.div>
  );
};

/* ─── Main component ────────────────────────────────────────────── */
const Dashboard = () => {
  const { theme } = useTheme();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const [kpiCards,    setKpiCards]    = useState(KPI_CONFIG.map(c => ({ ...c, value: 0, trend: 0, sub: '—' })));
  const [revenueData, setRevenueData] = useState([]);
  const [apptDist,    setApptDist]    = useState([]);
  const [recentAppts, setRecentAppts] = useState([]);

  useEffect(() => {
    Promise.all([
      apiService.get('/api/v1/dashboard/stats').catch(err => {
        console.error('[Dashboard] Stats API failed:', err?.response?.data?.message || err.message);
        return null;
      }),
      apiService.get('/api/v1/dashboard/revenue-trend').catch(() => []),
      apiService.get('/api/v1/dashboard/appointment-distribution').catch(() => []),
      apiService.get('/api/v1/appointments?page=0&size=5').catch(err => {
        console.error('[Dashboard] Appointments API failed:', err?.response?.data?.message || err.message);
        return [];
      }),
    ]).then(([stats, revTrend, dist, appts]) => {
      if (stats) {
        setKpiCards([
          { ...KPI_CONFIG[0], value: stats.totalPatients      ?? 0, trend: stats.patientTrend      ?? 0, sub: stats.patientSub      ?? '—' },
          { ...KPI_CONFIG[1], value: stats.activeDoctors      ?? 0, trend: stats.doctorTrend       ?? 0, sub: stats.doctorSub       ?? '—' },
          { ...KPI_CONFIG[2], value: stats.todayAppointments  ?? 0, trend: stats.appointmentTrend  ?? 0, sub: stats.appointmentSub  ?? '—' },
          { ...KPI_CONFIG[3], value: stats.monthlyRevenue     ?? 0, trend: stats.revenueTrend      ?? 0, sub: stats.revenueSub      ?? '—' },
        ]);
      }
      if (Array.isArray(revTrend)) setRevenueData(revTrend);
      if (Array.isArray(dist)) {
        setApptDist(dist.map((d, i) => ({
          ...d,
          color: APPT_COLOR_MAP[d.name] ?? APPT_COLORS_FALLBACK[i % APPT_COLORS_FALLBACK.length],
        })));
      }
      const apptList = Array.isArray(appts) ? appts : (appts?.content ?? []);
      setRecentAppts(apptList);
    });
  }, []);

  const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const tickColor = theme === 'dark' ? '#475569' : '#64748B';

  return (
    <motion.div variants={containerV} initial="initial" animate="animate">

      {/* ── Page header ── */}
      <motion.div variants={itemV} className="mb-7">
        <h1 className="text-2xl font-bold text-tx1">Dashboard</h1>
        <p className="text-sm text-tx3 mt-0.5">{today}</p>
      </motion.div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {kpiCards.map(card => <KpiCard key={card.label} card={card} />)}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">

        {/* Revenue area chart — 2/3 width */}
        <motion.div variants={itemV} className="xl:col-span-2 bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-semibold text-tx1">Revenue Trend</h2>
              <p className="text-xs text-tx3 mt-0.5">Last 7 months</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {kpiCards[3]?.trend ?? 0}%
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.30} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="month" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<RevenueTooltip />} cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area type="monotone" dataKey="revenue" stroke="#6366F1" strokeWidth={2.5}
                fill="url(#revGrad)" dot={false} activeDot={{ r: 5, fill: '#6366F1', strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Appointment distribution donut — 1/3 width */}
        <motion.div variants={itemV} className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-[15px] font-semibold text-tx1 mb-1">Appointment Status</h2>
          <p className="text-xs text-tx3 mb-4">Current month breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={apptDist} cx="50%" cy="50%"
                innerRadius={52} outerRadius={74} paddingAngle={3} dataKey="value">
                {apptDist.map((d, i) => <Cell key={i} fill={d.color} strokeWidth={0} />)}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} contentStyle={{
                background: 'var(--c-card)', border: '1px solid var(--c-border)',
                borderRadius: 12, fontSize: 12, color: 'var(--c-tx1)',
              }} />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="space-y-2 mt-2">
            {apptDist.map(d => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-tx2">{d.name}</span>
                </div>
                <span className="font-semibold text-tx1">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Recent appointments table ── */}
      <motion.div variants={itemV} className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-[15px] font-semibold text-tx1">Recent Appointments</h2>
            <p className="text-xs text-tx3 mt-0.5">Today · {recentAppts.length} records</p>
          </div>
          <Link to="/appointments"
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {['Appointment', 'Patient', 'Doctor', 'Time', 'Type', 'Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-tx3 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentAppts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-tx3 text-sm">No recent appointments.</td>
                </tr>
              ) : (
                recentAppts.map((a, i) => {
                  const tm = TYPE_MAP[a.consultationType] || TYPE_MAP.IN_PERSON;
                  return (
                    <motion.tr
                      key={a.appointmentCode}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.06 }}
                      className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-surface/70 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-[11px] font-medium text-tx2">{a.appointmentCode}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-medium text-tx1">{a.patientName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] text-tx1">{a.doctorName}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[13px] font-mono text-tx2">{a.startTime}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${tm.bg} ${tm.text}`}>
                          {tm.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={a.appointmentStatus} />
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
