import React, { useState, useEffect } from 'react';
import {
  FileText,
  Copy,
  Check,
  Printer,
  ShieldAlert,
  FileCode,
  Download,
  FolderGit2,
  FileCheck,
} from 'lucide-react';
import { useLanguage } from '../../context/useLanguage';
import { db } from '../../db';
import type { IncidentCase } from '../../types/api';
import { generateMarkdownDossier, downloadFile } from '../../utils/reportExporter';

export const ReportGenerator: React.FC = () => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'dispute' | 'dossier'>('dispute');

  // Dispute form state
  const [bankName, setBankName] = useState('Bank Central Asia (BCA)');
  const [incidentDate, setIncidentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lossAmount, setLossAmount] = useState('2.500.000');
  const [victimName, setVictimName] = useState('');
  const [victimAccount, setVictimAccount] = useState('');
  const [scammerAccount, setScammerAccount] = useState('');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

  // Forensic dossier state
  const [cases, setCases] = useState<IncidentCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [dossierMarkdown, setDossierMarkdown] = useState<string>('');
  const [loadedCaseKey, setLoadedCaseKey] = useState<string>('');

  // Load available cases for dossier
  useEffect(() => {
    let active = true;
    db.incidents
      .reverse()
      .sortBy('createdAt')
      .then((list) => {
        if (!active) return;
        setCases(list);
        if (list.length > 0) {
          setSelectedCaseId((prev) => prev || list[0].caseId);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Generate dossier whenever selectedCaseId or language changes
  useEffect(() => {
    if (!selectedCaseId) return;

    let active = true;
    const targetKey = `${selectedCaseId}:${language}`;

    const buildDossier = async () => {
      const incident = await db.incidents.where('caseId').equals(selectedCaseId).first();
      if (!incident || !active) return;

      const [timeline, evidence] = await Promise.all([
        db.timeline.where('incidentId').equals(selectedCaseId).sortBy('timestamp'),
        db.evidence.where('incidentId').equals(selectedCaseId).sortBy('capturedAt'),
      ]);

      const md = await generateMarkdownDossier({
        incident,
        timeline,
        evidence,
        locale: language,
      });
      if (active) {
        setDossierMarkdown(md);
        setLoadedCaseKey(targetKey);
      }
    };

    buildDossier();
    return () => {
      active = false;
    };
  }, [selectedCaseId, language]);

  const activeDossierMarkdown = selectedCaseId ? dossierMarkdown : '';
  const loadingDossier = Boolean(selectedCaseId && loadedCaseKey !== `${selectedCaseId}:${language}`);

  const generateLetterText = () => {
    if (language === 'en') {
      return `FORMAL NOTICE OF DISPUTED TRANSACTION & CYBER FRAUD INCIDENT REPORT

Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
To: Fraud Department / Customer Protection Services
Institution: ${bankName}

Subject: Request for Immediate Account Block and Investigation of Fraudulent Transaction

I, the undersigned:
- Full Name: ${victimName || '[Victim Full Name]'}
- Account/Identifier Number: ${victimAccount || '[Victim Account Number]'}
- Contact: Registered Customer Phone / Email

Hereby formally report that on ${incidentDate}, an unauthorized/fraudulent transaction occurred resulting in an estimated loss of IDR ${lossAmount}.

Perpetrator / Destination Account Details:
- Recipient / Scammer Account / Handle: ${scammerAccount || '[Scammer Account / Phone Number]'}

Incident Chronology & Forensic Context:
${description || 'A phishing/fraud attack was perpetrated through an impersonated banking link/SMS, misleading the victim into an unauthorized transfer.'}

Technical Forensic Evidence:
- Verified and sealed via SecurAI On-Device Digital Trust Engine.
- SHA-256 evidence seals and timestamped logs have been retained for law enforcement investigation.

Demands & Actions Requested:
1. Immediately freeze/block the destination scammer account to prevent further dissipation of funds.
2. Initiate inter-bank recall/chargeback investigation protocol.
3. Issue an official case reference number for submission to the Cyber Crime Police Department.

I certify that the information provided above is true and accurate to the best of my knowledge.

Sincerely,


__________________________
(${victimName || 'Victim Signature'})`;
    }

    return `SURAT PERMOHONAN SANGGAHAN TRANSAKSI (DISPUTE) & ADUAN INSIDEN REKAYASA SOSIAL

Tanggal: ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
Kepada Yth:
Bagian Penanganan Fraud / Perlindungan Nasabah
${bankName}

Perihal: Permohonan Blokir Rekening Pelaku dan Penyelidikan Transaksi Penipuan Finansial

Dengan hormat,
Saya yang bertanda tangan di bawah ini:
- Nama Lengkap: ${victimName || '[Nama Lengkap Korban]'}
- Nomor Rekening / Akun Terdaftar: ${victimAccount || '[Nomor Rekening Nasabah]'}
- Hubungan: Nasabah Pemilik Rekening

Bersama surat ini, saya menyampaikan aduan resmi mengenai telah terjadinya transaksi tidak sah akibat penipuan / phishing / rekayasa sosial pada tanggal ${incidentDate}, dengan estimasi kerugian sebesar Rp ${lossAmount}.

Rincian Rekening / Pihak Penerima (Terduga Pelaku):
- Rekening / Nomor Telepon Terduga Pelaku: ${scammerAccount || '[Nomor Rekening / Kontak Pelaku]'}

Kronologi Kejadian Singkat:
${description || 'Korban menerima pesan SMS/WhatsApp/tautan phishing yang menyerupai kanal resmi perbankan, yang berujung pada transfer dana tanpa disadari.'}

Bukti Digital & Integritas:
- Seluruh artefak bukti digital (URL, tangkapan layar, nomor referensi) telah diamankan menggunakan segel kriptografis SHA-256 melalui SecurAI Digital Trust Platform.
- Draf ini disiapkan untuk melengkapi Berita Acara Pemeriksaan (BAP) Kepolisian Republik Indonesia.

Tuntutan / Permohonan Nasabah:
1. Melakukan pemblokiran segera terhadap rekening tujuan penipu sesuai instruksi OJK / Surat Edaran Bank Indonesia.
2. Memfasilitasi mediasi penelusuran dana (fund recovery / recall).
3. Memberikan Surat Keterangan / Nomor Tiket Aduan resmi untuk keperluan pelaporan ke Kepolisian.

Demikian permohonan ini saya sampaikan dengan sebenar-benarnya untuk ditindaklanjuti secara cepat. Atas perhatian dan kerjasamanya, saya ucapkan terima kasih.


Hormat saya,


__________________________
(${victimName || 'Tanda Tangan Pelapor'})`;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadMarkdown = () => {
    if (!dossierMarkdown) return;
    downloadFile(`securai-forensic-dossier-${selectedCaseId}.md`, dossierMarkdown, 'text/markdown');
  };

  const handleDownloadJson = async () => {
    if (!selectedCaseId) return;
    const incident = await db.incidents.where('caseId').equals(selectedCaseId).first();
    const timeline = await db.timeline.where('incidentId').equals(selectedCaseId).toArray();
    const evidence = await db.evidence.where('incidentId').equals(selectedCaseId).toArray();

    const jsonContent = JSON.stringify(
      {
        schemaVersion: '1.0',
        exportedAt: new Date().toISOString(),
        incident,
        timeline,
        evidence,
      },
      null,
      2
    );
    downloadFile(`securai-canonical-report-${selectedCaseId}.json`, jsonContent, 'application/json');
  };

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>{t.reportsTab.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.reportsTab.subtitle}</p>
        </div>

        {/* Tab switch between Dispute letter and Forensic Dossier */}
        <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('dispute')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'dispute'
                ? 'bg-cyan-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Bank Dispute Letter' : 'Surat Sanggahan Bank'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dossier')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'dossier'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Forensic Dossier (.MD/JSON)' : 'Dosir Forensik Insiden (.MD/JSON)'}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Bank Dispute Letter */}
      {activeTab === 'dispute' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2 print:hidden">
            <button
              type="button"
              onClick={() => handleCopy(generateLetterText())}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? t.common.copied : t.reportsTab.btnCopyReport}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>{t.reportsTab.btnPrintReport}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print:block">
            <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4 min-w-0 print:hidden">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {language === 'en' ? 'Dispute Letter Parameters' : 'Parameter Surat Sanggahan'}
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label htmlFor="dispute-bank-name" className="block text-slate-400 mb-1">
                    {t.reportsTab.recipientBank}
                  </label>
                  <input
                    id="dispute-bank-name"
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Bank Central Asia (BCA) / Mandiri / BRI"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="dispute-date" className="block text-slate-400 mb-1">
                      {t.reportsTab.transactionDate}
                    </label>
                    <input
                      id="dispute-date"
                      type="date"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="dispute-loss-amount" className="block text-slate-400 mb-1">
                      {t.reportsTab.lostAmount}
                    </label>
                    <input
                      id="dispute-loss-amount"
                      type="text"
                      value={lossAmount}
                      onChange={(e) => setLossAmount(e.target.value)}
                      placeholder="2.500.000"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="dispute-victim-name" className="block text-slate-400 mb-1">
                      {t.reportsTab.victimName}
                    </label>
                    <input
                      id="dispute-victim-name"
                      type="text"
                      value={victimName}
                      onChange={(e) => setVictimName(e.target.value)}
                      placeholder={language === 'en' ? 'Full name' : 'Nama Korban'}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="dispute-victim-account" className="block text-slate-400 mb-1">
                      {t.reportsTab.victimAccount}
                    </label>
                    <input
                      id="dispute-victim-account"
                      type="text"
                      value={victimAccount}
                      onChange={(e) => setVictimAccount(e.target.value)}
                      placeholder="1234567890"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="dispute-scammer-account" className="block text-slate-400 mb-1">
                    {t.reportsTab.scammerAccount}
                  </label>
                  <input
                    id="dispute-scammer-account"
                    type="text"
                    value={scammerAccount}
                    onChange={(e) => setScammerAccount(e.target.value)}
                    placeholder={language === 'en' ? 'Perpetrator account or phone handle' : 'Nomor rekening penipu atau nomor WhatsApp'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label htmlFor="dispute-description" className="block text-slate-400 mb-1">
                    {language === 'en' ? 'Brief Incident Chronology' : 'Kronologi Ringkas Kejadian'}
                  </label>
                  <textarea
                    id="dispute-description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'Describe how you were directed to the fraudulent link or transfer...'
                        : 'Tuliskan bagaimana Anda diarahkan ke tautan palsu...'
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 min-w-0 bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-xl font-serif text-xs leading-relaxed border border-slate-300 print:col-span-12 print:w-full print:border-none print:shadow-none print:p-0">
              <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
                <div className="font-bold tracking-widest text-sm uppercase">SecurAI Dispute Notice</div>
                <div className="text-[10px] text-slate-600 font-sans">
                  {language === 'en'
                    ? 'Customer Transaction Dispute & Incident Support Draft'
                    : 'Dokumen Resmi Sanggahan Transaksi & Bantuan Nasabah'}
                </div>
              </div>

              <pre className="whitespace-pre-wrap font-serif text-slate-800 leading-normal select-all">
                {generateLetterText()}
              </pre>

              <div className="mt-8 pt-4 border-t border-slate-300 text-[10px] text-slate-500 font-sans flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {language === 'en'
                    ? 'Self-generated notice. Cryptographic evidence seals remain stored locally on your device.'
                    : 'Dokumen dicetak secara mandiri. Segel bukti digital disimpan di brankas perangkat.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: Comprehensive Forensic Dossier (Markdown / JSON / Printable PDF) */}
      {activeTab === 'dossier' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/40 p-4 rounded-xl border border-slate-800 print:hidden">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <FolderGit2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <label htmlFor="dossier-case-select" className="text-xs text-slate-300 font-semibold shrink-0">
                {language === 'en' ? 'Select Incident Case:' : 'Pilih Kasus Insiden:'}
              </label>
              {cases.length === 0 ? (
                <span className="text-xs text-slate-500 italic">
                  {language === 'en' ? 'No saved incident cases yet' : 'Belum ada kasus insiden tersimpan'}
                </span>
              ) : (
                <select
                  id="dossier-case-select"
                  value={selectedCaseId}
                  onChange={(e) => setSelectedCaseId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-500"
                >
                  {cases.map((c) => (
                    <option key={c.caseId} value={c.caseId}>
                      [{c.caseId}] {c.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => handleCopy(activeDossierMarkdown)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t.common.copied : t.common.copy}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadMarkdown}
                disabled={!activeDossierMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{language === 'en' ? 'Download Markdown (.MD)' : 'Unduh Markdown (.MD)'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={!selectedCaseId}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 disabled:opacity-50"
              >
                <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                <span>{language === 'en' ? 'Download JSON' : 'Unduh JSON'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                disabled={!activeDossierMarkdown}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{language === 'en' ? 'Print / Save PDF' : 'Cetak / Simpan PDF'}</span>
              </button>
            </div>
          </div>

          {/* Markdown Dossier Preview */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-x-auto max-h-[700px] overflow-y-auto print:bg-white print:text-slate-900 print:border-none print:rounded-none print:p-0 print:max-h-none print:overflow-visible">
            {loadingDossier ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {language === 'en' ? 'Compiling forensic dossier...' : 'Menyusun dosir forensik...'}
              </div>
            ) : activeDossierMarkdown ? (
              <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed select-all print:text-slate-900">
                {activeDossierMarkdown}
              </pre>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                {language === 'en'
                  ? 'Select or create a case in Incident Cases first to export a forensic dossier.'
                  : 'Pilih atau buat kasus di tab Kasus Insiden terlebih dahulu untuk mengekspor dosir forensik.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
