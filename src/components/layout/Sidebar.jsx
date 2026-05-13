/**
 * Sidebar.jsx — MediFlow HMS Collapsible Navigation Sidebar
 *
 * Desktop: fixed left, 240 px expanded / 64 px collapsed (icon-only).
 * Mobile:  hidden by default, slides in as a drawer when isMobileOpen=true.
 *
 * Props:
 *   isCollapsed    {boolean}  — controlled by parent (Layout)
 *   onToggle       {fn}       — toggle collapse state
 *   isMobileOpen   {boolean}  — controls mobile drawer visibility
 *   onMobileClose  {fn}       — close mobile drawer
 *
 * @project MediFlow Hospital Management System
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Stethoscope, Calendar,
  CreditCard, BarChart3, Bell, Settings,
  ChevronLeft, Activity,
} from 'lucide-react';

/* ─── Navigation item definitions ─────────────────────────────── */
const NAV_MAIN = [
  { path: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { path: '/patients',     label: 'Patients',     icon: Users           },
  { path: '/doctors',      label: 'Doctors',      icon: Stethoscope     },
  { path: '/appointments', label: 'Appointments', icon: Calendar        },
  { path: '/billing',      label: 'Billing',      icon: CreditCard      },
  { path: '/reports',      label: 'Reports',      icon: BarChart3       },
  { path: '/notifications',label: 'Notifications',icon: Bell            },
];

const NAV_BOTTOM = [
  { path: '/settings', label: 'Settings', icon: Settings },
];

/* ─── Animation variants ───────────────────────────────────────── */
const labelVariants = {
  show: { opacity: 1, x: 0,   transition: { duration: 0.18 } },
  hide: { opacity: 0, x: -8,  transition: { duration: 0.12 } },
};

/* ─── Single nav link ──────────────────────────────────────────── */
const NavLink = ({ item, isCollapsed, onClick }) => {
  const location = useLocation();
  const isActive  = location.pathname === item.path ||
    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      onClick={onClick}
      title={isCollapsed ? item.label : undefined}
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-xl
        transition-colors duration-150 group select-none
        ${isActive
          ? 'text-indigo-400 bg-indigo-500/[0.12]'
          : 'text-tx2 hover:text-tx1 hover:bg-white/[0.05] dark:hover:bg-white/[0.06]'
        }
      `}
    >
      {/* Animated active indicator bar */}
      {isActive && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-full"
          transition={{ type: 'spring', bounce: 0.12, duration: 0.45 }}
        />
      )}

      <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.span
            key="label"
            variants={labelVariants}
            initial="hide"
            animate="show"
            exit="hide"
            className="text-[13px] font-medium whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  );
};

/* ─── Main component ───────────────────────────────────────────── */
const Sidebar = ({ isCollapsed, onToggle, isMobileOpen, onMobileClose }) => {
  const w = isCollapsed ? 64 : 240;

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={onMobileClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <motion.aside
        animate={{ width: w }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className={`
          fixed top-0 left-0 z-40 h-screen flex flex-col overflow-hidden
          bg-sidebar border-r border-border
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 transition-transform duration-300 lg:transition-none
        `}
      >
        {/* ── Logo + collapse toggle ── */}
        <div className="flex items-center justify-between px-3 h-16 border-b border-border flex-shrink-0">
          <AnimatePresence initial={false} mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="full"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-2.5"
              >
                {/* Brand icon */}
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-sm font-bold text-tx1 tracking-tight">MediFlow</span>
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mx-auto"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapse toggle — desktop only */}
          {!isCollapsed && (
            <button
              onClick={onToggle}
              className="hidden lg:flex w-7 h-7 rounded-lg items-center justify-center text-tx3 hover:text-tx1 hover:bg-surface transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ── Main navigation ── */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
          {/* Expand button when collapsed */}
          {isCollapsed && (
            <button
              onClick={onToggle}
              className="w-full flex justify-center p-2.5 rounded-xl text-tx3 hover:text-tx1 hover:bg-white/[0.06] transition-colors mb-2"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
          )}

          {NAV_MAIN.map(item => (
            <NavLink
              key={item.path}
              item={item}
              isCollapsed={isCollapsed}
              onClick={onMobileClose}
            />
          ))}
        </nav>

        {/* ── Bottom: Settings ── */}
        <div className="px-2 pb-3 pt-2 border-t border-border space-y-0.5 flex-shrink-0">
          {NAV_BOTTOM.map(item => (
            <NavLink
              key={item.path}
              item={item}
              isCollapsed={isCollapsed}
              onClick={onMobileClose}
            />
          ))}
        </div>
      </motion.aside>
    </>
  );
};

export default Sidebar;
