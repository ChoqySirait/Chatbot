// Blok inisialisasi elemen DOM antarmuka
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-messages');
const submitBtn = document.getElementById('submit-btn');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');

// Blok elemen panel telemetri kanan
const intelBadge = document.getElementById('intel-badge');
const intelDomain = document.getElementById('intel-domain');
const intelAge = document.getElementById('intel-age');
const intelSsl = document.getElementById('intel-ssl');
const intelTitle = document.getElementById('intel-title');
const intelHash = document.getElementById('intel-hash');

let chatHistory = [];
let attachedImageBase64 = null;
let lastAnalyzedDomain = "";

// Blok penyesuaian tinggi otomatis kolom input
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Blok pengiriman pesan via tombol Enter (Shift + Enter untuk baris baru)
userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Blok penanganan tempel gambar langsung dari clipboard (Ctrl + V)
window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = (event) => setImage(event.target.result);
            reader.readAsDataURL(blob);
        }
    }
});

// Blok penanganan unggah gambar berkas
imageUpload.addEventListener('change', function() {
    if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => setImage(e.target.result);
        reader.readAsDataURL(this.files[0]);
    }
});

function setImage(base64) {
    attachedImageBase64 = base64;
    imagePreview.src = base64;
    imagePreviewContainer.classList.remove('hidden');
}

function removeImage() {
    attachedImageBase64 = null;
    imageUpload.value = '';
    imagePreviewContainer.classList.add('hidden');
}

// Blok fungsi kasus cepat: hanya mengisi kolom input dan fokus (tanpa auto-send)
function fillInput(text) {
    userInput.value = text;
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
    userInput.focus();
}

// Blok pembaruan panel telemetri sisi kanan
function updateTelemetryPanel(networkIntel, category, score) {
    if (!networkIntel) return;
    
    lastAnalyzedDomain = networkIntel.domain || "-";
    intelDomain.textContent = networkIntel.domain || "-";
    intelAge.textContent = networkIntel.domain_age || "Tidak Diketahui";
    intelSsl.textContent = networkIntel.ssl_valid ? "Valid (HTTPS)" : "Tidak Valid";
    intelTitle.textContent = networkIntel.page_title || "Tanpa Judul";
    intelHash.textContent = networkIntel.evidence_hash || "-";

    if (category === "Aktif Berbahaya (Malicious)") {
        intelBadge.className = "text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded";
        intelBadge.textContent = `BAHAYA (${score}/100)`;
    } else if (category === "Ilegal (Risiko Iklan/Malvertising)") {
        intelBadge.className = "text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded";
        intelBadge.textContent = "NON-RESMI / IKLAN";
    } else if (category === "Resmi/Aman") {
        intelBadge.className = "text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded";
        intelBadge.textContent = "TERVERIFIKASI";
    }
}

