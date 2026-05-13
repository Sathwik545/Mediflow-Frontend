import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, Plus, X, Video, MapPin, RotateCcw,
  CheckCircle, XCircle, Search, User, Stethoscope,
  ChevronDown, CheckCircle2,
} from 'lucide-react';
import apiService from '../utils/apiService';

/* ─── Display maps ───────────────────────────────────────────────── */
const STATUS_MAP = {
  SCHEDULED:   { label: 'Scheduled',   bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  dot: 'bg-indigo-500'  },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-amber-500/10',   text: 'text-amber-400',   dot: 'bg-amber-500'   },
  COMPLETED:   { label: 'Completed',   bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  CANCELLED:   { label: 'Cancelled',   bg: 'bg-rose-500/10',    text: 'text-rose-400',    dot: 'bg-rose-500'    },
  NO_SHOW:     { label: 'No Show',     bg: 'bg-slate-500/10',   text: 'text-slate-400',   dot: 'bg-slate-500'   },
};
const TYPE_MAP = {
  IN_PERSON: { label: 'In-Person', icon: MapPin,    bg: 'bg-slate-500/10',  text: 'text-slate-400'  },
  ONLINE:    { label: 'Online',    icon: Video,     bg: 'bg-cyan-500/10',   text: 'text-cyan-400'   },
  FOLLOW_UP: { label: 'Follow-up', icon: RotateCcw, bg: 'bg-purple-500/10', text: 'text-purple-400' },
};

/* ─── Helpers ────────────────────────────────────────────────────── */
const fmtTime    = t => (t || '').slice(0, 5);
const fmtTime12  = t => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 === 0 ? 12 : hr % 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
};
const fmtDate    = d => {
  if (!d) return '';
  const [y, mo, day] = d.split('-');
  return new Date(y, mo - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const todayISO   = () => new Date().toISOString().split('T')[0];
const initials   = name => (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
const AVATAR_COLORS = [
  'from-indigo-500 to-purple-600', 'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',     'from-violet-500 to-indigo-600',
];
const avatarGrad = name => AVATAR_COLORS[(name || '?').charCodeAt(0) % AVATAR_COLORS.length];

const parseApiErrors = err => {
  const d = err?.response?.data;
  if (d?.errors && typeof d.errors === 'object') return d.errors;
  return { _general: d?.message || 'Something went wrong. Please try again.' };
};

/* ─── Shared badge components ────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.SCHEDULED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />{s.label}
    </span>
  );
};
const TypeBadge = ({ type }) => {
  const t = TYPE_MAP[type] || TYPE_MAP.IN_PERSON;
  const Icon = t.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${t.bg} ${t.text}`}>
      <Icon className="w-2.5 h-2.5" />{t.label}
    </span>
  );
};
const FieldError = ({ errors, name }) =>
  errors?.[name] ? <p className="text-[11px] text-rose-400 mt-1">{errors[name]}</p> : null;

const FormSection = ({ title, icon: Icon, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 rounded-md bg-indigo-500/15 flex items-center justify-center flex-shrink-0">
        <Icon className="w-3 h-3 text-indigo-400" />
      </div>
      <span className="text-[11px] font-bold text-tx3 uppercase tracking-widest">{title}</span>
    </div>
    {children}
  </div>
);

const SEL = 'w-full h-10 bg-surface border border-border rounded-xl px-3 text-[13px] text-tx1 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all';
const TA  = 'w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-[13px] text-tx1 placeholder:text-tx3 outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none';

/* ─── Skeleton loader ────────────────────────────────────────────── */
const DropdownSkeleton = () => (
  <div className="space-y-2 p-2">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-center gap-3 p-2 rounded-lg animate-pulse">
        <div className="w-8 h-8 rounded-full bg-surface flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 bg-surface rounded w-2/3" />
          <div className="h-2.5 bg-surface rounded w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

/* ─── Patient Search Combobox ────────────────────────────────────── */
const PatientSearch = ({ value, onSelect, error }) => {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const debounce  = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const onOutside = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const search = useCallback(q => {
    clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const data = await apiService.get(`/api/v1/patients?search=${encodeURIComponent(q.trim())}&size=8`);
        setResults(Array.isArray(data) ? data : (data?.content ?? []));
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 350);
  }, []);

  const handleInput = e => {
    const q = e.target.value;
    setQuery(q);
    if (value) onSelect(null);
    setOpen(true);
    search(q);
  };

  const handleSelect = p => {
    onSelect(p);
    setQuery('');
    setOpen(false);
    setResults([]);
  };

  const displayValue = value ? `${value.firstName} ${value.lastName}` : query;

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 h-10 bg-surface border rounded-xl px-3 transition-all
        ${error ? 'border-rose-500/60' : open ? 'border-indigo-500/60 ring-2 ring-indigo-500/10' : 'border-border'}`}>
        <Search className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
        <input
          className="flex-1 bg-transparent text-[13px] text-tx1 placeholder:text-tx3 outline-none min-w-0"
          placeholder="Search by name, code, or phone…"
          value={value ? `${value.firstName} ${value.lastName}` : query}
          onChange={handleInput}
          onFocus={() => { if (!value) setOpen(true); }}
          readOnly={!!value}
        />
        {value && (
          <button type="button" onClick={() => { onSelect(null); setQuery(''); setOpen(false); }}
            className="p-0.5 rounded-md hover:bg-rose-500/10 text-tx3 hover:text-rose-400 transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!value && <ChevronDown className={`w-3.5 h-3.5 text-tx3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </div>

      {value && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-3 px-3 py-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrad(value.firstName)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
            {initials(`${value.firstName} ${value.lastName}`)}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-tx1 truncate">{value.firstName} {value.lastName}</p>
            <p className="text-[11px] text-tx3">{value.patientCode} · {value.phoneNumber}</p>
          </div>
          <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 ml-auto" />
        </motion.div>
      )}

      <AnimatePresence>
        {open && !value && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-1.5 w-full bg-card border border-border rounded-xl shadow-modal overflow-hidden"
          >
            {loading ? <DropdownSkeleton /> : results.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-tx3">
                {query.trim() ? 'No patients found.' : 'Start typing to search patients…'}
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                {results.map(p => (
                  <button key={p.patientCode} type="button" onClick={() => handleSelect(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-500/5 transition-colors text-left group">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrad(p.firstName)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                      {initials(`${p.firstName} ${p.lastName}`)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-tx1 truncate group-hover:text-indigo-300 transition-colors">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-[11px] text-tx3">{p.patientCode} · {p.phoneNumber}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Doctor Search Combobox ─────────────────────────────────────── */
const DoctorSearch = ({ value, onSelect, error }) => {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const debounce  = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const onOutside = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const search = useCallback(q => {
    clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const data = await apiService.get(`/api/v1/doctors?search=${encodeURIComponent(q.trim())}&size=8`);
        setResults(Array.isArray(data) ? data : (data?.content ?? []));
      } catch { setResults([]); }
      finally  { setLoading(false); }
    }, 350);
  }, []);

  const handleInput = e => {
    const q = e.target.value;
    setQuery(q);
    if (value) onSelect(null);
    setOpen(true);
    search(q);
  };

  const handleSelect = d => {
    onSelect(d);
    setQuery('');
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex items-center gap-2 h-10 bg-surface border rounded-xl px-3 transition-all
        ${error ? 'border-rose-500/60' : open ? 'border-indigo-500/60 ring-2 ring-indigo-500/10' : 'border-border'}`}>
        <Stethoscope className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
        <input
          className="flex-1 bg-transparent text-[13px] text-tx1 placeholder:text-tx3 outline-none min-w-0"
          placeholder="Search by name or specialization…"
          value={value ? `Dr. ${value.firstName} ${value.lastName}` : query}
          onChange={handleInput}
          onFocus={() => { if (!value) setOpen(true); }}
          readOnly={!!value}
        />
        {value && (
          <button type="button" onClick={() => { onSelect(null); setQuery(''); setOpen(false); }}
            className="p-0.5 rounded-md hover:bg-rose-500/10 text-tx3 hover:text-rose-400 transition-colors flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {!value && <ChevronDown className={`w-3.5 h-3.5 text-tx3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </div>

      {value && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="mt-2 flex items-center gap-3 px-3 py-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
          <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrad(value.firstName)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
            {initials(`${value.firstName} ${value.lastName}`)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-tx1 truncate">Dr. {value.firstName} {value.lastName}</p>
            <p className="text-[11px] text-tx3">{value.specialization} · ₹{value.consultationFee}</p>
          </div>
          <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0 ml-auto" />
        </motion.div>
      )}

      <AnimatePresence>
        {open && !value && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute z-50 mt-1.5 w-full bg-card border border-border rounded-xl shadow-modal overflow-hidden"
          >
            {loading ? <DropdownSkeleton /> : results.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-tx3">
                {query.trim() ? 'No doctors found.' : 'Start typing to search doctors…'}
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                {results.map(d => (
                  <button key={d.doctorCode} type="button" onClick={() => handleSelect(d)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-indigo-500/5 transition-colors text-left group">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGrad(d.firstName)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
                      {initials(`${d.firstName} ${d.lastName}`)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-tx1 truncate group-hover:text-indigo-300 transition-colors">
                        Dr. {d.firstName} {d.lastName}
                      </p>
                      <p className="text-[11px] text-tx3">{d.specialization} · ₹{d.consultationFee}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium flex-shrink-0">
                      Active
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── Slot Picker ────────────────────────────────────────────────── */
const SlotPicker = ({ slots, loading, selected, onSelect }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-surface animate-pulse" />
        ))}
      </div>
    );
  }
  if (!slots || slots.length === 0) return null;

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map(slot => {
        const isSelected  = selected?.startTime === slot.startTime;
        const isAvailable = slot.available;
        return (
          <motion.button
            key={slot.startTime}
            type="button"
            disabled={!isAvailable}
            onClick={() => onSelect(isSelected ? null : slot)}
            whileHover={isAvailable ? { scale: 1.04 } : {}}
            whileTap={isAvailable  ? { scale: 0.96 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className={`h-10 rounded-xl text-[12px] font-medium transition-all duration-150
              ${!isAvailable
                ? 'bg-surface/30 border border-border/30 text-tx3/40 cursor-not-allowed line-through'
                : isSelected
                  ? 'bg-indigo-600 border border-indigo-500/80 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                  : 'bg-surface border border-border text-tx2 hover:border-indigo-500/50 hover:text-indigo-300 hover:bg-indigo-500/5'
              }`}
          >
            {fmtTime12(slot.startTime)}
          </motion.button>
        );
      })}
    </div>
  );
};

/* ─── Confirm modal (for cancel action) ──────────────────────────── */
const ConfirmModal = ({ title, message, confirmLabel, confirmCls, onConfirm, onClose, loading }) => (
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
          Back
        </button>
        <button onClick={onConfirm} disabled={loading}
          className={`flex-1 h-10 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${confirmCls}`}>
          {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </motion.div>
  </motion.div>
);

/* ─── Success Modal ──────────────────────────────────────────────── */
const SuccessModal = ({ appt, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    onClick={e => e.target === e.currentTarget && onClose()}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 24 }}
      animate={{ opacity: 1, scale: 1,   y: 0  }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="bg-card border border-border rounded-2xl w-full max-w-sm p-7 shadow-modal text-center relative overflow-hidden"
    >
      {/* Background glow */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-emerald-500/8 to-transparent pointer-events-none" />

      {/* Animated check */}
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 360, damping: 22 }}
        className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4"
      >
        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
        <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-1">Appointment Booked</p>
        <p className="text-2xl font-bold text-tx1 font-mono tracking-wide mb-5">{appt.appointmentCode}</p>

        <div className="bg-surface/60 border border-border rounded-xl divide-y divide-border text-left mb-5">
          <div className="flex items-center gap-3 px-4 py-3">
            <User className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-tx3 uppercase tracking-wide">Patient</p>
              <p className="text-[13px] font-medium text-tx1">{appt.patientName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Stethoscope className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-tx3 uppercase tracking-wide">Doctor</p>
              <p className="text-[13px] font-medium text-tx1">{appt.doctorName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <Calendar className="w-3.5 h-3.5 text-tx3 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-tx3 uppercase tracking-wide">Date & Time</p>
              <p className="text-[13px] font-medium text-tx1">
                {fmtDate(appt.appointmentDate?.toString?.() ?? '')} &nbsp;·&nbsp;
                {fmtTime12(fmtTime(appt.startTime))} – {fmtTime12(fmtTime(appt.endTime))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <TypeBadge type={appt.consultationType} />
            <span className="text-[12px] font-semibold text-amber-400 ml-auto">₹{appt.consultationFee}</span>
          </div>
        </div>

        <button onClick={onClose}
          className="w-full h-11 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
          Done
        </button>
      </motion.div>
    </motion.div>
  </motion.div>
);

/* ─── Book Appointment Modal ─────────────────────────────────────── */
const BookModal = ({ onClose, onBook }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedDoctor,  setSelectedDoctor]  = useState(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [consultType,     setConsultType]     = useState('IN_PERSON');
  const [reason,          setReason]          = useState('');
  const [notes,           setNotes]           = useState('');
  const [selectedSlot,    setSelectedSlot]    = useState(null);
  const [slots,           setSlots]           = useState([]);
  const [slotsLoading,    setSlotsLoading]    = useState(false);
  const [errors,          setErrors]          = useState({});
  const [saving,          setSaving]          = useState(false);

  /* Fetch slots whenever doctor + date are both set */
  useEffect(() => {
    if (!selectedDoctor || !appointmentDate) { setSlots([]); setSelectedSlot(null); return; }
    setSlotsLoading(true);
    setSelectedSlot(null);
    apiService.get(`/api/v1/appointments/available-slots?doctorCode=${selectedDoctor.doctorCode}&date=${appointmentDate}`)
      .then(data => setSlots(Array.isArray(data) ? data : []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDoctor?.doctorCode, appointmentDate]);

  const clearErr = k => setErrors(p => { const n = { ...p }; delete n[k]; return n; });

  const validate = () => {
    const e = {};
    if (!selectedPatient)  e.patient  = 'Please select a patient.';
    if (!selectedDoctor)   e.doctor   = 'Please select a doctor.';
    if (!appointmentDate)  e.date     = 'Please select an appointment date.';
    if (!selectedSlot)     e.slot     = 'Please select a time slot.';
    return e;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const ve = validate();
    if (Object.keys(ve).length) { setErrors(ve); return; }

    setSaving(true);
    setErrors({});
    try {
      await onBook({
        patientCode:       selectedPatient.patientCode,
        doctorCode:        selectedDoctor.doctorCode,
        appointmentDate,
        startTime:         `${selectedSlot.startTime}:00`,
        endTime:           `${selectedSlot.endTime}:00`,
        consultationType:  consultType,
        reasonForVisit:    reason || null,
        notes:             notes  || null,
        // bookedBy intentionally omitted — backend derives from JWT
      });
    } catch (err) {
      setErrors(parseApiErrors(err));
    } finally {
      setSaving(false);
    }
  };

  const slotsReady = selectedDoctor && appointmentDate;
  const availableCount = slots.filter(s => s.available).length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1,   y: 0  }}
        exit={{ opacity: 0, scale: 0.96,   y: 8  }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-modal"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-tx1">Book Appointment</h2>
            <p className="text-xs text-tx3 mt-0.5">Search patients &amp; doctors, then select a slot</p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface text-tx3 hover:text-tx1 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Scrollable form body ── */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {errors._general && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
              className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-[13px] text-rose-400">
              {errors._general}
            </motion.div>
          )}

          {/* ── Patient ── */}
          <FormSection title="Patient" icon={User}>
            <PatientSearch value={selectedPatient} onSelect={p => { setSelectedPatient(p); clearErr('patient'); }} error={!!errors.patient} />
            {errors.patient && <p className="text-[11px] text-rose-400">{errors.patient}</p>}
          </FormSection>

          {/* ── Doctor ── */}
          <FormSection title="Doctor" icon={Stethoscope}>
            <DoctorSearch value={selectedDoctor} onSelect={d => { setSelectedDoctor(d); clearErr('doctor'); }} error={!!errors.doctor} />
            {errors.doctor && <p className="text-[11px] text-rose-400">{errors.doctor}</p>}
          </FormSection>

          {/* ── Date & Type ── */}
          <FormSection title="Appointment Details" icon={Calendar}>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-tx3 uppercase tracking-wide">
                  Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  min={todayISO()}
                  value={appointmentDate}
                  onChange={e => { setAppointmentDate(e.target.value); clearErr('date'); }}
                  className={`h-10 bg-surface border rounded-xl px-3 text-[13px] text-tx1 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all
                    ${errors.date ? 'border-rose-500/60' : 'border-border focus:border-indigo-500/60'}`}
                />
                {errors.date && <p className="text-[11px] text-rose-400">{errors.date}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-tx3 uppercase tracking-wide">Type <span className="text-rose-400">*</span></label>
                <select value={consultType} onChange={e => setConsultType(e.target.value)} className={SEL}>
                  <option value="IN_PERSON">In-Person</option>
                  <option value="ONLINE">Online</option>
                  <option value="FOLLOW_UP">Follow-up</option>
                </select>
              </div>
            </div>
          </FormSection>

          {/* ── Time Slots ── */}
          <AnimatePresence>
            {slotsReady && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <FormSection title="Available Time Slots" icon={Clock}>
                  {!slotsLoading && slots.length > 0 && (
                    <p className="text-[11px] text-tx3 -mt-1 mb-1">
                      {availableCount} slot{availableCount !== 1 ? 's' : ''} available on {fmtDate(appointmentDate)}
                    </p>
                  )}
                  {errors.slot && <p className="text-[11px] text-rose-400 mb-1">{errors.slot}</p>}
                  <SlotPicker
                    slots={slots}
                    loading={slotsLoading}
                    selected={selectedSlot}
                    onSelect={slot => { setSelectedSlot(slot); clearErr('slot'); }}
                  />
                  {!slotsLoading && slots.length === 0 && (
                    <p className="text-[12px] text-tx3 text-center py-4">No slots available for this date.</p>
                  )}
                </FormSection>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Visit Notes ── */}
          <FormSection title="Visit Details" icon={RotateCcw}>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-tx3 uppercase tracking-wide">Reason for Visit</label>
                <textarea className={TA} rows={2} placeholder="e.g. Chest pain for 3 days"
                  value={reason} onChange={e => setReason(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-tx3 uppercase tracking-wide">Notes</label>
                <textarea className={TA} rows={2} placeholder="Additional notes (optional)"
                  value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          </FormSection>
        </form>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0 bg-card rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 h-10 rounded-xl text-[13px] font-medium text-tx2 border border-border hover:bg-surface transition-colors disabled:opacity-40">
            Cancel
          </button>
          <motion.button
            type="submit" form="book-form" disabled={saving}
            whileTap={{ scale: 0.97 }}
            onClick={handleSubmit}
            className="flex-1 h-10 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving
              ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Booking…</>
              : <><Plus className="w-3.5 h-3.5" />Book Appointment</>}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

/* ─── Appointment card ───────────────────────────────────────────── */
const ApptCard = ({ appt, index, onCancel, onComplete, actionLoading }) => {
  const canCancel   = appt.appointmentStatus === 'SCHEDULED';
  const canComplete = appt.appointmentStatus === 'IN_PROGRESS';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card border border-border rounded-2xl p-5 hover:border-indigo-500/20 transition-all"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Time column */}
        <div className="flex-shrink-0 w-20 text-center hidden sm:block">
          <div className="text-xl font-bold text-tx1 leading-none">{fmtTime(appt.startTime).split(':')[0]}</div>
          <div className="text-sm text-tx3">:{fmtTime(appt.startTime).split(':')[1]}</div>
          <div className="text-[10px] text-tx3 mt-1">{appt.appointmentDate}</div>
        </div>
        <div className="hidden sm:block w-px h-12 bg-border flex-shrink-0" />

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-semibold text-tx1">{appt.patientName}</p>
                <span className="text-[10px] font-mono text-tx3 hidden sm:block">{appt.patientCode}</span>
              </div>
              <p className="text-[12px] text-tx2 mt-0.5">{appt.doctorName}</p>
            </div>
            <StatusBadge status={appt.appointmentStatus} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <TypeBadge type={appt.consultationType} />
            <span className="flex items-center gap-1 text-[11px] text-tx3">
              <Clock className="w-3 h-3" />{fmtTime(appt.startTime)} – {fmtTime(appt.endTime)}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-tx3">
              <Calendar className="w-3 h-3" />{appt.appointmentDate}
            </span>
            <span className="text-[11px] font-mono text-tx3">{appt.appointmentCode}</span>
            <span className="text-[12px] font-semibold text-amber-400 ml-auto">₹{appt.consultationFee}</span>
          </div>

          {appt.reasonForVisit && (
            <p className="text-[11px] text-tx3 mt-2 truncate">Reason: {appt.reasonForVisit}</p>
          )}

          {(canCancel || canComplete) && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-border">
              {canComplete && (
                <button onClick={() => onComplete(appt)} disabled={actionLoading === appt.appointmentCode}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                  {actionLoading === appt.appointmentCode
                    ? <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                    : <CheckCircle className="w-3.5 h-3.5" />}
                  Mark Complete
                </button>
              )}
              {canCancel && (
                <button onClick={() => onCancel(appt)} disabled={actionLoading === appt.appointmentCode}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition-colors disabled:opacity-50">
                  {actionLoading === appt.appointmentCode
                    ? <span className="w-3 h-3 border-2 border-rose-400/30 border-t-rose-400 rounded-full animate-spin" />
                    : <XCircle className="w-3.5 h-3.5" />}
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/* ─── Main component ─────────────────────────────────────────────── */
const Appointments = () => {
  const [activeFilter,  setActiveFilter]  = useState('ALL');
  const [showModal,     setShowModal]     = useState(false);
  const [appointments,  setAppointments]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [cancelTarget,  setCancelTarget]  = useState(null);
  const [cancelling,    setCancelling]    = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [lastBooked,    setLastBooked]    = useState(null);
  const [showSuccess,   setShowSuccess]   = useState(false);

  useEffect(() => { loadAppointments(); }, []);

  const loadAppointments = () => {
    setLoading(true);
    apiService.get('/api/v1/appointments?size=100')
      .then(data => setAppointments(Array.isArray(data) ? data : (data?.content ?? [])))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  };

  const filterCounts = useMemo(() => ({
    ALL:         appointments.length,
    SCHEDULED:   appointments.filter(a => a.appointmentStatus === 'SCHEDULED').length,
    IN_PROGRESS: appointments.filter(a => a.appointmentStatus === 'IN_PROGRESS').length,
    COMPLETED:   appointments.filter(a => a.appointmentStatus === 'COMPLETED').length,
    CANCELLED:   appointments.filter(a => a.appointmentStatus === 'CANCELLED').length,
  }), [appointments]);

  const filters = [
    { key: 'ALL',         label: 'All',         count: filterCounts.ALL         },
    { key: 'SCHEDULED',   label: 'Scheduled',   count: filterCounts.SCHEDULED   },
    { key: 'IN_PROGRESS', label: 'In Progress', count: filterCounts.IN_PROGRESS },
    { key: 'COMPLETED',   label: 'Completed',   count: filterCounts.COMPLETED   },
    { key: 'CANCELLED',   label: 'Cancelled',   count: filterCounts.CANCELLED   },
  ];

  const filtered = useMemo(() =>
    activeFilter === 'ALL'
      ? appointments
      : appointments.filter(a => a.appointmentStatus === activeFilter),
  [activeFilter, appointments]);

  const handleBook = async form => {
    const created = await apiService.post('/api/v1/appointments', form);
    setAppointments(prev => [created, ...prev]);
    setShowModal(false);
    setLastBooked(created);
    setShowSuccess(true);
  };

  const handleComplete = async appt => {
    setActionLoading(appt.appointmentCode);
    try {
      const updated = await apiService.put(`/api/v1/appointments/${appt.appointmentCode}/complete`);
      setAppointments(prev => prev.map(a => a.appointmentCode === appt.appointmentCode ? updated : a));
    } catch {}
    finally { setActionLoading(null); }
  };

  const handleCancelConfirm = async () => {
    setCancelling(true);
    try {
      const updated = await apiService.put(`/api/v1/appointments/${cancelTarget.appointmentCode}/cancel`);
      setAppointments(prev => prev.map(a => a.appointmentCode === cancelTarget.appointmentCode ? updated : a));
      setCancelTarget(null);
    } finally { setCancelling(false); }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-tx1">Appointments</h1>
            <p className="text-sm text-tx3 mt-0.5">
              {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowModal(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Book Appointment
          </motion.button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap mb-5">
          {filters.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[12px] font-medium transition-colors
                ${activeFilter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-card border border-border text-tx2 hover:text-tx1 hover:border-indigo-500/40'}`}>
              {f.label}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${activeFilter === f.key ? 'bg-white/20 text-white' : 'bg-surface text-tx3'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-20">
              <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-tx3">No appointments with this status.</div>
              ) : filtered.map((a, i) => (
                <ApptCard
                  key={a.appointmentCode}
                  appt={a}
                  index={i}
                  onCancel={setCancelTarget}
                  onComplete={handleComplete}
                  actionLoading={actionLoading}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <BookModal onClose={() => setShowModal(false)} onBook={handleBook} />
        )}
        {showSuccess && lastBooked && (
          <SuccessModal appt={lastBooked} onClose={() => { setShowSuccess(false); setLastBooked(null); }} />
        )}
        {cancelTarget && (
          <ConfirmModal
            title="Cancel Appointment"
            message={`Cancel appointment ${cancelTarget.appointmentCode} for ${cancelTarget.patientName}? This cannot be undone.`}
            confirmLabel="Cancel Appointment"
            confirmCls="bg-rose-600 hover:bg-rose-700"
            onConfirm={handleCancelConfirm}
            onClose={() => setCancelTarget(null)}
            loading={cancelling}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default Appointments;
