import React, { useState } from 'react';
import { FileText, Copy, Check, Printer, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export const ReportGenerator: React.FC = () => {
  const { t, language } = useLanguage();
  const [bankName, setBankName] = useState('Bank Central Asia (BCA)');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().split('T')[0]);
  const [lossAmount, setLossAmount] = useState('2.500.000');
  const [victimName, setVictimName] = useState('');
  const [victimAccount, setVictimAccount] = useState('');
  const [scammerAccount, setScammerAccount] = useState('');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(generateLetterText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>{t.reportsTab.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.reportsTab.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? t.common.copied : t.reportsTab.btnCopyReport}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>{t.reportsTab.btnPrintReport}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Inputs on Left */}
        <div className="lg:col-span-5 bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Parameter Surat Resmi
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">{t.reportsTab.recipientBank}</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Bank Central Asia (BCA) / Mandiri / BRI / Dana"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">{t.reportsTab.transactionDate}</label>
                <input
                  type="date"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t.reportsTab.lostAmount}</label>
                <input
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
                <label className="block text-slate-400 mb-1">{t.reportsTab.victimName}</label>
                <input
                  type="text"
                  value={victimName}
                  onChange={(e) => setVictimName(e.target.value)}
                  placeholder="Nama Lengkap Korban"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">{t.reportsTab.victimAccount}</label>
                <input
                  type="text"
                  value={victimAccount}
                  onChange={(e) => setVictimAccount(e.target.value)}
                  placeholder="1234567890"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">{t.reportsTab.scammerAccount}</label>
              <input
                type="text"
                value={scammerAccount}
                onChange={(e) => setScammerAccount(e.target.value)}
                placeholder="Nomor rekening penipu, bank penipu, atau nomor WhatsApp"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Kronologi Ringkas Kejadian</label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tuliskan urutan kejadian, pesan yang diterima, dan bagaimana Anda diarahkan melakukan transfer..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Formatted Letter Preview on Right */}
        <div className="lg:col-span-7 bg-white text-slate-900 rounded-2xl p-8 shadow-xl font-serif text-xs leading-relaxed border border-slate-300 print:border-none print:shadow-none print:p-0">
          <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
            <div className="font-bold tracking-widest text-sm uppercase">SecurAI Incident Assistance Documentation</div>
            <div className="text-[10px] text-slate-600 font-sans">Dokumen Resmi Bantuan Nasabah & Pelaporan Penipuan Digital</div>
          </div>

          <pre className="whitespace-pre-wrap font-serif text-slate-800 leading-normal select-all">
            {generateLetterText()}
          </pre>

          <div className="mt-8 pt-4 border-t border-slate-300 text-[10px] text-slate-500 font-sans flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            <span>Dokumen dibuat menggunakan standar bantuan SecurAI. Bukti forensik tersimpan secara mandiri pada perangkat pemohon.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