// Blok render pesan percakapan ke tampilan
function appendMessage(role, text, data = {}) {
    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = isUser ? 'flex justify-end' : 'flex gap-3 max-w-2xl';

    if (isUser) {
        let imgTag = data.image ? `<img src="${data.image}" class="max-w-xs rounded-xl mb-2 border border-[#1b365c] shadow-sm">` : '';
        wrapper.innerHTML = `
            <div class="bg-[#102442] border border-[#1c3c69] text-slate-100 p-3.5 rounded-2xl rounded-tr-none text-sm max-w-lg shadow-sm">
                ${imgTag}
                <div>${escapeHtml(text)}</div>
            </div>
        `;
    } else {
        const heuristics = data.heuristics;
        const mitreTags = data.mitre_tags || [];
        const category = data.threat_category || "Informasi Umum";

        let alertBox = '';
        if (heuristics && heuristics.has_suspicious_elements) {
            const score = heuristics.heuristic_score;
            const borderCol = score > 50 ? 'border-rose-900 bg-rose-950/30 text-rose-300' : score > 20 ? 'border-amber-900 bg-amber-950/30 text-amber-300' : 'border-blue-900 bg-blue-950/30 text-blue-300';

            alertBox = `
                <div class="mb-3 p-3 rounded-xl border ${borderCol} text-xs">
                    <div class="flex items-center justify-between font-semibold mb-1">
                        <span><i class="fa-solid fa-triangle-exclamation mr-1"></i> Indikator Keamanan (Skor: ${score}/100)</span>
                        <span class="px-2 py-0.5 rounded bg-[#081220] text-[10px] font-mono uppercase">${category}</span>
                    </div>
                    <ul class="list-disc list-inside space-y-0.5 text-slate-300">
                        ${heuristics.risk_flags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        let mitreBadges = '';
        if (mitreTags.length > 0) {
            mitreBadges = `
                <div class="flex flex-wrap gap-1.5 my-2">
                    ${mitreTags.map(tag => `<span class="text-[10px] font-mono bg-[#142640] text-blue-300 border border-[#1e385e] px-2 py-0.5 rounded">${tag}</span>`).join('')}
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex-shrink-0 flex items-center justify-center text-blue-400 text-xs">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="bg-[#0e1e36] border border-[#182d4d] p-4 rounded-2xl rounded-tl-none text-sm text-slate-200 leading-relaxed shadow-sm w-full">
                ${alertBox}
                ${mitreBadges}
                <div class="whitespace-pre-wrap leading-relaxed">${formatMarkdown(text)}</div>
            </div>
        `;
    }

    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Blok pengiriman formulir obrolan ke backend
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message && !attachedImageBase64) return;

    appendMessage('user', message, { image: attachedImageBase64 });
    const imgToSend = attachedImageBase64;
    
    userInput.value = '';
    userInput.style.height = 'auto';
    removeImage();

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin text-xs"></i>';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: message || "Periksa data bukti berikut:", 
                history: chatHistory,
                image_base64: imgToSend
            })
        });

        const data = await response.json();
        if (response.ok) {
            appendMessage('assistant', data.reply, data);
            chatHistory.push({ role: 'user', content: message });
            chatHistory.push({ role: 'assistant', content: data.reply });
            if (chatHistory.length > 8) chatHistory = chatHistory.slice(-8);

            if (data.heuristics && data.heuristics.network_intel) {
                updateTelemetryPanel(data.heuristics.network_intel, data.threat_category, data.heuristics.heuristic_score);
            }
        } else {
            appendMessage('assistant', `Terjadi kendala pada server: ${data.detail || 'Gagal memproses pesan.'}`);
        }
    } catch (err) {
        appendMessage('assistant', 'Gagal tersambung ke backend SecurAI. Pastikan server lokal aktif.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-xs"></i>';
    }
});

// Blok generator unduhan berkas kronologi kejadian penipuan
function downloadIncidentDraft() {
    const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    const targetDomain = lastAnalyzedDomain !== "-" ? lastAnalyzedDomain : "[Tautan / Domain Pelaku]";
    
    const draftContent = `DRAFT KRONOLOGI PENIPUAN TRANSAKSI DIGITAL
Tanggal Pembuatan: ${today}

I. DATA IDENTITAS PELAPOR (KORBAN):
Nama Lengkap      : [Nama Anda Sesuai KTP]
Nomor WhatsApp    : [Nomor HP Anda]
Alamat Email      : [Email Anda]

II. DATA REKENING / MEDIA TERLAPOR (PELAKU):
Nama Bank Pelaku  : [Contoh: BCA / BRI / Mandiri / E-Wallet DANA]
Nomor Rekening    : [Nomor Rekening Tujuan Transfer]
Nama Pemilik      : [Nama Pemilik Rekening Pelaku]
Media Komunikasi  : WhatsApp / Instagram / Tautan Web (${targetDomain})

III. KRONOLOGI KEJADIAN:
1. Pada tanggal [Tanggal Kejadian], pelapor melakukan transaksi atau komunikasi terkait pembelian barang / penawaran promo melalui tautan atau media terlapor.
2. Pelapor telah mengirimkan dana sejumlah Rp [Nominal Uang] ke rekening terlapor.
3. Setelah transaksi berhasil, pihak terlapor memutus kontak, memblokir akun pelapor, dan tidak memenuhi kesepakatan transaksi.

IV. PERMOHONAN:
Pelapor mengajukan permohonan kepada pihak bank terkait untuk melakukan pemblokiran darurat dan penahanan saldo terhadap rekening terlapor guna menghindari timbulnya korban lain.

( [Tanda Tangan / Nama Terang Pelapor] )
`;

    const blob = new Blob([draftContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Draft-Kronologi-Penipuan-${Date.now().toString().slice(-4)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// Blok fungsi reset sesi percakapan
function clearSession() {
    chatHistory = [];
    chatContainer.innerHTML = '';
    appendMessage('assistant', 'Sesi telah direset. Silakan tanyakan hal lain atau tempelkan tautan yang ingin diperiksa.');
    intelDomain.textContent = "-";
    intelAge.textContent = "-";
    intelSsl.textContent = "-";
    intelTitle.textContent = "-";
    intelHash.textContent = "-";
    intelBadge.className = "text-[10px] font-mono bg-[#142640] text-slate-400 px-2 py-0.5 rounded border border-[#1e385e]";
    intelBadge.textContent = "MENUNGGU DATA";
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMarkdown(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/^\s*\*\s(.*)$/gm, '• $1');
    out = out.replace(/^\s*-\s(.*)$/gm, '• $1');
    return out;
}