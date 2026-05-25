/**
 * Navbar.jsx — MediFlow HMS Top Navigation Bar
 *
 * Sticky, glassmorphism header positioned to the right of the sidebar.
 * Features: search, notification bell with dropdown, theme toggle, profile menu.
 *
 * Props:
 *   sidebarWidth  {number}  — pixel width of current sidebar (64 or 240)
 *   onMenuClick   {fn}      — open mobile sidebar drawer
 *
 * @project MediFlow Hospital Management System
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Sun, Moon, Menu, ChevronDown,
         User, Settings, LogOut, Check } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import apiService from '../../utils/apiService';

/* ─── Dropdown fade variant ─────────────────────────────────────── */
const dropVariant = {
  hidden: { opacity: 0, y: -8, scale: 0.97 },
  show:   { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.18, ease: 'easeOut' } },
  exit:   { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12 } },
};

/* ─── Logout modal variant ───────────────────────────────────────── */
const modalVariant = {
  hidden: { opacity: 0, scale: 0.94, y: 8  },
  show:   { opacity: 1, scale: 1,    y: 0,  transition: { duration: 0.2, ease: 'easeOut' } },
  exit:   { opacity: 0, scale: 0.94, y: 8,  transition: { duration: 0.15 } },
};

/* ─── Hook: close on outside click ─────────────────────────────── */
const useClickOutside = (ref, handler) => {
  useEffect(() => {
    const listener = e => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
};

/* ─── Component ─────────────────────────────────────────────────── */
const Navbar = ({ sidebarWidth, onMenuClick }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const username = apiService.getUsername() || 'User';
  const initials = username.slice(0, 2).toUpperCase();

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut,      setIsLoggingOut]      = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiService.post('/api/v1/auth/logout', {});
    } catch (_) {
      // Token may already be expired — always clear local session
    } finally {
      apiService.clearSession();
      navigate('/login', { replace: true });
    }
  };

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    apiService.get('/api/v1/notifications')
      .then(data => setNotifications(data ?? []))
      .catch(() => setNotifications([]));
  }, []);

  const notifRef   = useRef(null);
  const profileRef = useRef(null);

  useClickOutside(notifRef,   () => setNotifOpen(false));
  useClickOutside(profileRef, () => setProfileOpen(false));

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(ns => ns.map(n => ({ ...n, read: true })));
    apiService.post('/api/v1/notifications/mark-all-read', {}).catch(() => {});
  };

  return (
    <>
    <header
      className="fixed top-0 right-0 z-20 h-16 flex items-center px-5 gap-4
                 bg-sidebar/80 glass border-b border-border
                 transition-all duration-300 ease-in-out"
      style={{ left: sidebarWidth }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl text-tx2 hover:text-tx1 hover:bg-surface transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-sm hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx3 pointer-events-none" />
        <input
          type="search"
          placeholder="Search patients, doctors, appointments…"
          className="w-full h-9 bg-surface border border-border rounded-xl
                     pl-9 pr-3 text-[13px] text-tx1 placeholder:text-tx3
                     focus:outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20
                     transition-all"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 ml-auto">

        {/* ── Theme toggle ── */}
        <motion.button
          onClick={toggleTheme}
          whileTap={{ scale: 0.9 }}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-tx2 hover:text-tx1 hover:bg-surface transition-colors"
          aria-label="Toggle theme"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={theme}
              initial={{ rotate: -30, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 30, opacity: 0 }} transition={{ duration: 0.2 }}>
              {theme === 'dark'
                ? <Sun  className="w-4.5 h-4.5" />
                : <Moon className="w-4.5 h-4.5" />
              }
            </motion.div>
          </AnimatePresence>
        </motion.button>

        {/* ── Notifications ── */}
        <div className="relative" ref={notifRef}>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl text-tx2 hover:text-tx1 hover:bg-surface transition-colors"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-sidebar" />
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                key="notif-drop"
                variants={dropVariant} initial="hidden" animate="show" exit="exit"
                className="absolute right-0 top-11 w-80 bg-card border border-border rounded-2xl shadow-modal overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold text-tx1">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                      <Check className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>

                {/* Items */}
                <div className="max-h-72 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id}
                      className={`flex gap-3 px-4 py-3 hover:bg-surface cursor-pointer transition-colors
                        ${!n.read ? 'border-l-2 border-indigo-500' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                        ${n.read ? 'bg-surface' : 'bg-indigo-500/15'}`}>
                        <Bell className={`w-3.5 h-3.5 ${n.read ? 'text-tx3' : 'text-indigo-400'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-tx1 truncate">{n.title}</p>
                        <p className="text-xs text-tx3 truncate mt-0.5">{n.body}</p>
                        <p className="text-[11px] text-tx3 mt-1">{n.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Profile menu ── */}
        <div className="relative ml-1" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1.5 rounded-xl hover:bg-surface transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <span className="text-[13px] font-medium text-tx1 hidden sm:block">{username}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-tx3 hidden sm:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                key="profile-drop"
                variants={dropVariant} initial="hidden" animate="show" exit="exit"
                className="absolute right-0 top-11 w-48 bg-card border border-border rounded-2xl shadow-modal overflow-hidden py-1"
              >
                <div className="px-3 py-2 border-b border-border mb-1">
                  <p className="text-xs font-semibold text-tx1">{username}</p>
                </div>
                {[
                  { icon: User,     label: 'My Profile' },
                  { icon: Settings, label: 'Settings'   },
                ].map(({ icon: Icon, label }) => (
                  <button key={label}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-tx2 hover:text-tx1 hover:bg-surface transition-colors">
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => { setLogoutConfirmOpen(true); setProfileOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/[0.12] transition-colors">
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>

      {/* ── Logout confirmation modal ── */}
      <AnimatePresence>
        {logoutConfirmOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => { if (!isLoggingOut) setLogoutConfirmOpen(false); }}
            />

            {/* Card */}
            <motion.div
              variants={modalVariant} initial="hidden" animate="show" exit="exit"
              className="relative w-80 bg-card border border-border rounded-2xl shadow-modal p-6 flex flex-col items-center gap-4"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-rose-400" />
              </div>

              {/* Text */}
              <div className="text-center">
                <h3 className="text-sm font-semibold text-tx1 mb-1">Sign Out</h3>
                <p className="text-xs text-tx3 leading-relaxed">
                  Are you sure you want to sign out of MediFlow?
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setLogoutConfirmOpen(false)}
                  disabled={isLoggingOut}
                  className="flex-1 h-9 rounded-xl border border-border text-[13px] text-tx2
                             hover:text-tx1 hover:bg-surface transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="flex-1 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20
                             text-[13px] text-rose-400 hover:bg-rose-500/20 transition-colors
                             disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {isLoggingOut ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                      Signing out…
                    </>
                  ) : (
                    'Yes, Sign Out'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
