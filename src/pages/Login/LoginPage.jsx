/**
 * LoginPage.jsx — MediFlow HMS Authentication Page
 *
 * Redesigned: premium enterprise SaaS aesthetic.
 * All authentication logic, API integration, and form validation preserved.
 *
 * @project MediFlow Hospital Management System
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Lock, Eye, EyeOff, Activity,
  Shield, Users, Calendar, Check,
  AlertCircle, X, TrendingUp,
} from 'lucide-react';
import apiService from '../../utils/apiService';
import { parseApiError } from '../../utils/errorHandler';
import './LoginPage.css';

// ─── Static Data ───────────────────────────────────────────────────────────────

const HOSPITAL_STATS = [
  { value: '12,480', label: 'Active Patients',    icon: Users       },
  { value: '340+',   label: 'Specialists',         icon: Activity    },
  { value: '850',    label: 'Appts / day',          icon: Calendar    },
];

const FEATURES = [
  'Patient Record Management',
  'Real-time Analytics Dashboard',
  'HIPAA Compliant & Encrypted',
  'Multi-department Coordination',
];

const PREVIEW_METRICS = [
  { label: 'Emergency',  value: '12',  change: '+2',  status: 'up'   },
  { label: 'In-Patient', value: '248', change: '+18', status: 'up'   },
  { label: 'Discharged', value: '34',  change: '-5',  status: 'down' },
];

const PREVIEW_BARS = [38, 62, 44, 78, 53, 68, 82, 58, 72, 88, 63, 79];

// ─── Framer Motion Variants ────────────────────────────────────────────────────

const ease = [0.22, 1, 0.36, 1];

const containerVariants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const itemVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.55, ease } },
};

// ─── Component ────────────────────────────────────────────────────────────────

const LoginPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (apiService.isAuthenticated()) navigate('/dashboard', { replace: true });
  }, [navigate]);

  const [formData, setFormData]       = useState({ usernameOrEmail: '', password: '' });
  const [showPassword, setShowPwd]    = useState(false);
  const [rememberMe, setRememberMe]   = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [apiError, setApiError]       = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isShaking, setIsShaking]     = useState(false);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 620);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (fieldErrors[name]) setFieldErrors((p) => ({ ...p, [name]: '' }));
    if (apiError) setApiError(null);
  };

  const validate = () => {
    const e = {};
    if (!formData.usernameOrEmail.trim())
      e.usernameOrEmail = 'Email or username is required.';
    else if (formData.usernameOrEmail.trim().length < 3)
      e.usernameOrEmail = 'Must be at least 3 characters.';
    if (!formData.password)                e.password = 'Password is required.';
    else if (formData.password.length < 6) e.password = 'Password must be at least 6 characters.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); triggerShake(); return; }

    setIsLoading(true);
    setApiError(null);
    try {
      const data = await apiService.post('/api/v1/auth/login', {
        usernameOrEmail: formData.usernameOrEmail.trim(),
        password:        formData.password,
      });
      apiService.setAuthToken(data.accessToken);
      apiService.setRefreshToken(data.refreshToken);
      apiService.setUsername(data.username);
      // Store the full profile so role-scoped pages (ConsultationList etc.) can
      // choose the correct API endpoint without an extra round-trip.
      apiService.setStoredUser(data);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.status === 401) {
        parsed.message = err.response?.data?.message || 'Invalid username or password.';
      }
      setApiError(parsed);
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      className="lp-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* ── Background orbs ── */}
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />
      <div className="lp-orb lp-orb--3" />
      <div className="lp-orb lp-orb--4" />
      <div className="lp-bg-grid" />

      <div className="lp-layout">

        {/* ══════════════════════════════════════════════
            LEFT PANEL — Branding + Dashboard Preview
            ══════════════════════════════════════════════ */}
        <motion.section
          className="lp-left"
          aria-hidden="true"
          initial={{ opacity: 0, x: -36 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75, ease }}
        >
          <div className="lp-left-overlay" />
          <div className="lp-left-grid" />

          {/* Floating ambient shapes */}
          <div className="lp-shape lp-shape--1" />
          <div className="lp-shape lp-shape--2" />
          <div className="lp-shape lp-shape--3" />
          <div className="lp-shape lp-shape--4" />

          <motion.div
            className="lp-left-content"
            variants={containerVariants}
            initial="initial"
            animate="animate"
          >
            {/* ── Badge ── */}
            <motion.div className="lp-badge" variants={itemVariants}>
              <span className="lp-badge-dot" />
              Enterprise HMS · v1.0
            </motion.div>

            {/* ── Logo ── */}
            <motion.div className="lp-logo-wrap" variants={itemVariants}>
              <span className="lp-logo-ring lp-logo-ring--outer" />
              <span className="lp-logo-ring lp-logo-ring--inner" />
              <div className="lp-logo-icon">
                <Activity size={34} strokeWidth={2} />
              </div>
            </motion.div>

            <motion.h1 className="lp-brand-name" variants={itemVariants}>
              MediFlow
            </motion.h1>
            <motion.p className="lp-brand-tagline" variants={itemVariants}>
              Smart Healthcare Management Platform
            </motion.p>

            {/* ── Dashboard Preview Card ── */}
            <motion.div className="lp-preview-card" variants={itemVariants}>
              <div className="lp-preview-header">
                <div className="lp-preview-header-left">
                  <TrendingUp size={13} className="lp-preview-header-icon" />
                  <span className="lp-preview-title">Live Overview</span>
                </div>
                <span className="lp-preview-live">
                  <span className="lp-preview-dot" />
                  Live
                </span>
              </div>

              <div className="lp-preview-metrics">
                {PREVIEW_METRICS.map((m, i) => (
                  <div key={i} className="lp-preview-metric">
                    <span className="lp-preview-metric-label">{m.label}</span>
                    <div className="lp-preview-metric-right">
                      <span className="lp-preview-metric-value">{m.value}</span>
                      <span className={`lp-preview-change lp-preview-change--${m.status}`}>
                        {m.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="lp-preview-chart">
                {PREVIEW_BARS.map((h, i) => (
                  <div
                    key={i}
                    className="lp-preview-bar"
                    style={{ '--h': `${h}%`, '--i': i }}
                  />
                ))}
              </div>
            </motion.div>

            {/* ── Stats ── */}
            <motion.div className="lp-stats" variants={itemVariants}>
              {HOSPITAL_STATS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="lp-stat-card">
                    <Icon className="lp-stat-icon" size={15} strokeWidth={1.8} />
                    <span className="lp-stat-value">{s.value}</span>
                    <span className="lp-stat-label">{s.label}</span>
                  </div>
                );
              })}
            </motion.div>

            {/* ── Features ── */}
            <motion.ul className="lp-features" variants={itemVariants}>
              {FEATURES.map((f, i) => (
                <li key={i} className="lp-feature-item">
                  <span className="lp-feature-check">
                    <Check size={10} strokeWidth={3.2} />
                  </span>
                  {f}
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </motion.section>

        {/* ══════════════════════════════════════════════
            RIGHT PANEL — Login Card
            ══════════════════════════════════════════════ */}
        <section className="lp-right">
          <motion.div
            className={`lp-card ${isShaking ? 'lp-card--shake' : ''}`}
            initial={{ opacity: 0, x: 36, y: 18 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.72, delay: 0.1, ease }}
          >
            {/* Outer glow ring */}
            <div className="lp-card-glow" />
            {/* Top inner shimmer */}
            <div className="lp-card-shimmer" />

            {/* ── Header ── */}
            <div className="lp-card-header">
              <div className="lp-card-logo">
                <Activity size={22} strokeWidth={2.2} />
              </div>
              <h2 className="lp-card-title">Welcome Back</h2>
              <p className="lp-card-subtitle">Sign in to your MediFlow account</p>
            </div>

            {/* ── Error Banner ──
                Maps to backend ApiResponse: { message, errors:{field:msg} } */}
            <AnimatePresence>
              {apiError && (
                <motion.div
                  className="lp-error-banner"
                  role="alert"
                  initial={{ opacity: 0, y: -12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <AlertCircle className="lp-error-icon" size={15} />
                  <div className="lp-error-body">
                    <p className="lp-error-msg">{apiError.message}</p>
                    {apiError.errors && Object.keys(apiError.errors).length > 0 && (
                      <ul className="lp-error-fields">
                        {Object.entries(apiError.errors).map(([field, msg]) => (
                          <li key={field}><strong>{field}:</strong> {msg}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    className="lp-error-close"
                    type="button"
                    onClick={() => setApiError(null)}
                    aria-label="Dismiss"
                  >
                    <X size={12} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Form ── */}
            <form className="lp-form" onSubmit={handleSubmit} noValidate>

              {/* Username / Email */}
              <div className={`lp-field-group ${fieldErrors.usernameOrEmail ? 'lp-field-group--error' : ''}`}>
                <label className="lp-label" htmlFor="usernameOrEmail">Email or Username</label>
                <div className="lp-input-wrap">
                  <User className="lp-field-icon" size={16} strokeWidth={1.8} />
                  <input
                    id="usernameOrEmail"
                    name="usernameOrEmail"
                    type="text"
                    className="lp-input"
                    placeholder="Email or username"
                    value={formData.usernameOrEmail}
                    onChange={handleChange}
                    autoComplete="username"
                    disabled={isLoading}
                  />
                </div>
                <AnimatePresence>
                  {fieldErrors.usernameOrEmail && (
                    <motion.span
                      className="lp-field-error"
                      role="alert"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {fieldErrors.usernameOrEmail}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Password */}
              <div className={`lp-field-group ${fieldErrors.password ? 'lp-field-group--error' : ''}`}>
                <label className="lp-label" htmlFor="password">Password</label>
                <div className="lp-input-wrap">
                  <Lock className="lp-field-icon" size={16} strokeWidth={1.8} />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    className="lp-input"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="lp-eye-btn"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword
                      ? <EyeOff size={16} strokeWidth={1.8} />
                      : <Eye    size={16} strokeWidth={1.8} />
                    }
                  </button>
                </div>
                <AnimatePresence>
                  {fieldErrors.password && (
                    <motion.span
                      className="lp-field-error"
                      role="alert"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {fieldErrors.password}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {/* Options row */}
              <div className="lp-form-options">
                <label className="lp-checkbox-label">
                  <input
                    type="checkbox"
                    className="lp-checkbox-input"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span className="lp-checkbox-box" />
                  <span className="lp-checkbox-text">Remember me</span>
                </label>
                <button type="button" className="lp-forgot-btn">Forgot password?</button>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                className={`lp-submit-btn ${isLoading ? 'lp-submit-btn--loading' : ''}`}
                disabled={isLoading}
                whileHover={!isLoading ? { y: -2, scale: 1.014 } : {}}
                whileTap={!isLoading ? { scale: 0.984, y: 0 } : {}}
                transition={{ type: 'spring', stiffness: 440, damping: 22 }}
              >
                <span className="lp-btn-content">
                  {isLoading ? (
                    <><span className="lp-spinner" aria-hidden="true" />Signing In…</>
                  ) : (
                    'Sign In to MediFlow'
                  )}
                </span>
                {!isLoading && <span className="lp-btn-shimmer" aria-hidden="true" />}
              </motion.button>
            </form>

            {/* ── Card footer ── */}
            <div className="lp-card-footer">
              <p className="lp-support-text">
                Need access?{' '}
                <a href="mailto:it@mediflow.hospital" className="lp-support-link">
                  Contact IT Support
                </a>
              </p>
              <div className="lp-security-badges">
                <Shield size={11} />
                <span>MediFlow HMS · Secure · Encrypted</span>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </motion.div>
  );
};

export default LoginPage;
