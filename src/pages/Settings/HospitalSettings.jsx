/**
 * HospitalSettings.jsx — Organization Configuration Page
 *
 * Single-record settings form for hospital identity, contact, address,
 * financial, and branding configuration.
 *
 * This data feeds future invoice / receipt PDF generation, notification
 * templates, and report headers — it must never be hardcoded elsewhere.
 *
 * @project MediFlow Hospital Management System
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Phone,
  MapPin,
  DollarSign,
  ImageIcon,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  Info,
} from 'lucide-react';
import apiService from '../../utils/apiService';
import { parseApiError } from '../../utils/errorHandler';

/* ─── Static option lists ──────────────────────────────────────────────────── */

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Dhaka',
  'Asia/Karachi',
  'Asia/Colombo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Pacific/Auckland',
  'UTC',
];

const CURRENCIES = [
  { code: 'INR', label: 'INR — Indian Rupee (₹)' },
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { code: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
];

/* ─── Initial empty form ───────────────────────────────────────────────────── */

const EMPTY_FORM = {
  hospitalName: '',
  hospitalCode: '',
  phoneNumber: '',
  alternatePhoneNumber: '',
  email: '',
  supportEmail: '',
  website: '',
  supportPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  logoUrl: '',
  gstNumber: '',
  currencyCode: 'INR',
  timezone: 'Asia/Kolkata',
};

/* ─── Animation variants ───────────────────────────────────────────────────── */

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  },
};

const sectionVariants = {
  initial: { opacity: 0, y: 14 },
  animate: (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.06, ease: [0.4, 0, 0.2, 1] },
  }),
};

const bannerVariants = {
  initial: { opacity: 0, y: -8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.2 } },
};

/* ─── Shared field components ──────────────────────────────────────────────── */

const Label = ({ htmlFor, children, required }) => (
  <label
    htmlFor={htmlFor}
    className="block text-xs font-medium text-tx2 mb-1.5"
  >
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

const FieldError = ({ message }) =>
  message ? (
    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
      {message}
    </p>
  ) : null;

const inputCls = (hasError) =>
  [
    'w-full px-3.5 py-2.5 text-sm text-tx1 bg-surface border rounded-xl',
    'placeholder:text-tx3 outline-none transition-colors duration-150',
    'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400/60',
    hasError ? 'border-red-400/70' : 'border-border',
  ].join(' ');

const selectCls = (hasError) =>
  [
    'w-full px-3.5 py-2.5 text-sm text-tx1 bg-surface border rounded-xl',
    'outline-none transition-colors duration-150 cursor-pointer',
    'focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400/60',
    hasError ? 'border-red-400/70' : 'border-border',
  ].join(' ');

/* ─── Section card ─────────────────────────────────────────────────────────── */

const Section = ({ icon: Icon, title, description, children, index }) => (
  <motion.div
    variants={sectionVariants}
    custom={index}
    initial="initial"
    animate="animate"
    className="bg-card border border-border rounded-2xl overflow-hidden"
  >
    {/* Section header */}
    <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
      <div className="w-8 h-8 rounded-lg bg-indigo-500/[0.12] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-indigo-500" strokeWidth={2} />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-tx1">{title}</h2>
        {description && (
          <p className="text-xs text-tx3 mt-0.5">{description}</p>
        )}
      </div>
    </div>

    {/* Section body */}
    <div className="p-6">{children}</div>
  </motion.div>
);

/* ─── Loading skeleton ─────────────────────────────────────────────────────── */

const SkeletonBlock = ({ h = 'h-10', w = 'w-full' }) => (
  <div className={`${h} ${w} rounded-xl bg-surface animate-pulse`} />
);

const LoadingSkeleton = () => (
  <div className="space-y-4">
    {[0, 1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <SkeletonBlock h="h-8" w="w-8" />
          <SkeletonBlock h="h-4" w="w-36" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><SkeletonBlock h="h-3" w="w-20" /><SkeletonBlock /></div>
          <div className="space-y-1.5"><SkeletonBlock h="h-3" w="w-24" /><SkeletonBlock /></div>
        </div>
      </div>
    ))}
  </div>
);

/* ─── Main component ───────────────────────────────────────────────────────── */

