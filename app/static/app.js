const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-messages');
const submitBtn = document.getElementById('submit-btn');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');

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

// Paste screenshot langsung (Ctrl + V)
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

// Hanya mengisi input dan fokus, TIDAK auto-send
function fillInput(text) {
    userInput.value = text;
    userInput.style.height = 'auto';
    userInput.style.height = (userInput.scrollHeight) + 'px';
    userInput.focus();
}

function appendMessage(role, text, data = {}) {
    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = isUser ? 'flex justify-end' : 'flex gap-3 max-w-3xl';

    if (isUser) {
        let imgTag = data.image ? `<img src="${data.image}" class="max-w-xs rounded-xl mb-2 border border-cyan-700 shadow-md">` : '';
        wrapper.innerHTML = `
            <div class="bg-cyan-950/70 border border-cyan-800/60 text-slate-100 p-3.5 rounded-2xl rounded-tr-none text-sm max-w-xl shadow-md">
                ${imgTag}
                <div>${escapeHtml(text)}</div>
            </div>
        `;
    } else {
        const heuristics = data.heuristics;
        const mitreTags = data.mitre_tags || [];
        const category = data.threat_category || "Informasi Umum";

        // Tentukan apakah pesan ini memuat investigasi insiden/tautan
        const isIncident = (heuristics && (heuristics.has_suspicious_elements || heuristics.detected_urls.length > 0)) 
                            || (category !== "Informasi Umum") 
                            || data.image;

        let badgeHeader = '';
        if (heuristics && heuristics.has_suspicious_elements) {
            const score = heuristics.heuristic_score;
            const badgeColor = score > 50 ? 'rose' : score > 20 ? 'amber' : 'yellow';
            
            let defangedList = heuristics.defanged_urls.length > 0 
                ? `<div class="mt-1 font-mono text-[11px] text-slate-300"><strong>Defanged URLs:</strong> ${heuristics.defanged_urls.join(', ')}</div>` 
                : '';

            let titleInfo = heuristics.web_title ? `<div class="text-[11px] text-slate-400 mt-1"><strong>Judul Halaman:</strong> ${escapeHtml(heuristics.web_title)}</div>` : '';

            badgeHeader = `
                <div class="mb-3 p-3.5 rounded-xl bg-${badgeColor}-950/40 border border-${badgeColor}-800/60 text-xs shadow-inner">
                    <div class="flex items-center justify-between font-semibold text-${badgeColor}-400 mb-1">
                        <span><i class="fa-solid fa-triangle-exclamation"></i> Threat Telemetry (Score: ${score}/100)</span>
                        <span class="px-2 py-0.5 rounded bg-slate-900 border border-${badgeColor}-800 text-[10px] uppercase font-mono">${category}</span>
                    </div>
                    <ul class="list-disc list-inside space-y-0.5 text-slate-300">
                        ${heuristics.risk_flags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                    ${defangedList}
                    ${titleInfo}
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

        // HANYA tampilkan footer Laporan Insiden jika ini adalah investigasi ancaman/link
        let incidentFooter = '';
        if (isIncident) {
            const reportId = 'INC-' + Math.floor(100000 + Math.random() * 900000);
            incidentFooter = `
                <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                    <span class="font-mono text-[10px]">Case ID: ${reportId}</span>
                    <button onclick="exportReport('${reportId}', \`${escapeForExport(text)}\`, '${category}')" class="hover:text-cyan-400 transition flex items-center gap-1 font-mono text-[11px]">
                        <i class="fa-solid fa-download"></i> Unduh Laporan Insiden (.md)
                    </button>
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
                ${incidentFooter}
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
                message: message || "Tolong analisis gambar/link berikut:", 
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
        } else {
            appendMessage('assistant', `⚠️ Kesalahan Server: ${data.detail || 'Gagal memproses pesan.'}`);
        }
    } catch (err) {
        appendMessage('assistant', '⚠️ Gagal tersambung ke server SecurAI.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-xs"></i>';
    }
});

function exportReport(reportId, content, category) {
    const reportMd = `# SecurAI Security Incident Report
**Incident ID:** ${reportId}
**Date:** ${new Date().toISOString()}
**Threat Classification:** ${category}

---
### Investigation Findings:
${content}

---
*Generated by SecurAI - SOC L1 Triage Cockpit*`;

    const blob = new Blob([reportMd], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportId}-Report.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearSession() {
    chatHistory = [];
    chatContainer.innerHTML = '';
    appendMessage('assistant', 'Sesi telah direset. Silakan ajukan pertanyaan atau tempelkan bukti insiden baru.');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeForExport(text) {
    return text.replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function formatMarkdown(text) {
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/^\s*\*\s(.*)$/gm, '• $1');
    out = out.replace(/^\s*-\s(.*)$/gm, '• $1');
    return out;
}