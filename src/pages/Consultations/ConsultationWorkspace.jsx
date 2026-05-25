/**
 * ConsultationWorkspace.jsx — Clinical Encounter Workspace
 *
 * The primary doctor-facing UI for recording a patient consultation.
 * Designed to feel like clinical EMR software — fast, focused, operational.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────┐
 *  │  Patient context bar (read-only)            │
 *  ├─────────────────────────────────────────────┤
 *  │  Vitals strip (compact horizontal cards)    │
 *  ├─────────────────────────────────────────────┤
 *  │  Clinical section (complaints, diagnosis…)  │
 *  ├─────────────────────────────────────────────┤
 *  │  Prescription table (dynamic rows)          │
 *  ├─────────────────────────────────────────────┤
 *  │  Follow-up section                          │
 *  ├─────────────────────────────────────────────┤
 *  │  [Save Draft]  [Complete Consultation]      │
 *  └─────────────────────────────────────────────┘
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Stethoscope, Calendar, Clock, CheckCircle2,
  AlertCircle, ChevronLeft, Plus, Trash2, Save,
  Activity, Heart, Thermometer, Wind, Scale, Ruler,
  Lock, ClipboardList, FlaskConical,
} from 'lucide-react';
import apiService from '../../utils/apiService';
import { parseApiError } from '../../utils/errorHandler';

/* ─── Animation ──────────────────────────────────────────────────────────── */
const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

