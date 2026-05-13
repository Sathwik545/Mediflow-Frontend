import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Edit2, Trash2, DollarSign, Briefcase, Copy, Eye, EyeOff } from 'lucide-react';
import apiService from '../utils/apiService';

/* ─── Helpers ────────────────────────────────────────────────────── */
const AVATAR_COLORS = [
  'bg-indigo-500/20 text-indigo-300', 'bg-cyan-500/20 text-cyan-300',
  'bg-emerald-500/20 text-emerald-300', 'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300', 'bg-purple-500/20 text-purple-300',
];
const avatarColor = name => AVATAR_COLORS[((name || '?').charCodeAt(0)) % AVATAR_COLORS.length];
const initials    = name => (name || '?').replace('Dr. ', '').split(' ').map(n => n[0]).slice(0, 2).join('');

const parseApiErrors = err => {
  const d = err?.response?.data;
  if (d?.errors && typeof d.errors === 'object') return d.errors;
  return { _general: d?.message || 'Something went wrong. Please try again.' };
};

const STATUS_MAP = {
  ACTIVE:   { label: 'Active',   bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  ON_LEAVE: { label: 'On Leave', bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-500'   },
  INACTIVE: { label: 'Inactive', bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-500'   },
};

/* ─── Shared small components ────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.INACTIVE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
};

const SummaryItem = ({ label, value, color }) => (
  <div className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center gap-3">
    <div className={`w-2 h-8 rounded-full ${color}`} />
    <div>
      <p className="text-xl font-bold text-tx1">{value}</p>
      <p className="text-xs text-tx3">{label}</p>
    </div>
  </div>
);

const FieldError = ({ errors, name }) =>
  errors?.[name] ? <p className="text-[11px] text-rose-400 mt-1">{errors[name]}</p> : null;

const inputCls = (errors, name) =>
  `w-full h-9 bg-surface border rounded-xl px-3 text-[13px] text-tx1 placeholder:text-tx3 outline-none
   focus:ring-2 focus:ring-indigo-500/10 transition-all
   ${errors?.[name] ? 'border-rose-500/60 focus:border-rose-500/60' : 'border-border focus:border-indigo-500/60'}`;

const FormField = ({ label, required, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-semibold text-tx3 uppercase tracking-wide">
      {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

/* ─── Constants ──────────────────────────────────────────────────── */
const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phoneNumber: '',
  specialization: '', qualification: '', yearsOfExperience: '',
  consultationFee: '', licenseNumber: '', department: '', status: 'ACTIVE',
};

/* ─── Temp-password modal (shown after doctor creation) ──────────── */
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
          <h2 className="text-base font-semibold text-tx1 text-center mb-1">Doctor Registered</h2>
          <p className="text-xs text-tx3 text-center mb-5">Share these credentials securely with the doctor</p>

          <div className="space-y-3">
            {[
              { key: 'code', label: 'Doctor Code',     value: data.doctorCode },
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

/* ─── Doctor form modal (add + edit) ─────────────────────────────── */
const DoctorFormModal = ({ initial, onClose, onSave }) => {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(isEdit ? {
    firstName:         initial.firstName         || '',
    lastName:          initial.lastName          || '',
    email:             initial.email             || '',
    phoneNumber:       initial.phoneNumber       || '',
    specialization:    initial.specialization    || '',
    qualification:     initial.qualification     || '',
    yearsOfExperience: String(initial.yearsOfExperience ?? ''),
    consultationFee:   String(initial.consultationFee   ?? ''),
    licenseNumber:     initial.licenseNumber     || '',
    department:        initial.department        || '',
    status:            initial.status            || 'ACTIVE',
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
      await onSave({
        ...form,
        yearsOfExperience: Number(form.yearsOfExperience),
        consultationFee:   Number(form.consultationFee),
      });
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
        className="bg-card border border-border rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-base font-semibold text-tx1">{isEdit ? 'Edit Doctor' : 'Register New Doctor'}</h2>
            <p className="text-xs text-tx3 mt-0.5">{isEdit ? `Editing ${initial.fullName}` : 'Fill in the doctor information below'}</p>
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
              <input className={inputCls(errors, 'firstName')} placeholder="Rajesh"
                value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
              <FieldError errors={errors} name="firstName" />
            </FormField>
            <FormField label="Last Name" required>
              <input className={inputCls(errors, 'lastName')} placeholder="Kumar"
                value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
              <FieldError errors={errors} name="lastName" />
            </FormField>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Email" required>
              <input type="email" className={inputCls(errors, 'email')} placeholder="doctor@hospital.com"
                value={form.email} onChange={e => set('email', e.target.value)} required />
              <FieldError errors={errors} name="email" />
            </FormField>
            <FormField label="Phone Number" required>
              <input type="tel" className={inputCls(errors, 'phoneNumber')} placeholder="10-digit number"
                value={form.phoneNumber} onChange={e => set('phoneNumber', e.target.value)} required />
              <FieldError errors={errors} name="phoneNumber" />
            </FormField>
          </div>

          {/* Specialization + Department */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Specialization" required>
              <input className={inputCls(errors, 'specialization')} placeholder="Cardiology"
                value={form.specialization} onChange={e => set('specialization', e.target.value)} required />
              <FieldError errors={errors} name="specialization" />
            </FormField>
            <FormField label="Department" required>
              <input className={inputCls(errors, 'department')} placeholder="Cardiology"
                value={form.department} onChange={e => set('department', e.target.value)} required />
              <FieldError errors={errors} name="department" />
            </FormField>
          </div>

          {/* Qualification */}
          <FormField label="Qualification" required>
            <input className={inputCls(errors, 'qualification')} placeholder="MBBS, MD"
              value={form.qualification} onChange={e => set('qualification', e.target.value)} required />
            <FieldError errors={errors} name="qualification" />
          </FormField>

          {/* Exp + Fee */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Years of Experience" required>
              <input type="number" min="0" max="60"
                className={inputCls(errors, 'yearsOfExperience')} placeholder="e.g. 10"
                value={form.yearsOfExperience} onChange={e => set('yearsOfExperience', e.target.value)} required />
              <FieldError errors={errors} name="yearsOfExperience" />
            </FormField>
            <FormField label="Consultation Fee (₹)" required>
              <input type="number" min="1" step="0.01"
                className={inputCls(errors, 'consultationFee')} placeholder="e.g. 500.00"
                value={form.consultationFee} onChange={e => set('consultationFee', e.target.value)} required />
              <FieldError errors={errors} name="consultationFee" />
            </FormField>
          </div>

          {/* License */}
          <FormField label="License Number" required>
            <input className={inputCls(errors, 'licenseNumber')} placeholder="MH-12345"
              value={form.licenseNumber}
              onChange={e => set('licenseNumber', e.target.value.toUpperCase())} required />
            <FieldError errors={errors} name="licenseNumber" />
          </FormField>

          {/* Status — edit only */}
          {isEdit && (
            <FormField label="Status" required>
              <select
                className={inputCls(errors, 'status')}
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <FieldError errors={errors} name="status" />
            </FormField>
          )}

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
                : isEdit ? 'Save Changes' : 'Register Doctor'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

/* ─── Doctor card ────────────────────────────────────────────────── */
const DoctorCard = ({ doc, index, onEdit, onDelete }) => {
  const ac  = avatarColor(doc.fullName);
  const ini = initials(doc.fullName);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.32 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 group
                 hover:border-indigo-500/25 hover:shadow-glow-indigo transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${ac}`}>
            {ini}
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-tx1 leading-tight">{doc.fullName}</h3>
            <p className="text-[12px] text-indigo-400 font-medium mt-0.5">{doc.specialization}</p>
          </div>
        </div>
        <StatusBadge status={doc.status} />
      </div>

      {/* Info tiles */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface rounded-xl p-3">
          <p className="text-[10px] text-tx3 font-medium uppercase tracking-wide mb-1">Department</p>
          <p className="text-[12px] font-semibold text-tx1 leading-snug">{doc.department}</p>
        </div>
        <div className="bg-surface rounded-xl p-3">
          <p className="text-[10px] text-tx3 font-medium uppercase tracking-wide mb-1">Qualification</p>
          <p className="text-[12px] font-semibold text-tx1">{doc.qualification}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[12px] border-t border-border pt-3">
        <div className="flex items-center gap-1.5 text-tx2">
          <Briefcase className="w-3.5 h-3.5 text-tx3" />{doc.yearsOfExperience} yrs exp
        </div>
        <div className="flex items-center gap-1.5 font-semibold text-tx1">
          <DollarSign className="w-3.5 h-3.5 text-amber-400" />₹{doc.consultationFee}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(doc)}
            className="p-1.5 rounded-lg text-tx3 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Edit">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {doc.status === 'ACTIVE' && (
            <button onClick={() => onDelete(doc)}
              className="p-1.5 rounded-lg text-tx3 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Deactivate">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Main component ─────────────────────────────────────────────── */
const Doctors = () => {
  const [filter,       setFilter]       = useState('ALL');
  const [search,       setSearch]       = useState('');
  const [doctors,      setDoctors]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAdd,      setShowAdd]      = useState(false);
  const [editTarget,   setEditTarget]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [tempPassData, setTempPassData] = useState(null);

  useEffect(() => { loadDoctors(); }, []);

  const loadDoctors = () => {
    setLoading(true);
    apiService.get('/api/v1/doctors?size=100')
      .then(data => setDoctors(Array.isArray(data) ? data : (data?.content ?? [])))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  };

  const stats = useMemo(() => ({
    total:    doctors.length,
    active:   doctors.filter(d => d.status === 'ACTIVE').length,
    onLeave:  doctors.filter(d => d.status === 'ON_LEAVE').length,
    inactive: doctors.filter(d => d.status === 'INACTIVE').length,
  }), [doctors]);

  const filtered = useMemo(() => {
    let list = doctors;
    if (filter !== 'ALL') list = list.filter(d => d.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        (d.fullName       || '').toLowerCase().includes(q) ||
        (d.specialization || '').toLowerCase().includes(q) ||
        (d.department     || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, search, doctors]);

  const handleAdd = async form => {
    const res = await apiService.post('/api/v1/doctors', form);
    setDoctors(prev => [res.doctor ?? res, ...prev]);
    setShowAdd(false);
    if (res.temporaryPassword) setTempPassData(res);
  };

  const handleEdit = async form => {
    const updated = await apiService.put(`/api/v1/doctors/${editTarget.doctorCode}`, form);
    setDoctors(prev => prev.map(d => d.doctorCode === editTarget.doctorCode ? updated : d));
    setEditTarget(null);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const updated = await apiService.del(`/api/v1/doctors/${deleteTarget.doctorCode}`);
      setDoctors(prev => prev.map(d => d.doctorCode === deleteTarget.doctorCode ? updated : d));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-tx1">Doctors</h1>
            <p className="text-sm text-tx3 mt-0.5">{filtered.length} doctors shown</p>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Doctor
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <SummaryItem label="Total Doctors" value={stats.total}    color="bg-indigo-500" />
          <SummaryItem label="Active"         value={stats.active}   color="bg-emerald-500" />
          <SummaryItem label="On Leave"       value={stats.onLeave}  color="bg-amber-500" />
          <SummaryItem label="Inactive"       value={stats.inactive} color="bg-slate-500" />
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tx3 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or specialization…"
              className="w-full h-10 bg-card border border-border rounded-xl pl-9 pr-4 text-[13px] text-tx1 placeholder:text-tx3
                focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all" />
          </div>
          <div className="flex gap-2">
            {[['ALL','All'], ['ACTIVE','Active'], ['ON_LEAVE','On Leave'], ['INACTIVE','Inactive']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                className={`h-10 px-3.5 rounded-xl text-[12px] font-medium transition-colors whitespace-nowrap
                  ${filter === v ? 'bg-indigo-600 text-white' : 'bg-card border border-border text-tx2 hover:border-indigo-500/40'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-tx3">No doctors match your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((doc, i) => (
              <DoctorCard key={doc.doctorCode} doc={doc} index={i} onEdit={setEditTarget} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {showAdd && (
          <DoctorFormModal onClose={() => setShowAdd(false)} onSave={handleAdd} />
        )}
        {editTarget && (
          <DoctorFormModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleEdit} />
        )}
        {deleteTarget && (
          <ConfirmModal
            title="Deactivate Doctor"
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

export default Doctors;