const HospitalSettings = () => {
  const [form, setForm]             = useState(EMPTY_FORM);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [globalError, setGlobalError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null); // { updatedBy, updatedAt }

  /* ── Map API response onto form state ── */
  const applyResponse = useCallback((data) => {
    setForm({
      hospitalName:          data.hospitalName          || '',
      hospitalCode:          data.hospitalCode          || '',
      phoneNumber:           data.phoneNumber           || '',
      alternatePhoneNumber:  data.alternatePhoneNumber  || '',
      email:                 data.email                 || '',
      supportEmail:          data.supportEmail          || '',
      website:               data.website               || '',
      supportPhone:          data.supportPhone          || '',
      addressLine1:          data.addressLine1          || '',
      addressLine2:          data.addressLine2          || '',
      city:                  data.city                  || '',
      state:                 data.state                 || '',
      postalCode:            data.postalCode            || '',
      country:               data.country               || '',
      logoUrl:               data.logoUrl               || '',
      gstNumber:             data.gstNumber             || '',
      currencyCode:          data.currencyCode          || 'INR',
      timezone:              data.timezone              || 'Asia/Kolkata',
    });
    if (data.updatedBy || data.updatedAt) {
      setLastUpdated({ updatedBy: data.updatedBy, updatedAt: data.updatedAt });
    }
  }, []);

  /* ── Fetch on mount ── */
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setGlobalError(null);
      try {
        const data = await apiService.get('/api/v1/settings/hospital');
        applyResponse(data);
      } catch (err) {
        const { message } = parseApiError(err);
        setGlobalError(message || 'Failed to load hospital settings. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [applyResponse]);

  /* ── Field change handler ── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (saveSuccess) setSaveSuccess(false);
  };

  /* ── Save handler ── */
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setGlobalError(null);
    setFieldErrors({});
    setSaveSuccess(false);

    // Build payload — trim required, nullify blank optionals
    const payload = {
      hospitalName:         form.hospitalName.trim(),
      hospitalCode:         form.hospitalCode.trim(),
      currencyCode:         form.currencyCode.trim(),
      timezone:             form.timezone.trim(),
      phoneNumber:          form.phoneNumber.trim()          || null,
      alternatePhoneNumber: form.alternatePhoneNumber.trim() || null,
      email:                form.email.trim()                || null,
      supportEmail:         form.supportEmail.trim()         || null,
      website:              form.website.trim()              || null,
      supportPhone:         form.supportPhone.trim()         || null,
      addressLine1:         form.addressLine1.trim()         || null,
      addressLine2:         form.addressLine2.trim()         || null,
      city:                 form.city.trim()                 || null,
      state:                form.state.trim()                || null,
      postalCode:           form.postalCode.trim()           || null,
      country:              form.country.trim()              || null,
      logoUrl:              form.logoUrl.trim()              || null,
      gstNumber:            form.gstNumber.trim()            || null,
    };

    try {
      const data = await apiService.put('/api/v1/settings/hospital', payload);
      applyResponse(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      const { message, errors } = parseApiError(err);
      setGlobalError(message || 'Failed to save settings. Please check the form and try again.');
      if (errors) setFieldErrors(errors);
    } finally {
      setSaving(false);
    }
  };

  /* ── Helpers ── */
  const field = (name) => ({
    id:       name,
    name:     name,
    value:    form[name],
    onChange: handleChange,
    disabled: loading || saving,
  });

  const fe = (name) => fieldErrors[name];

  /* ── Render ── */
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      className="min-h-full"
    >
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-tx1">Hospital Settings</h1>
          <p className="text-sm text-tx2 mt-0.5">
            Organization configuration — used by invoices, reports, and notifications
          </p>
        </div>

        {/* Last updated badge */}
        {lastUpdated && (
          <div className="flex items-center gap-2 text-xs text-tx3 bg-surface border border-border rounded-xl px-3 py-2 self-start">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span>
              Last saved
              {lastUpdated.updatedAt && (
                <> on <strong className="text-tx2">{lastUpdated.updatedAt.slice(0, 10)}</strong></>
              )}
              {lastUpdated.updatedBy && (
                <> by <strong className="text-tx2">{lastUpdated.updatedBy}</strong></>
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Success banner ── */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            key="success"
            variants={bannerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex items-center gap-3 bg-emerald-500/[0.1] border border-emerald-500/30 rounded-xl px-4 py-3 mb-5"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-600" style={{ color: 'var(--tw-prose-body, #059669)' }}>
              Hospital settings saved successfully.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error banner ── */}
      <AnimatePresence>
        {globalError && (
          <motion.div
            key="error"
            variants={bannerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex items-start gap-3 bg-red-500/[0.08] border border-red-400/30 rounded-xl px-4 py-3 mb-5"
          >
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-500">{globalError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Skeleton while loading ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : (
        <form onSubmit={handleSave} noValidate>
          <div className="space-y-4">

            {/* ── Section 1: Organization Identity ── */}
            <Section
              icon={Building2}
              title="Organization Identity"
              description="Core identifiers used on all invoices, reports, and PDF exports"
              index={0}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="hospitalName" required>Hospital Name</Label>
                  <input
                    {...field('hospitalName')}
                    type="text"
                    placeholder="MediFlow Hospital"
                    className={inputCls(!!fe('hospitalName'))}
                    autoComplete="organization"
                  />
                  <FieldError message={fe('hospitalName')} />
                </div>

                <div>
                  <Label htmlFor="hospitalCode" required>Hospital Code</Label>
                  <input
                    {...field('hospitalCode')}
                    type="text"
                    placeholder="MEDIFLOW"
                    className={inputCls(!!fe('hospitalCode'))}
                    style={{ textTransform: 'uppercase' }}
                    onBlur={(e) =>
                      setForm((p) => ({ ...p, hospitalCode: e.target.value.toUpperCase() }))
                    }
                  />
                  <FieldError message={fe('hospitalCode')} />
                  <p className="text-xs text-tx3 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    Uppercase letters, digits, hyphens, and underscores only
                  </p>
                </div>
              </div>
            </Section>

            {/* ── Section 2: Contact Information ── */}
            <Section
              icon={Phone}
              title="Contact Information"
              description="Primary and support contact details for the hospital"
              index={1}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phoneNumber">Primary Phone</Label>
                  <input
                    {...field('phoneNumber')}
                    type="tel"
                    placeholder="+91 98765 43210"
                    className={inputCls(!!fe('phoneNumber'))}
                  />
                  <FieldError message={fe('phoneNumber')} />
                </div>

                <div>
                  <Label htmlFor="alternatePhoneNumber">Alternate Phone</Label>
                  <input
                    {...field('alternatePhoneNumber')}
                    type="tel"
                    placeholder="+91 98765 43211"
                    className={inputCls(!!fe('alternatePhoneNumber'))}
                  />
                  <FieldError message={fe('alternatePhoneNumber')} />
                </div>

                <div>
                  <Label htmlFor="email">Official Email</Label>
                  <input
                    {...field('email')}
                    type="email"
                    placeholder="contact@mediflow.com"
                    className={inputCls(!!fe('email'))}
                    autoComplete="email"
                  />
                  <FieldError message={fe('email')} />
                </div>

                <div>
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <input
                    {...field('supportEmail')}
                    type="email"
                    placeholder="support@mediflow.com"
                    className={inputCls(!!fe('supportEmail'))}
                    autoComplete="email"
                  />
                  <FieldError message={fe('supportEmail')} />
                </div>

                <div>
                  <Label htmlFor="supportPhone">Support Phone</Label>
                  <input
                    {...field('supportPhone')}
                    type="tel"
                    placeholder="+91 1800 000 000"
                    className={inputCls(!!fe('supportPhone'))}
                  />
                  <FieldError message={fe('supportPhone')} />
                </div>

                <div>
                  <Label htmlFor="website">Website</Label>
                  <input
                    {...field('website')}
                    type="url"
                    placeholder="https://mediflow.com"
                    className={inputCls(!!fe('website'))}
                    autoComplete="url"
                  />
                  <FieldError message={fe('website')} />
                </div>
              </div>
            </Section>

            {/* ── Section 3: Address ── */}
            <Section
              icon={MapPin}
              title="Address"
              description="Hospital physical address — printed on invoices and receipts"
              index={2}
            >
              <div className="space-y-4">
                <div>
                  <Label htmlFor="addressLine1">Address Line 1</Label>
                  <input
                    {...field('addressLine1')}
                    type="text"
                    placeholder="123 Healthcare Avenue, Medical District"
                    className={inputCls(!!fe('addressLine1'))}
                    autoComplete="address-line1"
                  />
                  <FieldError message={fe('addressLine1')} />
                </div>

                <div>
                  <Label htmlFor="addressLine2">Address Line 2</Label>
                  <input
                    {...field('addressLine2')}
                    type="text"
                    placeholder="Floor 3, Wing B (optional)"
                    className={inputCls(!!fe('addressLine2'))}
                    autoComplete="address-line2"
                  />
                  <FieldError message={fe('addressLine2')} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <input
                      {...field('city')}
                      type="text"
                      placeholder="Hyderabad"
                      className={inputCls(!!fe('city'))}
                      autoComplete="address-level2"
                    />
                    <FieldError message={fe('city')} />
                  </div>

                  <div>
                    <Label htmlFor="state">State / Province</Label>
                    <input
                      {...field('state')}
                      type="text"
                      placeholder="Telangana"
                      className={inputCls(!!fe('state'))}
                      autoComplete="address-level1"
                    />
                    <FieldError message={fe('state')} />
                  </div>

                  <div>
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <input
                      {...field('postalCode')}
                      type="text"
                      placeholder="500032"
                      className={inputCls(!!fe('postalCode'))}
                      autoComplete="postal-code"
                    />
                    <FieldError message={fe('postalCode')} />
                  </div>

                  <div>
                    <Label htmlFor="country">Country</Label>
                    <input
                      {...field('country')}
                      type="text"
                      placeholder="India"
                      className={inputCls(!!fe('country'))}
                      autoComplete="country-name"
                    />
                    <FieldError message={fe('country')} />
                  </div>
                </div>
              </div>
            </Section>

            {/* ── Section 4: Financial Settings ── */}
            <Section
              icon={DollarSign}
              title="Financial & Legal"
              description="Tax registration, currency, and timezone for billing and reports"
              index={3}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <input
                    {...field('gstNumber')}
                    type="text"
                    placeholder="22AAAAA0000A1Z5"
                    className={inputCls(!!fe('gstNumber'))}
                    maxLength={15}
                    style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                    onBlur={(e) =>
                      setForm((p) => ({ ...p, gstNumber: e.target.value.toUpperCase() }))
                    }
                  />
                  <FieldError message={fe('gstNumber')} />
                  <p className="text-xs text-tx3 mt-1">15-character Indian GST number (optional)</p>
                </div>

                <div>
                  <Label htmlFor="currencyCode" required>Currency</Label>
                  <select
                    {...field('currencyCode')}
                    className={selectCls(!!fe('currencyCode'))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={fe('currencyCode')} />
                </div>

                <div className="sm:col-span-2">
                  <Label htmlFor="timezone" required>Timezone</Label>
                  <select
                    {...field('timezone')}
                    className={selectCls(!!fe('timezone'))}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                  <FieldError message={fe('timezone')} />
                  <p className="text-xs text-tx3 mt-1">
                    Used for scheduling, billing timestamps, and PDF report dates
                  </p>
                </div>
              </div>
            </Section>

            {/* ── Section 5: Branding ── */}
            <Section
              icon={ImageIcon}
              title="Branding"
              description="Visual identity used on invoices, receipts, and patient-facing documents"
              index={4}
            >
              <div>
                <Label htmlFor="logoUrl">Logo URL</Label>
                <input
                  {...field('logoUrl')}
                  type="url"
                  placeholder="https://mediflow.com/logo.png"
                  className={inputCls(!!fe('logoUrl'))}
                />
                <FieldError message={fe('logoUrl')} />
                <p className="text-xs text-tx3 mt-1">
                  Publicly accessible URL to the hospital logo (PNG or SVG recommended, min 200×200 px)
                </p>
              </div>

              {/* Logo preview */}
              {form.logoUrl && (
                <div className="mt-4 flex items-center gap-4 p-4 bg-surface border border-border rounded-xl">
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="w-14 h-14 rounded-lg object-contain bg-white border border-border"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div>
                    <p className="text-xs font-medium text-tx1">Logo preview</p>
                    <p className="text-xs text-tx3 mt-0.5 break-all max-w-xs">{form.logoUrl}</p>
                  </div>
                </div>
              )}
            </Section>

            {/* ── Save bar ── */}
            <motion.div
              variants={sectionVariants}
              custom={5}
              initial="initial"
              animate="animate"
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card border border-border rounded-2xl px-6 py-4"
            >
              <div className="flex items-start gap-2.5 text-xs text-tx3">
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-500" />
                <span>
                  Changes apply immediately. Invoice PDFs and reports will reflect
                  updated settings on the next generation.
                </span>
              </div>

              <button
                type="submit"
                disabled={saving || loading}
                className={[
                  'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium',
                  'bg-indigo-600 text-white transition-all duration-150 flex-shrink-0',
                  saving || loading
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:bg-indigo-700 active:scale-[0.98]',
                ].join(' ')}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </motion.div>

          </div>
        </form>
      )}
    </motion.div>
  );
};

export default HospitalSettings;