/* ─── Status badge ───────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) =>
  status === 'COMPLETED' ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      <Lock className="w-3 h-3" /> Completed — Locked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      <Clock className="w-3 h-3" /> Draft
    </span>
  );

/* ─── Section wrapper ────────────────────────────────────────────────────── */
const Section = ({ title, icon: Icon, accent, children }) => (
  <div className="bg-card border border-border rounded-2xl overflow-hidden">
    <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-border ${accent || 'bg-surface/50'}`}>
      <Icon className="w-4 h-4 text-tx3" strokeWidth={2} />
      <h2 className="text-sm font-semibold text-tx1">{title}</h2>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

/* ─── Vital card ─────────────────────────────────────────────────────────── */
const VitalInput = ({ icon: Icon, label, value, onChange, placeholder, unit, locked, type = 'text' }) => (
  <div className="bg-surface border border-border rounded-xl p-3 flex flex-col gap-1.5">
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-tx3" strokeWidth={2} />
      <span className="text-[10px] font-semibold text-tx3 uppercase tracking-wider">{label}</span>
    </div>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={locked}
      className="w-full bg-transparent text-sm font-medium text-tx1 placeholder:text-tx3/60 outline-none disabled:opacity-60 disabled:cursor-not-allowed"
    />
    {unit && <span className="text-[10px] text-tx3">{unit}</span>}
  </div>
);

/* ─── Clinical textarea ──────────────────────────────────────────────────── */
const ClinicalField = ({ label, required, value, onChange, placeholder, rows = 3, locked, highlight }) => (
  <div>
    <label className={`block text-xs font-semibold mb-1.5 ${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-tx2'}`}>
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={locked}
      className={`w-full rounded-xl px-3.5 py-2.5 text-sm text-tx1 placeholder:text-tx3 bg-surface border resize-y transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed leading-relaxed ${
        highlight
          ? 'border-indigo-300 dark:border-indigo-700/50 focus:border-indigo-500'
          : 'border-border focus:border-indigo-400'
      }`}
    />
  </div>
);

/* ─── Empty prescription row ─────────────────────────────────────────────── */
const emptyRx = () => ({
  medicineName: '', dosage: '', frequency: '', duration: '', instructions: '',
  _id: Math.random().toString(36).slice(2),
});

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function ConsultationWorkspace() {
  const { consultationCode } = useParams();
  const navigate = useNavigate();

  // ── Data ──
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState(null);

  // ── Form state ──
  const [vitals, setVitals] = useState({
    bloodPressure: '', pulseRate: '', temperature: '',
    oxygenSaturation: '', respiratoryRate: '', height: '', weight: '', bmi: '',
  });
  const [clinical, setClinical] = useState({
    chiefComplaint: '', symptoms: '', diagnosis: '',
    doctorNotes: '', treatmentPlan: '',
  });
  const [followUp, setFollowUp] = useState({
    followUpRequired: false, followUpDate: '', followUpNotes: '',
  });
  const [rxItems, setRxItems] = useState([]);

  // ── UI state ──
  const [saving, setSaving]       = useState(false);
  const [completing, setCompleting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(false);

  // ── Lab order modal state ──
  const [labModal, setLabModal]             = useState(false);
  const [labItems, setLabItems]             = useState([{ testName: '', testCode: '', category: '', _id: Math.random().toString(36).slice(2) }]);
  const [labPriority, setLabPriority]       = useState('NORMAL');
  const [labNotes, setLabNotes]             = useState('');
  const [labInstructions, setLabInstructions] = useState('');
  const [labSaving, setLabSaving]           = useState(false);
  const [labError, setLabError]             = useState(null);
  const [labSuccess, setLabSuccess]         = useState(null);

  const isLocked = consultation?.consultationStatus === 'COMPLETED';

  // ── Load consultation ──
  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await apiService.get(`/api/v1/consultations/${consultationCode}`);
      setConsultation(data);
      hydrate(data);
    } catch (err) {
      const { message } = parseApiError(err);
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, [consultationCode]);

  useEffect(() => { load(); }, [load]);

  // ── Hydrate form from API data ──
  const hydrate = (data) => {
    setVitals({
      bloodPressure:    data.bloodPressure    ?? '',
      pulseRate:        data.pulseRate        != null ? String(data.pulseRate) : '',
      temperature:      data.temperature      != null ? String(data.temperature) : '',
      oxygenSaturation: data.oxygenSaturation != null ? String(data.oxygenSaturation) : '',
      respiratoryRate:  data.respiratoryRate  != null ? String(data.respiratoryRate) : '',
      height:           data.height           != null ? String(data.height) : '',
      weight:           data.weight           != null ? String(data.weight) : '',
      bmi:              data.bmi              != null ? String(data.bmi) : '',
    });
    setClinical({
      chiefComplaint: data.chiefComplaint ?? '',
      symptoms:       data.symptoms       ?? '',
      diagnosis:      data.diagnosis      ?? '',
      doctorNotes:    data.doctorNotes    ?? '',
      treatmentPlan:  data.treatmentPlan  ?? '',
    });
    setFollowUp({
      followUpRequired: data.followUpRequired ?? false,
      followUpDate:     data.followUpDate     ?? '',
      followUpNotes:    data.followUpNotes    ?? '',
    });
    setRxItems(
      data.prescriptionItems && data.prescriptionItems.length > 0
        ? data.prescriptionItems.map(rx => ({ ...rx, _id: rx.id?.toString() || Math.random().toString(36).slice(2) }))
        : []
    );
  };

  // ── Build request payload ──
  const buildPayload = () => ({
    bloodPressure:    vitals.bloodPressure    || null,
    pulseRate:        vitals.pulseRate        ? Number(vitals.pulseRate)        : null,
    temperature:      vitals.temperature      ? Number(vitals.temperature)      : null,
    oxygenSaturation: vitals.oxygenSaturation ? Number(vitals.oxygenSaturation) : null,
    respiratoryRate:  vitals.respiratoryRate  ? Number(vitals.respiratoryRate)  : null,
    height:           vitals.height           ? Number(vitals.height)           : null,
    weight:           vitals.weight           ? Number(vitals.weight)           : null,
    bmi:              vitals.bmi              ? Number(vitals.bmi)              : null,
    chiefComplaint: clinical.chiefComplaint || null,
    symptoms:       clinical.symptoms       || null,
    diagnosis:      clinical.diagnosis      || null,
    doctorNotes:    clinical.doctorNotes    || null,
    treatmentPlan:  clinical.treatmentPlan  || null,
    followUpRequired: followUp.followUpRequired,
    followUpDate:     followUp.followUpDate || null,
    followUpNotes:    followUp.followUpNotes || null,
    prescriptionItems: rxItems.map(rx => ({
      medicineName: rx.medicineName,
      dosage:       rx.dosage,
      frequency:    rx.frequency,
      duration:     rx.duration,
      instructions: rx.instructions || null,
    })),
  });

  // ── Save draft ──
  const handleSaveDraft = async () => {
    setSaving(true);
    setActionError(null);
    setSaveSuccess(false);
    try {
      const data = await apiService.put(
        `/api/v1/consultations/${consultationCode}/draft`,
        buildPayload()
      );
      setConsultation(data);
      hydrate(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const { message } = parseApiError(err);
      setActionError(message);
    } finally {
      setSaving(false);
    }
  };

  // ── Complete consultation ──
  const handleComplete = async () => {
    setCompleting(true);
    setActionError(null);
    setConfirmComplete(false);
    try {
      const data = await apiService.put(
        `/api/v1/consultations/${consultationCode}/complete`,
        buildPayload()
      );
      setConsultation(data);
      hydrate(data);
    } catch (err) {
      const { message } = parseApiError(err);
      setActionError(message);
    } finally {
      setCompleting(false);
    }
  };

  // ── Prescription helpers ──
  const addRx = () => setRxItems(prev => [...prev, emptyRx()]);
  const removeRx = (id) => setRxItems(prev => prev.filter(r => r._id !== id));
  const updateRx = (id, field, value) =>
    setRxItems(prev => prev.map(r => r._id === id ? { ...r, [field]: value } : r));

  // ── Lab order helpers ──
  const addLabItem = () =>
    setLabItems(prev => [...prev, { testName: '', testCode: '', category: '', _id: Math.random().toString(36).slice(2) }]);
  const removeLabItem = (id) => setLabItems(prev => prev.filter(i => i._id !== id));
  const updateLabItem = (id, field, value) =>
    setLabItems(prev => prev.map(i => i._id === id ? { ...i, [field]: value } : i));

  const resetLabModal = () => {
    setLabItems([{ testName: '', testCode: '', category: '', _id: Math.random().toString(36).slice(2) }]);
    setLabPriority('NORMAL');
    setLabNotes('');
    setLabInstructions('');
    setLabError(null);
    setLabSuccess(null);
  };

  const handleOrderLabTests = async () => {
    const validItems = labItems.filter(i => i.testName.trim());
    if (validItems.length === 0) {
      setLabError('Add at least one test name.');
      return;
    }
    setLabSaving(true);
    setLabError(null);
    try {
      await apiService.post('/api/v1/lab-orders', {
        consultationCode,
        priority: labPriority,
        clinicalNotes: labNotes || null,
        instructions: labInstructions || null,
        items: validItems.map(({ testName, testCode, category }) => ({
          testName,
          testCode: testCode || null,
          category: category || null,
        })),
      });
      setLabSuccess('Lab order created. You can view it in the Reports section.');
      setTimeout(() => {
        setLabModal(false);
        resetLabModal();
      }, 2000);
    } catch (err) {
      const { message } = parseApiError(err);
      setLabError(message);
    } finally {
      setLabSaving(false);
    }
  };

  // ── Vitals helper ──
  const setV = (field) => (val) => setVitals(v => ({ ...v, [field]: val }));
  const setC = (field) => (val) => setClinical(c => ({ ...c, [field]: val }));

  // ── Loading skeleton ──
  if (loading) return (
    <div className="min-h-screen bg-page p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-5 animate-pulse">
        <div className="h-24 bg-card border border-border rounded-2xl" />
        <div className="h-40 bg-card border border-border rounded-2xl" />
        <div className="h-80 bg-card border border-border rounded-2xl" />
        <div className="h-56 bg-card border border-border rounded-2xl" />
      </div>
    </div>
  );

  // ── Fetch error ──
  if (fetchError) return (
    <div className="min-h-screen bg-page p-6 lg:p-8 flex items-center justify-center">
      <div className="text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <p className="text-tx1 font-semibold mb-1">Unable to load consultation</p>
        <p className="text-sm text-tx3 mb-4">{fetchError}</p>
        <button onClick={() => navigate(-1)} className="text-sm text-indigo-500 hover:underline">
          ← Go back
        </button>
      </div>
    </div>
  );

  const fmt = (dateStr) => dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  return (
    <motion.div {...fadeIn} className="min-h-screen bg-page p-4 lg:p-6">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Breadcrumb + status ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/consultations')}
            className="flex items-center gap-1.5 text-sm text-tx3 hover:text-tx1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Consultations
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-tx3">{consultationCode}</span>
            <StatusBadge status={consultation?.consultationStatus} />
          </div>
        </div>

        {/* ── Patient context bar ── */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex flex-wrap items-start gap-6">
            {/* Patient */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-tx3 font-medium">Patient</p>
                <p className="text-sm font-bold text-tx1">{consultation?.patientName || '—'}</p>
                <p className="text-[11px] text-tx3">
                  {consultation?.patientGender || '—'} · {consultation?.patientAge != null ? `${consultation.patientAge} yrs` : '—'}
                  {' · '}{consultation?.patientCode || '—'}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-border hidden sm:block" />

            {/* Doctor */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-tx3 font-medium">Doctor</p>
                <p className="text-sm font-bold text-tx1">{consultation?.doctorName || '—'}</p>
                <p className="text-[11px] text-tx3">
                  {consultation?.doctorSpecialization || '—'}
                  {consultation?.doctorDepartment ? ` · ${consultation.doctorDepartment}` : ''}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-border hidden sm:block" />

            {/* Appointment context */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-5 h-5 text-tx2" />
              </div>
              <div>
                <p className="text-xs text-tx3 font-medium">Appointment</p>
                <p className="text-sm font-bold text-tx1">{fmt(consultation?.appointmentDate)}</p>
                <p className="text-[11px] text-tx3">
                  {consultation?.startTime} – {consultation?.endTime}
                  {consultation?.consultationType ? ` · ${consultation.consultationType.replace('_', ' ')}` : ''}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Vitals strip ── */}
        <Section title="Vitals" icon={Activity} accent="bg-blue-50/50 dark:bg-blue-900/10">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
            <VitalInput icon={Heart}       label="BP"    placeholder="120/80" unit="mmHg"
              value={vitals.bloodPressure}    onChange={setV('bloodPressure')}    locked={isLocked} />
            <VitalInput icon={Activity}    label="Pulse" placeholder="72"     unit="bpm"  type="number"
              value={vitals.pulseRate}        onChange={setV('pulseRate')}        locked={isLocked} />
            <VitalInput icon={Thermometer} label="Temp"  placeholder="37.0"   unit="°C"   type="number"
              value={vitals.temperature}      onChange={setV('temperature')}      locked={isLocked} />
            <VitalInput icon={Activity}    label="SpO2"  placeholder="98"     unit="%"    type="number"
              value={vitals.oxygenSaturation} onChange={setV('oxygenSaturation')} locked={isLocked} />
            <VitalInput icon={Wind}        label="RR"    placeholder="16"     unit="/min" type="number"
              value={vitals.respiratoryRate}  onChange={setV('respiratoryRate')}  locked={isLocked} />
            <VitalInput icon={Ruler}       label="Height" placeholder="170"   unit="cm"   type="number"
              value={vitals.height}           onChange={setV('height')}           locked={isLocked} />
            <VitalInput icon={Scale}       label="Weight" placeholder="70"    unit="kg"   type="number"
              value={vitals.weight}           onChange={setV('weight')}           locked={isLocked} />
            <VitalInput icon={Activity}    label="BMI"   placeholder="auto"   unit="kg/m²" type="number"
              value={vitals.bmi}              onChange={setV('bmi')}              locked={isLocked} />
          </div>
          {!isLocked && (
            <p className="mt-2 text-[11px] text-tx3">
              BMI is auto-calculated from height + weight when left blank.
            </p>
          )}
        </Section>

        {/* ── Clinical section ── */}
        <Section title="Clinical Details" icon={ClipboardList} accent="bg-indigo-50/50 dark:bg-indigo-900/10">
          <div className="space-y-4">
            <ClinicalField
              label="Chief Complaint" required
              value={clinical.chiefComplaint} onChange={setC('chiefComplaint')}
              placeholder="Patient's primary reason for visit…" rows={2} locked={isLocked}
            />
            <ClinicalField
              label="Symptoms"
              value={clinical.symptoms} onChange={setC('symptoms')}
              placeholder="List presenting symptoms…" rows={3} locked={isLocked}
            />
            <ClinicalField
              label="Diagnosis" required highlight
              value={clinical.diagnosis} onChange={setC('diagnosis')}
              placeholder="Primary diagnosis / differential diagnosis…" rows={3} locked={isLocked}
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <ClinicalField
                label="Doctor Notes"
                value={clinical.doctorNotes} onChange={setC('doctorNotes')}
                placeholder="Clinical observations, examination findings…" rows={4} locked={isLocked}
              />
              <ClinicalField
                label="Treatment Plan"
                value={clinical.treatmentPlan} onChange={setC('treatmentPlan')}
                placeholder="Recommended treatment, procedures, referrals…" rows={4} locked={isLocked}
              />
            </div>
          </div>
        </Section>

        {/* ── Prescription table ── */}
        <Section title="Prescription" icon={ClipboardList} accent="bg-emerald-50/50 dark:bg-emerald-900/10">
          {rxItems.length === 0 ? (
            <p className="text-sm text-tx3 text-center py-4">
              {isLocked ? 'No prescriptions recorded.' : 'No medicines added yet. Use the button below to add prescription items.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold text-tx3 uppercase tracking-wider border-b border-border">
                    <th className="pb-2 pr-3 w-[22%]">Medicine</th>
                    <th className="pb-2 pr-3 w-[14%]">Dosage</th>
                    <th className="pb-2 pr-3 w-[18%]">Frequency</th>
                    <th className="pb-2 pr-3 w-[14%]">Duration</th>
                    <th className="pb-2 pr-3">Instructions</th>
                    {!isLocked && <th className="pb-2 w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {rxItems.map((rx) => (
                      <motion.tr
                        key={rx._id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <td className="py-2 pr-3">
                          {isLocked ? (
                            <span className="text-tx1 font-medium">{rx.medicineName}</span>
                          ) : (
                            <input
                              value={rx.medicineName}
                              onChange={e => updateRx(rx._id, 'medicineName', e.target.value)}
                              placeholder="Paracetamol"
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {isLocked ? (
                            <span className="text-tx2">{rx.dosage}</span>
                          ) : (
                            <input
                              value={rx.dosage}
                              onChange={e => updateRx(rx._id, 'dosage', e.target.value)}
                              placeholder="500mg"
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {isLocked ? (
                            <span className="text-tx2">{rx.frequency}</span>
                          ) : (
                            <input
                              value={rx.frequency}
                              onChange={e => updateRx(rx._id, 'frequency', e.target.value)}
                              placeholder="Twice daily"
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {isLocked ? (
                            <span className="text-tx2">{rx.duration}</span>
                          ) : (
                            <input
                              value={rx.duration}
                              onChange={e => updateRx(rx._id, 'duration', e.target.value)}
                              placeholder="5 days"
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {isLocked ? (
                            <span className="text-tx3 text-xs">{rx.instructions || '—'}</span>
                          ) : (
                            <input
                              value={rx.instructions}
                              onChange={e => updateRx(rx._id, 'instructions', e.target.value)}
                              placeholder="After food"
                              className="w-full bg-surface border border-border rounded-lg px-2.5 py-1.5 text-sm text-tx1 placeholder:text-tx3 focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-indigo-400"
                            />
                          )}
                        </td>
                        {!isLocked && (
                          <td className="py-2">
                            <button
                              onClick={() => removeRx(rx._id)}
                              className="p-1.5 rounded-lg text-tx3 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {!isLocked && (
            <button
              onClick={addRx}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Medicine
            </button>
          )}
        </Section>

        {/* ── Follow-up section ── */}
        <Section title="Follow-up" icon={Calendar} accent="bg-purple-50/50 dark:bg-purple-900/10">
          <div className="space-y-4">
            {/* Toggle */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => !isLocked && setFollowUp(f => ({
                  ...f,
                  followUpRequired: !f.followUpRequired,
                  followUpDate: !f.followUpRequired ? f.followUpDate : '',
                }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  followUp.followUpRequired
                    ? 'bg-indigo-500'
                    : 'bg-border'
                } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  followUp.followUpRequired ? 'translate-x-5.5' : 'translate-x-1'
                }`} />
              </div>
              <span className="text-sm font-medium text-tx1">Follow-up required</span>
            </label>

            <AnimatePresence>
              {followUp.followUpRequired && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid sm:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-tx2 mb-1.5">
                        Follow-up Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={followUp.followUpDate}
                        onChange={e => setFollowUp(f => ({ ...f, followUpDate: e.target.value }))}
                        disabled={isLocked}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full rounded-xl px-3.5 py-2.5 text-sm text-tx1 bg-surface border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-tx2 mb-1.5">
                        Follow-up Notes
                      </label>
                      <input
                        type="text"
                        value={followUp.followUpNotes}
                        onChange={e => setFollowUp(f => ({ ...f, followUpNotes: e.target.value }))}
                        disabled={isLocked}
                        placeholder="Review blood results, check medication response…"
                        className="w-full rounded-xl px-3.5 py-2.5 text-sm text-tx1 bg-surface border border-border placeholder:text-tx3 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Section>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-sm text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Completed banner ── */}
        {isLocked && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            This consultation is completed and locked. The appointment has been marked as COMPLETED.
          </div>
        )}

        {/* ── Confirm complete dialog ── */}
        <AnimatePresence>
          {confirmComplete && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            >
              <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-modal">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-tx1">Complete Consultation?</h3>
                    <p className="text-xs text-tx3">This action cannot be undone.</p>
                  </div>
                </div>
                <p className="text-sm text-tx2 mb-5 leading-relaxed">
                  Completing will <strong className="text-tx1">lock this clinical record</strong> and
                  automatically mark the appointment as <strong className="text-tx1">COMPLETED</strong>.
                  Ensure all clinical details, diagnosis, and prescriptions are accurate before proceeding.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmComplete(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface border border-border text-tx2 hover:text-tx1 transition-colors"
                  >
                    Review Again
                  </button>
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {completing ? (
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : <CheckCircle2 className="w-4 h-4" />}
                    Yes, Complete
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Action buttons ── */}
        {!isLocked && (
          <div className="flex items-center justify-between gap-4 py-2">
            <button
              onClick={() => navigate('/consultations')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-tx2 hover:text-tx1 border border-border bg-surface hover:border-indigo-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-3">
              {/* Save draft feedback */}
              <AnimatePresence>
                {saveSuccess && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Saved
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Save Draft */}
              <button
                onClick={handleSaveDraft}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-surface border border-border text-tx1 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                ) : <Save className="w-4 h-4" />}
                Save Draft
              </button>

              {/* Order Lab Tests */}
              <button
                onClick={() => { resetLabModal(); setLabModal(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-surface border border-border text-tx1 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <FlaskConical className="w-4 h-4" />
                Order Lab Tests
              </button>

              {/* Complete Consultation */}
              <button
                onClick={() => setConfirmComplete(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                Complete Consultation
              </button>
            </div>
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-6" />
      </div>

      {/* ── Lab Order Modal ── */}
      <AnimatePresence>
        {labModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-card border border-border rounded-2xl shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <FlaskConical className="w-4.5 h-4.5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-tx1">Order Lab Tests</h3>
                    <p className="text-[11px] text-tx3 font-mono">{consultationCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setLabModal(false); resetLabModal(); }}
                  className="p-1.5 rounded-lg text-tx3 hover:text-tx1 hover:bg-surface transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-tx2 mb-2">Priority</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'NORMAL', label: 'Normal', color: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600' },
                      { value: 'URGENT', label: 'Urgent', color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50' },
                      { value: 'STAT',   label: 'STAT',   color: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50' },
                    ].map(p => (
                      <button
                        key={p.value}
                        onClick={() => setLabPriority(p.value)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          labPriority === p.value
                            ? p.color + ' ring-2 ring-offset-1 ring-violet-400'
                            : 'bg-surface border-border text-tx3 hover:border-tx3'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Test rows */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-tx2">
                      Tests <span className="text-red-500">*</span>
                    </label>
                    <button
                      onClick={addLabItem}
                      className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add Test
                    </button>
                  </div>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-surface border-b border-border">
                        <tr className="text-[11px] font-semibold text-tx3 uppercase tracking-wider">
                          <th className="py-2 px-3 text-left w-[40%]">Test Name *</th>
                          <th className="py-2 px-3 text-left w-[22%]">Code</th>
                          <th className="py-2 px-3 text-left">Category</th>
                          <th className="py-2 px-2 w-8" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        <AnimatePresence initial={false}>
                          {labItems.map((item) => (
                            <motion.tr
                              key={item._id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.12 }}
                            >
                              <td className="px-3 py-2">
                                <input
                                  value={item.testName}
                                  onChange={e => updateLabItem(item._id, 'testName', e.target.value)}
                                  placeholder="Complete Blood Count"
                                  className="w-full bg-transparent text-sm text-tx1 placeholder:text-tx3 outline-none focus:ring-1 focus:ring-violet-400/60 rounded px-1 py-0.5"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  value={item.testCode}
                                  onChange={e => updateLabItem(item._id, 'testCode', e.target.value)}
                                  placeholder="CBC"
                                  className="w-full bg-transparent text-sm text-tx2 placeholder:text-tx3 outline-none focus:ring-1 focus:ring-violet-400/60 rounded px-1 py-0.5"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  value={item.category}
                                  onChange={e => updateLabItem(item._id, 'category', e.target.value)}
                                  placeholder="Hematology"
                                  className="w-full bg-transparent text-sm text-tx2 placeholder:text-tx3 outline-none focus:ring-1 focus:ring-violet-400/60 rounded px-1 py-0.5"
                                />
                              </td>
                              <td className="px-2 py-2">
                                {labItems.length > 1 && (
                                  <button
                                    onClick={() => removeLabItem(item._id)}
                                    className="p-1 rounded text-tx3 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Clinical notes + instructions */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-tx2 mb-1.5">Clinical Notes</label>
                    <textarea
                      value={labNotes}
                      onChange={e => setLabNotes(e.target.value)}
                      placeholder="Reason for ordering, relevant clinical context…"
                      rows={3}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-tx1 placeholder:text-tx3 bg-surface border border-border resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 leading-relaxed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-tx2 mb-1.5">Instructions for Lab</label>
                    <textarea
                      value={labInstructions}
                      onChange={e => setLabInstructions(e.target.value)}
                      placeholder="Fasting required, sample handling, timing notes…"
                      rows={3}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-tx1 placeholder:text-tx3 bg-surface border border-border resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400 leading-relaxed"
                    />
                  </div>
                </div>

                {/* Error / success */}
                <AnimatePresence>
                  {labError && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/40 text-sm text-red-700 dark:text-red-300"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{labError}</span>
                    </motion.div>
                  )}
                  {labSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 text-sm text-emerald-700 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{labSuccess}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Modal footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
                <button
                  onClick={() => { setLabModal(false); resetLabModal(); }}
                  disabled={labSaving}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium bg-surface border border-border text-tx2 hover:text-tx1 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOrderLabTests}
                  disabled={labSaving || !!labSuccess}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {labSaving ? (
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  ) : <FlaskConical className="w-4 h-4" />}
                  {labSaving ? 'Ordering…' : 'Place Order'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
