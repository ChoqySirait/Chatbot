import React, { useState, useEffect } from 'react';
import {
  FolderPlus,
  Clock,
  Download,
  Trash2,
  Plus,
  Upload,
  Shield,
  Tag,
  User,
} from 'lucide-react';
import { db, exportIncidentCasePackage, importIncidentCasePackage } from '../../db';
import type { IncidentCase, IncidentTimelineEvent, SeverityLevel } from '../../types/api';
import { useLanguage } from '../../context/LanguageContext';

export const IncidentManager: React.FC = () => {
  const { t } = useLanguage();
  const [cases, setCases] = useState<IncidentCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<IncidentCase | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<IncidentTimelineEvent[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);

  // New Case Form State
  const [newTitle, setNewTitle] = useState('');
  const [newSeverity, setNewSeverity] = useState<SeverityLevel>('medium');
  const [newType, setNewType] = useState<IncidentCase['incidentType']>('phishing');
  const [newReporter, setNewReporter] = useState('');
  const [newSummary, setNewSummary] = useState('');

  // New Timeline Event State
  const [eventAction, setEventAction] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  // Notes state
  const [caseNotes, setCaseNotes] = useState('');

  const loadCases = async () => {
    const list = await db.incidents.reverse().sortBy('createdAt');
    setCases(list);
    if (list.length > 0 && !selectedCase) {
      setSelectedCase(list[0]);
    } else if (list.length === 0) {
      setSelectedCase(null);
    }
  };

  useEffect(() => {
    loadCases();
  }, []);

  useEffect(() => {
    if (selectedCase?.caseId) {
      setCaseNotes(selectedCase.notes || '');
      db.timeline
        .where('incidentId')
        .equals(selectedCase.caseId)
        .sortBy('timestamp')
        .then((events) => setTimelineEvents(events));
    } else {
      setTimelineEvents([]);
      setCaseNotes('');
    }
  }, [selectedCase]);

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const caseCount = await db.incidents.count();
    const caseId = `SEC-2026-${String(caseCount + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    const newCase: IncidentCase = {
      caseId,
      title: newTitle.trim(),
      createdAt: now,
      updatedAt: now,
      status: 'open',
      severity: newSeverity,
      incidentType: newType,
      reporter: newReporter.trim() || 'Anonymous User',
      summary: newSummary.trim(),
      notes: '',
      tags: [newType],
      assignedAnalysisIds: [],
    };

    await db.incidents.add(newCase);

    // Add initial creation timeline event
    await db.timeline.add({
      incidentId: caseId,
      timestamp: now,
      source: 'user',
      action: 'Case Created',
      description: `Case initialized by ${newCase.reporter}: ${newTitle}`,
      severity: newSeverity,
    });

    setNewTitle('');
    setNewSummary('');
    setNewReporter('');
    setShowNewModal(false);
    await loadCases();
    setSelectedCase(newCase);
  };

  const handleAddTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCase || !eventAction.trim()) return;

    const newEvent: IncidentTimelineEvent = {
      incidentId: selectedCase.caseId,
      timestamp: new Date().toISOString(),
      source: 'manual',
      action: eventAction.trim(),
      description: eventDesc.trim(),
    };

    await db.timeline.add(newEvent);
    const updated = await db.timeline
      .where('incidentId')
      .equals(selectedCase.caseId)
      .sortBy('timestamp');
    setTimelineEvents(updated);
    setEventAction('');
    setEventDesc('');
  };

  const handleSaveNotes = async () => {
    if (!selectedCase || !selectedCase.id) return;
    await db.incidents.update(selectedCase.id, {
      notes: caseNotes,
      updatedAt: new Date().toISOString(),
    });
    setSelectedCase({ ...selectedCase, notes: caseNotes });
  };

  const handleStatusChange = async (newStatus: IncidentCase['status']) => {
    if (!selectedCase || !selectedCase.id) return;
    await db.incidents.update(selectedCase.id, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
    setSelectedCase({ ...selectedCase, status: newStatus });
    await loadCases();
  };

  const handleDeleteCase = async (id: number) => {
    if (!confirm('Hapus kasus ini dari penyimpanan lokal?')) return;
    if (selectedCase && selectedCase.caseId) {
      await db.timeline.where('incidentId').equals(selectedCase.caseId).delete();
      await db.evidence.where('incidentId').equals(selectedCase.caseId).delete();
    }
    await db.incidents.delete(id);
    await loadCases();
    setSelectedCase(null);
  };

  const handleExport = async (caseId: string) => {
    try {
      const packageJson = await exportIncidentCasePackage(caseId);
      const blob = new Blob([packageJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `securai-case-${caseId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err}`);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const importedId = await importIncidentCasePackage(text);
        alert(`Berhasil mengimpor kasus: ${importedId}`);
        await loadCases();
      } catch (err) {
        alert(`Impor gagal: ${err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span>{t.incidentsTab.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.incidentsTab.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer border border-slate-700 transition-colors">
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t.incidentsTab.btnImport}</span>
            <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all"
          >
            <FolderPlus className="w-4 h-4" />
            <span>{t.incidentsTab.btnNewCase}</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Case List on Left, Case Details & Timeline on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cases List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
            <span>Daftar Kasus ({cases.length})</span>
          </div>

          {cases.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6 text-center text-slate-500 text-xs">
              <p>{t.incidentsTab.emptyCases}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {cases.map((c) => {
                const isSelected = selectedCase?.caseId === c.caseId;
                return (
                  <div
                    key={c.caseId}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCase(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedCase(c);
                      }
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-900/40 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
                        {c.caseId}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          c.status === 'resolved'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                            : c.status === 'investigating'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <h3 className="font-semibold text-sm text-slate-200 line-clamp-1">{c.title}</h3>

                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-slate-500" />
                        {c.incidentType}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Case Detailed Inspection */}
        <div className="lg:col-span-8">
          {selectedCase ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                      {selectedCase.caseId}
                    </span>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <User className="w-3 h-3" /> {selectedCase.reporter}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{selectedCase.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedCase.status}
                    onChange={(e) => handleStatusChange(e.target.value as IncidentCase['status'])}
                    className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="open">Status: Open</option>
                    <option value="investigating">Status: Investigating</option>
                    <option value="resolved">Status: Resolved</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleExport(selectedCase.caseId)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    title="Export Case Bundle (.JSON)"
                  >
                    <Download className="w-4 h-4 text-cyan-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => selectedCase.id && handleDeleteCase(selectedCase.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 border border-slate-700"
                    title="Hapus Kasus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Case Summary */}
              {selectedCase.summary && (
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Ringkasan Insiden
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap">
                    {selectedCase.summary}
                  </p>
                </div>
              )}

              {/* Chronological Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    <span>{t.incidentsTab.timelineTitle} ({timelineEvents.length})</span>
                  </h4>
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-cyan-500 ring-4 ring-slate-900" />
                      <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/70">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-semibold text-slate-200">{evt.action}</span>
                          <span className="font-mono text-slate-500 text-[10px]">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {evt.description && (
                          <p className="text-xs text-slate-400">{evt.description}</p>
                        )}
                        <span className="inline-block mt-1 text-[9px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {evt.source}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Timeline Entry Form */}
                <form onSubmit={handleAddTimeline} className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={eventAction}
                    onChange={(e) => setEventAction(e.target.value)}
                    placeholder="Aksi/Tahapan (misal: Menghubungi Bank)"
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    placeholder="Keterangan singkat..."
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat</span>
                  </button>
                </form>
              </div>

              {/* Investigative Notes */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {t.incidentsTab.caseNotes}
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    Simpan Catatan
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={caseNotes}
                  onChange={(e) => setCaseNotes(e.target.value)}
                  placeholder="Tuliskan catatan teknis analisis, nomor rekening penipu, nomor tiket aduan bank, dll..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center bg-slate-900/30 border border-slate-800/80 rounded-2xl p-8 text-center text-slate-500">
              <FolderPlus className="w-12 h-12 stroke-[1.5] mb-2 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">Pilih kasus untuk melihat detail</p>
              <p className="text-xs text-slate-600 mt-1 max-w-sm">
                Catatan kronologi, bukti forensik, dan nomor tiket akan ditampilkan di sini.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Case Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-cyan-400" />
                <span>{t.incidentsTab.btnNewCase}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCase} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Judul Kasus *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Misal: Phishing SMS Penipuan Rekening BCA Palsu"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Kategori Insiden</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as IncidentCase['incidentType'])}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="phishing">Phishing Link / SMS</option>
                    <option value="financial_fraud">Penipuan Finansial</option>
                    <option value="apk_scam">Penyebaran File APK Scam</option>
                    <option value="account_takeover">Pengambilalihan Akun (ATO)</option>
                    <option value="malvertising">Malvertising Ilegal</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Keparahan</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as SeverityLevel)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="low">Rendah (Low)</option>
                    <option value="medium">Menengah (Medium)</option>
                    <option value="high">Tinggi (High)</option>
                    <option value="critical">Kritis (Critical)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Pelapor / Korban</label>
                <input
                  type="text"
                  value={newReporter}
                  onChange={(e) => setNewReporter(e.target.value)}
                  placeholder="Nama pelapor atau 'Saya'"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Keterangan / Kronologi Singkat</label>
                <textarea
                  rows={3}
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  placeholder="Jelaskan ringkasan apa yang terjadi..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg shadow-md shadow-cyan-500/20"
                >
                  Simpan Kasus Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
