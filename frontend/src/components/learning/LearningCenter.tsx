import React, { useState } from 'react';
import {
  GraduationCap,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useLanguage } from '../../context/useLanguage';

interface QuizQuestion {
  id: number;
  category: string;
  sender: string;
  messageContent: string;
  isPhishing: boolean;
  explanationId: string;
  explanationEn: string;
  redFlagsId: string[];
  redFlagsEn: string[];
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    category: 'SMS Perbankan',
    sender: '+6281299887766',
    messageContent:
      'REKENING BCA ANDA AKAN DIBLOKIR! Kami mendeteksi transaksi mencurigakan Rp 15.000.000. Segera batalkan dalam 15 menit via: https://bca.promo-verifikasi.top',
    isPhishing: true,
    explanationId:
      'Pesan ini menggunakan domain tiruan (promo-verifikasi.top alih-alih bca.co.id) dan menciptakan kepanikan buatan dengan batas waktu 15 menit.',
    explanationEn:
      'This message leverages a lookalike domain (promo-verifikasi.top instead of bca.co.id) and creates artificial panic with a 15-minute countdown.',
    redFlagsId: [
      'Domain bukan bca.co.id (domain registrable: promo-verifikasi.top)',
      'Desakan waktu ekstrem (urgency heuristic)',
      'Dikirim dari nomor seluler pribadi +62812..., bukan ID resmi pengirim bank',
    ],
    redFlagsEn: [
      'Domain is not bca.co.id (registrable domain is promo-verifikasi.top)',
      'Extreme artificial urgency heuristic',
      'Sent from an ordinary cell phone number, not official bank sender ID',
    ],
  },
  {
    id: 2,
    category: 'WhatsApp Kurir Paket',
    sender: 'JNE Express Delivery',
    messageContent:
      'Halo Kak, paket Anda tertahan di gudang karena alamat tidak lengkap. Silakan instal aplikasi pelacak resi berikut: Surat_Resi_JNE_Paket.apk',
    isPhishing: true,
    explanationId:
      'Ekstensi berkas adalah .APK (aplikasi Android), bukan dokumen PDF atau gambar resi. Jika dipasang, aplikasi ini dapat mencuri SMS OTP Anda.',
    explanationEn:
      'The file extension is .APK (Android app package), not a PDF document. If installed, it will silently intercept SMS OTPs.',
    redFlagsId: [
      'Ekstensi berkas .APK yang disamarkan sebagai resi',
      'Kurir resmi tidak pernah meminta penerima menginstal file APK melalui chat',
      'Potensi pencurian izin SMS dan Accessibility Service',
    ],
    redFlagsEn: [
      '.APK file extension disguised as a shipping receipt',
      'Official couriers never ask recipients to sideload APK files via WhatsApp',
      'Threat of SMS interception and Accessibility permission hijacking',
    ],
  },
  {
    id: 3,
    category: 'Notifikasi Resmi E-Commerce',
    sender: 'Tokopedia',
    messageContent:
      'Pesanan #INV/2026/05/11 telah dikirim oleh kurir. Lacak langsung pada menu Transaksi di aplikasi Tokopedia atau kunjungi https://www.tokopedia.com',
    isPhishing: false,
    explanationId:
      'Pesan ini mengarahkan pengguna ke aplikasi resmi atau domain registrable resmi tokopedia.com tanpa meminta password, OTP, atau instalasi file.',
    explanationEn:
      'This notification directs users to the official app or official registrable domain tokopedia.com without requesting credentials, OTPs, or files.',
    redFlagsId: ['Tidak ada unsur mencurigakan. Domain resmi tokopedia.com terverifikasi PSL.'],
    redFlagsEn: ['No suspicious elements. Official domain tokopedia.com verified via PSL.'],
  },
  {
    id: 4,
    category: 'Lowongan Kerja Paruh Waktu',
    sender: 'HR Recruitment International',
    messageContent:
      'Selamat! Anda terpilih kerja sampingan online like video YouTube dibayar Rp 500.000/hari. Untuk memulai silakan deposit modal awal Rp 100.000 ke rekening bendahara.',
    isPhishing: true,
    explanationId:
      'Modus penipuan "task scam / like video". Perusahaan resmi tidak pernah memungut biaya atau meminta deposit modal untuk mulai bekerja.',
    explanationEn:
      'Classic "task scam / YouTube like fraud". Legitimate employers never ask candidates to transfer money/deposit before working.',
    redFlagsId: [
      'Menjanjikan penghasilan tinggi untuk pekerjaan sangat mudah',
      'Meminta transfer deposit awal (financial advance fee fraud)',
    ],
    redFlagsEn: [
      'Unrealistically high income promised for trivial tasks',
      'Advance fee deposit demanded before commencing work',
    ],
  },
  {
    id: 5,
    category: 'Pemberitahuan Pajak / Tilang',
    sender: 'Korlantas Polri (Palsu)',
    messageContent:
      'Kendaraan Anda terdeteksi melanggar batas kecepatan kamera ETLE. Unduh surat tilang elektronik berikut untuk melihat foto bukti: Surat_ETLE_Konfirmasi.apk',
    isPhishing: true,
    explanationId:
      'Kepolisian Republik Indonesia tidak pernah mengirimkan surat tilang ETLE dalam format file .APK melalui pesan WhatsApp.',
    explanationEn:
      'Law enforcement agencies never send official traffic violation notices as .APK files over WhatsApp.',
    redFlagsId: [
      'Pengiriman format .APK berkedok dokumen resmi negara',
      'Meniru lembaga penegak hukum resmi (Government Impersonation)',
    ],
    redFlagsEn: [
      '.APK file disguised as an official government citation',
      'Impersonation of law enforcement agencies',
    ],
  },
];

