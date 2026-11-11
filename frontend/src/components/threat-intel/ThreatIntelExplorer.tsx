import React, { useState } from 'react';
import {
  Terminal,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useLanguage } from '../../context/useLanguage';

interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  descriptionId: string;
  descriptionEn: string;
  adversaryGoalId: string;
  adversaryGoalEn: string;
  detectionRuleId: string;
  detectionLogicId: string;
  detectionLogicEn: string;
  mitigationId: string;
  mitigationEn: string;
}

const MITRE_DATABASE: MitreTechnique[] = [
  {
    id: 'T1583.001',
    name: 'Acquire Infrastructure: Domains',
    tactic: 'Resource Development (TA0042)',
    severity: 'high',
    descriptionId: 'Penyerang mendaftarkan domain tiruan (typosquatting / combosquatting) yang menyerupai nama merek terpercaya seperti bank atau marketplace.',
    descriptionEn: 'Adversaries acquire domains that visually resemble legitimate brand domains (typosquatting / combosquatting) to mislead victims.',
    adversaryGoalId: 'Membangun infrastruktur penipuan yang kredibel agar korban percaya saat memasukkan kredensial.',
    adversaryGoalEn: 'Establish plausible deception infrastructure to harvest credentials and bypass basic user scrutiny.',
    detectionRuleId: 'URL-BRAND-IMPERSONATION-001 / SEC-02',
    detectionLogicId: 'Ekstraksi registrable domain menggunakan Public Suffix List (PSL) lokal, mendeteksi peniruan nama merek pada SLD/subdomain pihak ketiga.',
    detectionLogicEn: 'Registrable domain extraction via offline Public Suffix List (PSL), detecting brand names in 3rd-party SLD/subdomains.',
    mitigationId: 'Pendaftaran domain defensif oleh pemilik merek, pemantauan sertifikat CT log, dan DNS filtering.',
    mitigationEn: 'Defensive domain registrations, Certificate Transparency (CT) log monitoring, and corporate DNS sinkholing.',
  },
  {
    id: 'T1566.002',
    name: 'Phishing: Spearphishing Link',
    tactic: 'Initial Access (TA0001)',
    severity: 'critical',
    descriptionId: 'Tautan berbahaya dikirim melalui SMS, WhatsApp, atau email untuk memancing korban ke halaman credential harvester.',
    descriptionEn: 'Malicious links delivered via SMS, WhatsApp, or email enticing victims into visiting credential-harvesting landing pages.',
    adversaryGoalId: 'Mengarahkan korban keluar dari platform aman menuju server penyerang.',
    adversaryGoalEn: 'Drive users away from secure applications into attacker-controlled web infrastructure.',
    detectionRuleId: 'URL-MULTI-INSPECT-001 / ANA-05',
    detectionLogicId: 'Inspeksi multi-URL paralel, evaluasi umur domain RDAP (<30 hari), status TLS cert, dan redirect chain.',
    detectionLogicEn: 'Parallel multi-URL inspection, RDAP domain age evaluation (<30 days), TLS cert issuer, and redirect chain tracing.',
    mitigationId: 'Penerapan DMARC (p=reject), edukasi verifikasi domain resmi, dan pembatasan pembukaan tautan eksternal.',
    mitigationEn: 'DMARC enforcement, official domain verification training, and endpoint URL defanging policies.',
  },
  {
    id: 'T1204.002',
    name: 'User Execution: Malicious File (APK)',
    tactic: 'Execution (TA0002)',
    severity: 'critical',
    descriptionId: 'Mengelabui korban agar mengunduh dan memasang aplikasi Android (.APK) berbahaya (misal: modus Surat Tilang, Undangan Pernikahan, Resi Paket JNE).',
    descriptionEn: 'Deceiving victims into downloading and sideloading malicious Android packages (.APK) disguised as wedding invites or courier receipts.',
    adversaryGoalId: 'Mendapatkan izin SMS (`RECEIVE_SMS`, `READ_SMS`) dan Accessibility Service untuk mencuri OTP perbankan.',
    adversaryGoalEn: 'Obtain SMS and Accessibility permissions to silently intercept one-time passwords (OTP) and drain financial accounts.',
    detectionRuleId: 'MSG-TROJAN-APK-001 / HEUR-APK-001',
    detectionLogicId: 'Pencocokan ekstensi .apk, tautan direct download file paket, dan heuristik nama file penyamaran umum di Indonesia.',
    detectionLogicEn: 'Detection of .apk file extensions, direct payload download URLs, and common Indonesian social engineering disguise keywords.',
    mitigationId: 'Nonaktifkan izin "Install Unknown Apps" (Sideloading) pada Android, aktifkan Google Play Protect, dan gunakan passkey.',
    mitigationEn: 'Disable Android unknown sources sideloading, enforce Google Play Protect, and transition to phishing-resistant FIDO2 passkeys.',
  },
  {
    id: 'T1539',
    name: 'Steal Web Session Cookie / OTP Harvest',
    tactic: 'Credential Access (TA0006)',
    severity: 'critical',
    descriptionId: 'Mengecoh korban untuk menyerahkan kode One-Time Password (OTP) 6-digit atau token otentikasi transaksi finansial.',
    descriptionEn: 'Tricking victims into disclosing 6-digit one-time passwords (OTP) or step-up transaction verification tokens.',
    adversaryGoalId: 'Mengambil alih akun perbankan/e-wallet dan melakukan transfer dana keluar tanpa otorisasi sah.',
    adversaryGoalEn: 'Bypass MFA to execute unauthorized financial fund dissipation from banking and digital wallet apps.',
    detectionRuleId: 'MSG-OTP-HARVEST-001 / ANA-06',
    detectionLogicId: 'Deteksi kata kunci permintaan kode OTP, PIN, kode verifikasi WhatsApp, dan nomor kartu CVV.',
    detectionLogicEn: 'Detection of explicit requests for OTP codes, PINs, WhatsApp verification codes, and credit card CVVs.',
    mitigationId: 'Jangan pernah memberikan kode OTP kepada siapa pun termasuk pihak yang mengaku petugas resmi bank.',
    mitigationEn: 'Strict consumer education that legitimate financial institutions never ask for SMS OTP codes over voice or chat.',
  },
  {
    id: 'T1071.001',
    name: 'Application Layer Protocol: Web Protocols',
    tactic: 'Command & Control (TA0011)',
    severity: 'medium',
    descriptionId: 'Penggunaan protokol HTTP/HTTPS port 80/443 standar untuk komunikasi server phishing dan eksfiltrasi kredensial korban.',
    descriptionEn: 'Adversaries utilize standard HTTP/HTTPS protocols on ports 80/443 for phishing payload hosting and exfiltration.',
    adversaryGoalId: 'Menyamarkan lalu lintas serangan agar membaur dengan browsing web harian korban.',
    adversaryGoalEn: 'Blend malicious traffic with legitimate outbound enterprise and consumer web traffic.',
    detectionRuleId: 'SEC-01 / SSRF-STRICT-SOCKET',
    detectionLogicId: 'Pemeriksaan skema ketat (hanya HTTP/HTTPS), socket pinned IP terverifikasi, dan blokir port non-standar berbahaya.',
    detectionLogicEn: 'Strict scheme validation (HTTP/HTTPS only), pinned validated IP sockets, and rejection of non-standard ports.',
    mitigationId: 'Network egress proxying, TLS inspection, dan blocking domain berumur kurang dari 72 jam.',
    mitigationEn: 'Enterprise egress proxies, TLS inspection, and dynamic blocking of newly observed domains (NOD).',
  },
  {
    id: 'T1596',
    name: 'Search Open Technical Databases',
    tactic: 'Reconnaissance (TA0043)',
    severity: 'low',
    descriptionId: 'Pengumpulan informasi domain target dari basis data publik seperti WHOIS, RDAP, dan rekaman DNS.',
    descriptionEn: 'Gathering target domain information from open databases such as WHOIS, RDAP, and DNS records.',
    adversaryGoalId: 'Mengetahui registrar dan infrastruktur target untuk merancang serangan impersonasi yang meyakinkan.',
    adversaryGoalEn: 'Discover target registrars, nameservers, and expiration dates to engineer plausible impersonation scenarios.',
    detectionRuleId: 'NET-RDAP-LOOKUP-001',
    detectionLogicId: 'Audit RDAP publik dengan timeout aman untuk menghitung umur pendaftaran domain.',
    detectionLogicEn: 'Safe RDAP queries with strict timeouts to verify true domain age and registrar anomalies.',
    mitigationId: 'WHOIS privacy protection dan audit registrasi domain berkala.',
    mitigationEn: 'WHOIS privacy protection and continuous registrar audit monitoring.',
  },
];

