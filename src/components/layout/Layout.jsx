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
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import Navbar  from './Navbar';

/* Pixel widths must match Sidebar animation targets */
const W_EXPANDED  = 240;
const W_COLLAPSED = 64;

/* Page transition variants */
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -4, transition: { duration: 0.18 } },
};

const Layout = () => {
  const [collapsed,    setCollapsed]    = useState(false);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const location = useLocation();

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

      {/* Main content — offset to avoid sidebar + navbar */}
      <motion.main
        animate={{ paddingLeft: sw }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="pt-16 min-h-screen"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="p-5 lg:p-7 max-w-[1600px]"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </motion.main>
    </div>
  );
};

export default Layout;