interface CaseStudy {
  id: string;
  titleId: string;
  titleEn: string;
  badge: string;
  summaryId: string;
  summaryEn: string;
  preventionId: string[];
  preventionEn: string[];
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'CS-01',
    titleId: 'Modus Surat Undangan & Resi Paket (.APK)',
    titleEn: 'Malicious Android APK (Wedding & Courier Scams)',
    badge: 'Kritis (Critical)',
    summaryId:
      'Pelaku mengirim file dengan nama "Undangan_Pernikahan.apk" atau "Foto_Paket.apk". Korban yang membuka file diminta mengizinkan instalasi aplikasi tidak dikenal. Setelah terpasang, malware membaca seluruh SMS masuk untuk mencuri OTP m-banking.',
    summaryEn:
      'Scammers send APK files titled "Wedding_Invite.apk" or "Courier_Photo.apk". Victims granting sideloading permissions expose their SMS inbox, allowing attackers to intercept one-time passwords and execute fund transfers.',
    preventionId: [
      'Jangan pernah membuka file berakhiran .APK yang dikirim lewat WhatsApp atau Telegram.',
      'Kunci pengaturan: "Install Unknown Apps" / "Instal Sumber Tidak Dikenal" selalu pada posisi OFF.',
      'Jika terlanjur terpasang: Segera aktifkan Airplane Mode, cabut kartu SIM, dan uninstall aplikasi tersebut via Pengaturan Aplikasi.',
    ],
    preventionEn: [
      'Never open or install files ending in .APK sent via chat applications.',
      'Keep "Install Unknown Apps" disabled in your Android security settings.',
      'If accidentally installed: Immediately switch to Airplane mode, remove SIM, and uninstall via Settings.',
    ],
  },
  {
    id: 'CS-02',
    titleId: 'Modus Phishing Domain Tiruan & Perubahan Tarif Transfer Bank',
    titleEn: 'Banking Lookalike Domains & Fake Fee Increase Schemes',
    badge: 'Tinggi (High)',
    summaryId:
      'Pelaku menyebarkan iklan di media sosial atau pesan WhatsApp tentang kenaikan tarif transfer bank menjadi Rp 150.000/bulan, disertai tautan formulir penolakan ke situs palsu (misal: bca-tarif-update.com).',
    summaryEn:
      'Scammers circulate social media ads alleging sudden bank transfer fee hikes (e.g. IDR 150,000/month), linking to fake cancellation portals designed to harvest usernames, PINs, and OTPs.',
    preventionId: [
      'Cek domain pada address bar: Bank Central Asia hanya menggunakan bca.co.id, Bank Mandiri hanya bankmandiri.co.id.',
      'Bank tidak pernah meminta nasabah mengisi nomor kartu debit, CVV, atau PIN untuk konfirmasi tarif.',
      'Laporkan nomor penipu ke kanal aduan resmi bank terkait.',
    ],
    preventionEn: [
      'Always inspect the address bar: Indonesian banks only use accredited .co.id domains.',
      'Banks never require debit card CVV numbers or PINs to confirm fee structures.',
      'Report scam handles directly to official bank support channels.',
    ],
  },
  {
    id: 'CS-03',
    titleId: 'Modus Malvertising & Pop-Up Pembersih Virus Palsu',
    titleEn: 'Malvertising & Fake Virus Warning Pop-ups',
    badge: 'Menengah (Medium)',
    summaryId:
      'Saat membaca komik atau menonton streaming di situs non-resmi, muncul pop-up berkedip merah bertuliskan "HP Anda Terkena 13 Virus! Klik untuk Membersihkan". Tautan tersebut mengarahkan ke langganan SMS premium atau aplikasi scam.',
    summaryEn:
      'While browsing unlicensed comic or streaming sites, aggressive pop-ups claim "Your Phone Has 13 Viruses! Click to Clean". Clicking subscribes the user to costly premium SMS services or scams.',
    preventionId: [
      'Jangan panik: Browser web tidak bisa memindai sistem ponsel Anda dari halaman web biasa.',
      'Tutup tab browser tersebut dan bersihkan cache browser.',
      'Gunakan pemblokir iklan (Ad-blocker) yang terpercaya saat mengakses situs publik.',
    ],
    preventionEn: [
      'Stay calm: Standard web browsers cannot scan your operating system for viruses.',
      'Close the tab immediately and clear recent cache.',
      'Use trusted ad-blockers when reading independent content.',
    ],
  },
];