export const ThreatIntelExplorer: React.FC = () => {
  const { t, language } = useLanguage();
  const [selectedTech, setSelectedTech] = useState<MitreTechnique>(MITRE_DATABASE[0]);
  const isId = language === 'id';

  // Grouping by Tactic
  const tactics = Array.from(new Set(MITRE_DATABASE.map((m) => m.tactic)));

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-purple-400" />
            <span>{t.threatIntelTab.title}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{t.threatIntelTab.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-xs text-purple-300 font-mono">
          <Layers className="w-3.5 h-3.5" />
          <span>MITRE ATT&CK v15 Matrix</span>
        </div>
      </div>

      {/* Main Grid: Matrix on Left, Detailed Inspector Card on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Tactic Columns */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{t.threatIntelTab.matrixTitle}</span>
          </h3>

          <div className="space-y-3">
            {tactics.map((tactic) => {
              const techniques = MITRE_DATABASE.filter((m) => m.tactic === tactic);
              return (
                <div key={tactic} className="bg-slate-900/40 border border-slate-800/90 rounded-xl p-3.5 space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>{tactic}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({techniques.length} Teknik)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {techniques.map((tech) => {
                      const isSelected = selectedTech.id === tech.id;
                      return (
                        <button
                          key={tech.id}
                          type="button"
                          onClick={() => setSelectedTech(tech)}
                          className={`text-left p-3 rounded-lg border text-xs transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-purple-950/60 border-purple-500 shadow-md shadow-purple-500/10 text-white'
                              : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700 text-slate-300'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-mono text-[10px] font-bold text-purple-400 block mb-0.5">
                              {tech.id}
                            </span>
                            <span className="font-semibold block truncate">{tech.name}</span>
                          </div>
                          <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-purple-400' : 'text-slate-600'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Technique Inspector Detail Card */}
        <div className="lg:col-span-5">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5 sticky top-24">
            {/* Header info */}
            <div className="border-b border-slate-800 pb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-xs font-bold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                  {selectedTech.id}
                </span>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  selectedTech.severity === 'critical'
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : selectedTech.severity === 'high'
                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                    : 'bg-slate-800 text-slate-300'
                }`}>
                  {isId ? 'Keparahan' : 'Severity'}: {selectedTech.severity}
                </span>
              </div>
              <h3 className="text-base font-bold text-white">{selectedTech.name}</h3>
              <span className="text-xs text-slate-400 font-mono mt-0.5 block">{selectedTech.tactic}</span>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {isId ? 'Deskripsi Ancaman' : 'Threat Description'}
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isId ? selectedTech.descriptionId : selectedTech.descriptionEn}
              </p>
            </div>

            {/* Adversary Goal */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{t.threatIntelTab.adversaryGoal}</span>
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isId ? selectedTech.adversaryGoalId : selectedTech.adversaryGoalEn}
              </p>
            </div>

            {/* Detection Logic */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>{t.threatIntelTab.detectionLogic}</span>
                </span>
                <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950 px-1.5 py-0.2 rounded border border-cyan-800/50">
                  {selectedTech.detectionRuleId}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isId ? selectedTech.detectionLogicId : selectedTech.detectionLogicEn}
              </p>
            </div>

            {/* Mitigation Checklist */}
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t.threatIntelTab.mitigationAction}</span>
              </span>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isId ? selectedTech.mitigationId : selectedTech.mitigationEn}
              </p>
            </div>

            {/* MITRE Official Link */}
            <div className="pt-2">
              <a
                href={`https://attack.mitre.org/techniques/${selectedTech.id.replace('.', '/')}/`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
              >
                <span>{isId ? 'Lihat Referensi MITRE ATT&CK Resmi' : 'View Official MITRE ATT&CK Reference'}</span>
                <ExternalLink className="w-3 h-3 text-cyan-400" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
