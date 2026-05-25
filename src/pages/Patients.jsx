import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, X, ChevronLeft, ChevronRight,
  Droplets, Edit2, Trash2, Copy, Eye, EyeOff,
} from 'lucide-react';
import apiService from '../utils/apiService';

const PAGE_SIZE = 6;

/* ─── Helpers ────────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
];
const avatarColor = name => AVATAR_COLORS[((name || '?').charCodeAt(0)) % AVATAR_COLORS.length];
const initials    = name => (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('');
const calcAge     = dob  => {
  if (!dob) return '—';
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
};
const parseApiErrors = err => {
  const d = err?.response?.data;
  if (d?.errors && typeof d.errors === 'object') return d.errors;
  return { _general: d?.message || 'Something went wrong. Please try again.' };
};

/* ─── Shared small components ────────────────────────────────────── */
const StatusBadge = ({ status }) =>
  status === 'ACTIVE'
    ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />Active</span>
    : <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-500/15 text-slate-600 dark:text-slate-300"><span className="w-1.5 h-1.5 rounded-full bg-slate-500 dark:bg-slate-400" />Inactive</span>;

const FieldError = ({ errors, name }) =>
  errors?.[name] ? <p className="text-[11px] text-rose-400 mt-1">{errors[name]}</p> : null;

const inputCls = (errors, name) =>
  `w-full h-9 bg-surface border rounded-xl px-3 text-[13px] text-tx1 placeholder:text-tx3 outline-none
   focus:ring-2 focus:ring-indigo-500/20 transition-all
   ${errors?.[name] ? 'border-rose-500/60 focus:border-rose-500/60' : 'border-border focus:border-indigo-500/60'}`;

const SEL = 'w-full h-9 bg-surface border border-border rounded-xl px-3 text-[13px] text-tx1 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all';
const TA  = 'w-full bg-surface border border-border rounded-xl px-3 py-2 text-[13px] text-tx1 placeholder:text-tx3 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none';

