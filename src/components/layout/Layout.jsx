/**
 * Layout.jsx — MediFlow HMS Main Layout Shell
 *
 * Renders Sidebar + Navbar + Outlet (page content).
 * Manages sidebar collapse state so both sidebar width and
 * main content padding stay in sync via the `sw` variable.
 *
 * @project MediFlow Hospital Management System
 */

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Navbar  from './Navbar';

/* Pixel widths must match Sidebar animation targets */
const W_EXPANDED  = 240;
const W_COLLAPSED = 64;

const Layout = () => {
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);

  const sw = collapsed ? W_COLLAPSED : W_EXPANDED;

  return (
    <div className="min-h-screen bg-page">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Navbar — pushed right by sidebar width */}
      <Navbar
        sidebarWidth={sw}
        onMenuClick={() => setMobileOpen(true)}
      />

      {/* Main content — offset to avoid sidebar + navbar.
          Each page component owns its own entry animation via motion.div variants.
          AnimatePresence is intentionally absent here: wrapping <Outlet> in
          AnimatePresence causes the dynamic Outlet to mount the incoming page inside
          the exiting wrapper (because React Router context updates immediately),
          resulting in double-mount and double API calls on every navigation. */}
      <motion.main
        animate={{ paddingLeft: sw }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="pt-16 min-h-screen"
      >
        <div className="p-5 lg:p-7 max-w-[1600px]">
          <Outlet />
        </div>
      </motion.main>
    </div>
  );
};

export default Layout;
