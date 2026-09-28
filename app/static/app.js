const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-messages');
const submitBtn = document.getElementById('submit-btn');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');

// Komponen Telemetri Panel Kanan
const intelBadge = document.getElementById('intel-badge');
const intelDomain = document.getElementById('intel-domain');
const intelAge = document.getElementById('intel-age');
const intelSsl = document.getElementById('intel-ssl');
const intelTitle = document.getElementById('intel-title');

let chatHistory = [];
let attachedImageBase64 = null;

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

userInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// Fitur Paste Screenshot Langsung (Ctrl + V)
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

// Hanya memasukkan teks ke input (TIDAK auto-submit)
function fillInput(text) {
    userInput.value = text;
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
    userInput.focus();
}

function updateTelemetryPanel(networkIntel, category, score) {
    if (!networkIntel) return;
    
    intelDomain.textContent = networkIntel.domain || "-";
    intelAge.textContent = networkIntel.domain_age || "Tidak Diketahui";
    intelSsl.textContent = networkIntel.ssl_valid ? "Valid (HTTPS)" : "Tidak Valid";
    intelTitle.textContent = networkIntel.page_title || "Tanpa Judul";

    if (category === "Aktif Berbahaya (Malicious)") {
        intelBadge.className = "text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded";
        intelBadge.textContent = `RISK ${score}/100`;
    } else if (category === "Ilegal (Risiko Iklan/Malvertising)") {
        intelBadge.className = "text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded";
        intelBadge.textContent = "PIRACY/ADS";
    } else if (category === "Resmi/Aman") {
        intelBadge.className = "text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded";
        intelBadge.textContent = "SAFE/VERIFIED";
    }
}

function appendMessage(role, text, data = {}) {
    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = isUser ? 'flex justify-end' : 'flex gap-3 max-w-2xl';

    if (isUser) {
        let imgTag = data.image ? `<img src="${data.image}" class="max-w-xs rounded-xl mb-2 border border-cyan-700 shadow-md">` : '';
        wrapper.innerHTML = `
            <div class="bg-cyan-950/70 border border-cyan-800/60 text-slate-100 p-3.5 rounded-2xl rounded-tr-none text-sm max-w-lg shadow-md">
                ${imgTag}
                <div>${escapeHtml(text)}</div>
            </div>
        `;
    } else {
        const heuristics = data.heuristics;
        const mitreTags = data.mitre_tags || [];
        const category = data.threat_category || "Informasi Umum";

        let badgeHeader = '';
        if (heuristics && heuristics.has_suspicious_elements) {
            const score = heuristics.heuristic_score;
            const badgeColor = score > 50 ? 'rose' : score > 20 ? 'amber' : 'yellow';

            badgeHeader = `
                <div class="mb-3 p-3.5 rounded-xl bg-${badgeColor}-950/40 border border-${badgeColor}-800/60 text-xs shadow-inner">
                    <div class="flex items-center justify-between font-semibold text-${badgeColor}-400 mb-1">
                        <span><i class="fa-solid fa-shield-halved"></i> Deteksi Perlindungan Konsumen (Skor: ${score}/100)</span>
                        <span class="px-2 py-0.5 rounded bg-slate-900 border border-${badgeColor}-800 text-[10px] uppercase font-mono">${category}</span>
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
                    ${mitreTags.map(tag => `<span class="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-md">${tag}</span>`).join('')}
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="w-8 h-8 rounded-xl bg-cyan-600/20 border border-cyan-500/40 flex-shrink-0 flex items-center justify-center text-cyan-400 text-xs shadow-inner">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-sm text-slate-200 leading-relaxed shadow-sm w-full">
                ${badgeHeader}
                ${mitreBadges}
                <div class="whitespace-pre-wrap leading-relaxed">${formatMarkdown(text)}</div>
            </div>
        `;
    }

    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

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
                message: message || "Tolong analisis gambar/bukti ini:", 
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

            // Perbarui panel intelijen sisi kanan secara live
            if (data.heuristics && data.heuristics.network_intel) {
                updateTelemetryPanel(data.heuristics.network_intel, data.threat_category, data.heuristics.heuristic_score);
            }
        } else {
            appendMessage('assistant', `⚠️ Kesalahan Server: ${data.detail || 'Gagal memproses pesan.'}`);
        }
    } catch (err) {
        appendMessage('assistant', '⚠️ Gagal tersambung ke backend SecurAI.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-xs"></i>';
    }
});

// Generator Surat Permohonan Blokir Rekening Bank
function generateDisputeLetter() {
    const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
    const template = `SURAT PERMOHONAN PEMBLOKIRAN REKENING PENIPU & MEDIASI FRAUD
Tanggal: ${today}

Kepada Yth.
Bagian Fraud & Risk Management / Customer Care
Bank [Nama Bank Tujuan / Bank Penipu]
Di Tempat

Dengan hormat,
Saya yang bertanda tangan di bawah ini:
Nama Lengkap      : [Nama Anda]
No. KTP/NIK       : [NIK Anda]
No. HP/WhatsApp   : [Nomor HP Anda]
Email             : [Email Anda]

Dengan ini mengajukan permohonan pemblokiran dan penahanan dana terhadap rekening terduga penipuan transaksi digital dengan rincian sebagai berikut:

DATA REKENING TERLAPOR (PELAKU):
- Nama Bank Tujuan : [Contoh: Bank BCA / Mandiri / BRI / DANA]
- No. Rekening     : [Nomor Rekening Pelaku]
- Nama Pemilik     : [Nama Pemilik Rekening Pelaku]
- Jumlah Kerugian  : Rp [Nominal Transfer]
- Waktu Transaksi  : [Tanggal & Jam Transfer]

KRONOLOGI SINGKAT:
Pada tanggal [Tanggal Kejadian], saya melakukan transaksi [Pembelian barang / Jasa / Investasi] melalui media sosial/tautan [Sebutkan Link/Platform]. Setelah dana berhasil ditransfer, pihak terlapor memutus komunikasi dan memblokir kontak saya serta tidak memenuhi kewajibannya.

Bersama surat ini, saya lampirkan dokumen pendukung:
1. Tangkapan layar bukti transfer / mutasi bank.
2. Tangkapan layar percakapan (chat) penipuan.
3. Surat Tanda Penerimaan Laporan (STPL) dari Kepolisian setempat.
4. Bukti laporan resmi di portal CekRekening.id.

Demikian permohonan ini saya ajukan demi mencegah rekening tersebut digunakan untuk merugikan korban lainnya. Atas perhatian dan kerja sama pihak bank, saya ucapkan terima kasih.

Hormat saya,

( [Nama Lengkap Anda] )
`;

    const blob = new Blob([template], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Surat-Permohonan-Blokir-Rekening-Penipu.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearSession() {
    chatHistory = [];
    chatContainer.innerHTML = '';
    appendMessage('assistant', 'Sesi telah direset. Silakan tanyakan hal lain atau kirim tautan baru untuk diperiksa.');
    intelDomain.textContent = "-";
    intelAge.textContent = "-";
    intelSsl.textContent = "-";
    intelTitle.textContent = "-";
    intelBadge.className = "text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded";
    intelBadge.textContent = "STANDBY";
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