export const LearningCenter: React.FC = () => {
  const { t, language } = useLanguage();
  const [subTab, setSubTab] = useState<'quiz' | 'catalog'>('quiz');
  const isId = language === 'id';

  // Quiz state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, boolean | null>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);

  const currentQ = QUIZ_QUESTIONS[currentIdx];

  const handleAnswer = (answerIsPhishing: boolean) => {
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: answerIsPhishing }));
    setShowExplanation(true);
  };

  const handleNext = () => {
    setShowExplanation(false);
    if (currentIdx + 1 < QUIZ_QUESTIONS.length) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handleResetQuiz = () => {
    setCurrentIdx(0);
    setUserAnswers({});
    setShowExplanation(false);
    setQuizFinished(false);
  };

  const calculateScore = () => {
    let correct = 0;
    for (const q of QUIZ_QUESTIONS) {
      if (userAnswers[q.id] === q.isPhishing) {
        correct++;
      }
    }
    return Math.round((correct / QUIZ_QUESTIONS.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-400" />
            <span>{t.learnTab.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.learnTab.subtitle}</p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSubTab('quiz')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              subTab === 'quiz' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{t.learnTab.quizTitle}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('catalog')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              subTab === 'catalog' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t.learnTab.caseStudies}</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: Interactive Phishing Quiz Simulator */}
      {subTab === 'quiz' && (
        <div className="max-w-3xl mx-auto">
          {!quizFinished ? (
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
              {/* Progress bar */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-emerald-400">
                  Skenario {currentIdx + 1} dari {QUIZ_QUESTIONS.length}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  {currentQ.category}
                </span>
              </div>

              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / QUIZ_QUESTIONS.length) * 100}%` }}
                />
              </div>

              {/* Simulated Mobile Message Card */}
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-800/80 pb-2">
                  <span className="font-mono text-cyan-400 font-semibold">{currentQ.sender}</span>
                  <span>Hari Ini, 14:28</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 font-sans leading-relaxed pt-1 whitespace-pre-wrap select-all">
                  {currentQ.messageContent}
                </p>
              </div>

              {/* Answer options */}
              {!showExplanation ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => handleAnswer(false)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-emerald-950 hover:border-emerald-700/80 text-slate-200 hover:text-emerald-300 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Aman / Wajar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAnswer(true)}
                    className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-rose-950 hover:border-rose-700/80 text-slate-200 hover:text-rose-300 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-2 transition-all"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <span>Penipuan / Phishing</span>
                  </button>
                </div>
              ) : (
                /* Explanation block */
                <div className="space-y-4 pt-2">
                  {userAnswers[currentQ.id] === currentQ.isPhishing ? (
                    <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-700/70 text-emerald-300 text-xs flex items-center gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-sm">Tepat Sekali! Analisis Anda Benar.</span>
                        <span className="opacity-90">
                          {currentQ.isPhishing
                            ? 'Pesan ini adalah indikasi ancaman siber.'
                            : 'Pesan ini adalah notifikasi resmi tanpa indikasi ancaman.'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-700/70 text-rose-300 text-xs flex items-center gap-2.5">
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      <div>
                        <span className="font-bold block text-sm">Kurang Tepat!</span>
                        <span className="opacity-90">
                          Pesan ini sebenarnya{' '}
                          {currentQ.isPhishing ? 'BERBAHAYA (Phishing/Scam)' : 'AMAN (Resmi)'}.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <span className="font-bold text-slate-300 block">Penjelasan Forensik:</span>
                    <p className="text-slate-400 leading-relaxed">
                      {isId ? currentQ.explanationId : currentQ.explanationEn}
                    </p>

                    <span className="font-bold text-slate-300 block pt-2">Indikator Kunci (Red Flags):</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      {(isId ? currentQ.redFlagsId : currentQ.redFlagsEn).map((flag, idx) => (
                        <li key={idx} className="text-slate-300">{flag}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <span>{currentIdx + 1 === QUIZ_QUESTIONS.length ? 'Lihat Skor Akhir' : 'Lanjut Skenario Berikutnya'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Quiz Completed Score Card */
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-emerald-950 border border-emerald-700/80 text-emerald-400 flex items-center justify-center mx-auto">
                <Award className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white mb-1">Simulasi Selesai!</h3>
                <p className="text-xs text-slate-400">{t.learnTab.scoreResult}</p>
              </div>

              <div className="py-2">
                <span className="text-5xl font-extrabold font-mono text-emerald-400">
                  {calculateScore()}
                </span>
                <span className="text-lg text-slate-500 font-mono"> / 100</span>
              </div>

              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                {calculateScore() >= 80
                  ? 'Luar biasa! Anda memiliki kepekaan tajam terhadap domain tiruan, file APK berbahaya, dan desakan rekayasa sosial.'
                  : 'Tetap waspada! Pelajari katalog studi kasus di sebelah untuk mengenali teknik penyamaran yang sering dipakai pelaku.'}
              </p>

              <div className="pt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetQuiz}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-2 border border-slate-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Ulangi Simulasi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab('catalog')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
                >
                  Pelajari Studi Kasus
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: Threat Case Studies Catalog */}
      {subTab === 'catalog' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CASE_STUDIES.map((study) => (
            <div
              key={study.id}
              className="bg-slate-900/40 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-cyan-400 font-bold bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800/60">
                    {study.id}
                  </span>
                  <span className="text-[10px] font-bold text-rose-300 bg-rose-950 px-2 py-0.5 rounded-full border border-rose-800/80">
                    {study.badge}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-white leading-snug">
                  {isId ? study.titleId : study.titleEn}
                </h3>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {isId ? study.summaryId : study.summaryEn}
                </p>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Langkah Pencegahan Utama:</span>
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 leading-normal">
                    {(isId ? study.preventionId : study.preventionEn).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