const FormField = ({ label, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-semibold text-tx3 uppercase tracking-wide">
      {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

/* ─── Constants ──────────────────────────────────────────────────── */
const GENDERS      = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const EMPTY_FORM = {
  firstName: '', lastName: '', dateOfBirth: '', gender: 'MALE', bloodGroup: 'O+',
  phoneNumber: '', email: '',
  addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '',
  emergencyContactName: '', emergencyContactPhone: '',
  allergies: '', medicalHistory: '',
};

/* ─── Temp-password modal (shown after patient creation) ─────────── */
const TempPasswordModal = ({ data, onClose }) => {
  const [visible, setVisible] = useState(false);
  const [copied,  setCopied]  = useState('');

  const copy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-modal"
      >
        <div className="px-6 py-5">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
          <h2 className="text-base font-semibold text-tx1 text-center mb-1">Patient Registered</h2>
          <p className="text-xs text-tx3 text-center mb-5">Share these credentials securely with the patient</p>

          <div className="space-y-3">
            {[
              { key: 'code', label: 'Patient Code',    value: data.patientCode },
              { key: 'user', label: 'Username (Email)', value: data.username },
            ].map(item => (
              <div key={item.key} className="bg-surface rounded-xl p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-tx3 uppercase tracking-wide font-semibold mb-0.5">{item.label}</p>
                  <p className="text-[13px] font-mono text-tx1">{item.value}</p>
                </div>
                <button onClick={() => copy(item.value, item.key)} className="p-1.5 rounded-lg text-tx3 hover:text-tx1 hover:bg-card transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            <div className="bg-surface rounded-xl p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-tx3 uppercase tracking-wide font-semibold mb-0.5">Temporary Password</p>
                <p className="text-[13px] font-mono text-amber-400">{visible ? data.temporaryPassword : '••••••••••'}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setVisible(v => !v)} className="p-1.5 rounded-lg text-tx3 hover:text-tx1 hover:bg-card transition-colors">
                  {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => copy(data.temporaryPassword, 'pass')} className="p-1.5 rounded-lg text-tx3 hover:text-tx1 hover:bg-card transition-colors">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {copied && <p className="text-[11px] text-emerald-400 text-center mt-3">Copied to clipboard!</p>}

          <button onClick={onClose} className="w-full h-10 mt-5 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─── Confirm-deactivate modal ───────────────────────────────────── */
const ConfirmModal = ({ title, message, onConfirm, onClose, loading }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    onClick={e => e.target === e.currentTarget && onClose()}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.18 }}
      className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 shadow-modal"
    >
      <h3 className="text-base font-semibold text-tx1 mb-1">{title}</h3>
      <p className="text-sm text-tx3 mb-5">{message}</p>
      <div className="flex gap-3">
        <button onClick={onClose} disabled={loading}
          className="flex-1 h-10 rounded-xl text-[13px] font-medium text-tx2 border border-border hover:bg-surface transition-colors disabled:opacity-40">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Deactivate
        </button>
      </div>
    </motion.div>
  </motion.div>
);

/* ─── Patient form modal (add + edit) ────────────────────────────── */
const PatientFormModal = ({ initial, onClose, onSave }) => {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(isEdit ? {
    firstName: initial.firstName || '', lastName: initial.lastName || '',
    dateOfBirth: initial.dateOfBirth || '', gender: initial.gender || 'MALE',
    bloodGroup: initial.bloodGroup || 'O+', phoneNumber: initial.phoneNumber || '',
    email: initial.email || '', addressLine1: initial.addressLine1 || '',
    addressLine2: initial.addressLine2 || '', city: initial.city || '',
    state: initial.state || '', postalCode: initial.postalCode || '',
    emergencyContactName: initial.emergencyContactName || '',
    emergencyContactPhone: initial.emergencyContactPhone || '',
    allergies: initial.allergies || '', medicalHistory: initial.medicalHistory || '',
  } : { ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => { const n = { ...p }; delete n[k]; return n; });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await onSave(form);
    } catch (err) {
      setErrors(parseApiErrors(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-semibold text-tx1">{isEdit ? 'Edit Patient' : 'Register New Patient'}</h2>
            <p className="text-xs text-tx3 mt-0.5">{isEdit ? `Editing ${initial.fullName}` : 'Fill in the patient information below'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-tx3 hover:text-tx1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {errors._general && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-[13px] text-rose-400">
              {errors._general}
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name" required>
              <input className={inputCls(errors, 'firstName')} placeholder="John"
                value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
              <FieldError errors={errors} name="firstName" />
            </FormField>
            <FormField label="Last Name" required>
              <input className={inputCls(errors, 'lastName')} placeholder="Smith"
                value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
              <FieldError errors={errors} name="lastName" />
            </FormField>
          </div>

          {/* DOB + Gender */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date of Birth" required>
              <input type="date" className={inputCls(errors, 'dateOfBirth')}
                value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} required />
              <FieldError errors={errors} name="dateOfBirth" />
            </FormField>
            <FormField label="Gender" required>
              <select className={SEL} value={form.gender} onChange={e => set('gender', e.target.value)}>
                {GENDERS.map(g => <option key={g}>{g}</option>)}
              </select>
            </FormField>
          </div>

          {/* Blood + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Blood Group">
              <select className={SEL} value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
              </select>
            </FormField>
            <FormField label="Phone Number" required>
              <input type="tel" className={inputCls(errors, 'phoneNumber')} placeholder="10-digit number"
                value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} required />
              <FieldError errors={errors} name="phoneNumber" />
            </FormField>
          </div>

          {/* Email */}
          <FormField label="Email Address" required>
            <input type="email" className={inputCls(errors, 'email')} placeholder="john.smith@email.com"
              value={form.email} onChange={e => set('email', e.target.value)} required />
            <FieldError errors={errors} name="email" />
          </FormField>

          {/* Address */}
          <FormField label="Address Line 1" required>
            <input className={inputCls(errors, 'addressLine1')} placeholder="123 Main Street"
              value={form.addressLine1} onChange={e => set('addressLine1', e.target.value)} required />
            <FieldError errors={errors} name="addressLine1" />
          </FormField>
          <FormField label="Address Line 2">
            <input className={inputCls(errors, 'addressLine2')} placeholder="Apt 4B (optional)"
              value={form.addressLine2} onChange={e => set('addressLine2', e.target.value)} />
          </FormField>

          {/* City + State + Postal */}
          <div className="grid grid-cols-3 gap-3">
            <FormField label="City" required>
              <input className={inputCls(errors, 'city')} placeholder="Mumbai"
                value={form.city} onChange={e => set('city', e.target.value)} required />
              <FieldError errors={errors} name="city" />
            </FormField>
            <FormField label="State" required>
              <input className={inputCls(errors, 'state')} placeholder="Maharashtra"
                value={form.state} onChange={e => set('state', e.target.value)} required />
              <FieldError errors={errors} name="state" />
            </FormField>
            <FormField label="Postal Code" required>
              <input className={inputCls(errors, 'postalCode')} placeholder="6-digit code"
                value={form.postalCode} onChange={e => set('postalCode', e.target.value)} required />
              <FieldError errors={errors} name="postalCode" />
            </FormField>
          </div>

          {/* Emergency contact */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-tx3 uppercase tracking-wide mb-3">Emergency Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Contact Name" required>
                <input className={inputCls(errors, 'emergencyContactName')} placeholder="Jane Smith"
                  value={form.emergencyContactName} onChange={e => set('emergencyContactName', e.target.value)} required />
                <FieldError errors={errors} name="emergencyContactName" />
              </FormField>
              <FormField label="Contact Phone" required>
                <input type="tel" className={inputCls(errors, 'emergencyContactPhone')} placeholder="10-digit number"
                  value={form.emergencyContactPhone} onChange={e => set('emergencyContactPhone', e.target.value)} required />
                <FieldError errors={errors} name="emergencyContactPhone" />
              </FormField>
            </div>
          </div>

          {/* Medical info */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-tx3 uppercase tracking-wide mb-3">Medical Information</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Allergies">
                <textarea className={TA} rows={3} placeholder="e.g. Penicillin, Aspirin"
                  value={form.allergies} onChange={e => set('allergies', e.target.value)} />
              </FormField>
              <FormField label="Medical History">
                <textarea className={TA} rows={3} placeholder="e.g. Hypertension, Diabetes"
                  value={form.medicalHistory} onChange={e => set('medicalHistory', e.target.value)} />
              </FormField>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 h-10 rounded-xl text-[13px] font-medium text-tx2 border border-border hover:bg-surface transition-colors disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />{isEdit ? 'Saving…' : 'Registering…'}</>
                : isEdit ? 'Save Changes' : 'Register Patient'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

/* ─── Main component ─────────────────────────────────────────────── */
const Patients = () => {
  const [search,       setSearch]       = useState('');
  const [filter,       setFilter]       = useState('ALL');
  const [page,         setPage]         = useState(0);
  const [patients,     setPatients]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [tempPassData, setTempPassData] = useState(null);

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = () => {
    setLoading(true);
    setLoadError(null);
    apiService.get('/api/v1/patients?size=100')
      .then(data => setPatients(Array.isArray(data) ? data : (data?.content ?? [])))
      .catch(err => {
        setPatients([]);
        setLoadError(err?.response?.data?.message || 'Failed to load patients. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  const filtered = useMemo(() => {
    let list = patients;
    if (filter !== 'ALL') list = list.filter(p => p.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        (p.fullName    || '').toLowerCase().includes(q) ||
        (p.patientCode || '').toLowerCase().includes(q) ||
        (p.email       || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [patients, search, filter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleAdd = async form => {
    const res = await apiService.post('/api/v1/patients', form);
    setPatients(prev => [res.patient ?? res, ...prev]);
    setShowAdd(false);
    if (res.temporaryPassword) setTempPassData(res);
  };

  const handleEdit = async form => {
    const updated = await apiService.put(`/api/v1/patients/${editTarget.patientCode}`, form);
    setPatients(prev => prev.map(p => p.patientCode === editTarget.patientCode ? updated : p));
    setEditTarget(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const updated = await apiService.del(`/api/v1/patients/${deleteTarget.patientCode}`);
      setPatients(prev => prev.map(p => p.patientCode === deleteTarget.patientCode ? updated : p));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const containerV = { animate: { transition: { staggerChildren: 0.05 } } };
  const rowV       = { initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0 } };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

        {/* Load error banner */}
        {loadError && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><line x1="12" y1="8" x2="12" y2="12" strokeWidth="2"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2"/></svg>
            {loadError}
            <button onClick={loadPatients} className="ml-auto text-xs font-medium underline hover:no-underline">Retry</button>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-tx1">Patients</h1>
            <p className="text-sm text-tx3 mt-0.5">{filtered.length} records found</p>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Patient
          </motion.button>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx3 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search by name, code or email…"
              className="w-full h-10 bg-card border border-border rounded-xl pl-9 pr-4 text-[13px] text-tx1 placeholder:text-tx3
                focus:outline-none focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <div className="flex gap-2">
            {['ALL', 'ACTIVE', 'INACTIVE'].map(f => (
              <button key={f} onClick={() => { setFilter(f); setPage(0); }}
                className={`h-10 px-4 rounded-xl text-[12px] font-medium transition-colors whitespace-nowrap
                  ${filter === f ? 'bg-indigo-600 text-white' : 'bg-card border border-border text-tx2 hover:text-tx1 hover:border-indigo-500/40'}`}>
                {f === 'ALL' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Patient', 'Date of Birth', 'Blood', 'Phone', 'City', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-tx3 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <motion.tbody variants={containerV} initial="initial" animate="animate">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16">
                      <span className="inline-block w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                    </td>
                  </tr>
                ) : pageData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-tx3 text-sm">No patients found.</td>
                  </tr>
                ) : pageData.map((p, i) => (
                  <motion.tr key={p.patientCode} variants={rowV} transition={{ delay: i * 0.04 }}
                    className="border-b border-border last:border-0 hover:bg-slate-50 dark:hover:bg-surface/70 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColor(p.fullName)}`}>
                          {initials(p.fullName)}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-tx1">{p.fullName}</p>
                          <p className="text-[11px] font-mono text-tx3">{p.patientCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-tx2 whitespace-nowrap">
                      {p.dateOfBirth} · {calcAge(p.dateOfBirth)}y
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 text-[12px] font-semibold text-rose-400">
                        <Droplets className="w-3 h-3" />{p.bloodGroup || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-tx2 whitespace-nowrap">{p.phoneNumber}</td>
                    <td className="px-5 py-4 text-[13px] text-tx2">{p.city}</td>
                    <td className="px-5 py-4"><StatusBadge status={p.status} /></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditTarget(p)}
                          className="p-1.5 rounded-lg text-tx3 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {p.status === 'ACTIVE' && (
                          <button onClick={() => setDeleteTarget(p)}
                            className="p-1.5 rounded-lg text-tx3 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors" title="Deactivate">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-tx3">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-tx2 hover:text-tx1 hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  className={`w-8 h-8 rounded-lg text-[12px] font-medium transition-colors
                    ${i === page ? 'bg-indigo-600 text-white' : 'border border-border text-tx2 hover:bg-surface'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-border text-tx2 hover:text-tx1 hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showAdd && (
          <PatientFormModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
        )}
        {editTarget && (
          <PatientFormModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleEdit} />
        )}
        {deleteTarget && (
          <ConfirmModal
            title="Deactivate Patient"
            message={`Are you sure you want to deactivate ${deleteTarget.fullName}? Their account will be marked as inactive.`}
            onConfirm={handleDelete}
            onClose={() => setDeleteTarget(null)}
            loading={deleting}
          />
        )}
        {tempPassData && (
          <TempPasswordModal data={tempPassData} onClose={() => setTempPassData(null)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default Patients;
