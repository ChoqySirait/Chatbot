const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-messages');
const submitBtn = document.getElementById('submit-btn');

let chatHistory = [];

function appendMessage(role, text, heuristics = null) {
    const isUser = role === 'user';
    const wrapper = document.createElement('div');
    wrapper.className = isUser ? 'flex justify-end' : 'flex gap-3 max-w-3xl';

    if (isUser) {
        wrapper.innerHTML = `
            <div class="bg-cyan-950/70 border border-cyan-800/60 text-slate-100 p-3.5 rounded-2xl rounded-tr-none text-sm max-w-xl shadow-sm">
                ${escapeHtml(text)}
            </div>
        `;
    } else {
        let heuristicBadge = '';
        if (heuristics && heuristics.has_suspicious_elements) {
            const score = heuristics.heuristic_score;
            const color = score > 60 ? 'rose' : score > 30 ? 'amber' : 'yellow';
            heuristicBadge = `
                <div class="mb-3 p-3 rounded-lg bg-${color}-950/50 border border-${color}-800/60 text-xs">
                    <div class="flex items-center justify-between font-semibold text-${color}-400 mb-1">
                        <span><i class="fa-solid fa-triangle-exclamation"></i> Heuristic Alert (Risk Score: ${score}/100)</span>
                    </div>
                    <ul class="list-disc list-inside space-y-0.5 text-slate-300">
                        ${heuristics.risk_flags.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500/40 flex-shrink-0 flex items-center justify-center text-cyan-400 text-xs shadow-inner">
                <i class="fa-solid fa-robot"></i>
            </div>
            <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl rounded-tl-none text-sm text-slate-200 leading-relaxed shadow-sm">
                ${heuristicBadge}
                <div class="whitespace-pre-wrap">${formatMarkdown(text)}</div>
            </div>
        `;
    }

    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    appendMessage('user', message);
    userInput.value = '';
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i>';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, history: chatHistory })
        });

        const data = await response.json();
        if (response.ok) {
            appendMessage('assistant', data.reply, data.heuristics);
            chatHistory.push({ role: 'user', content: message });
            chatHistory.push({ role: 'assistant', content: data.reply });
            if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
        } else {
            appendMessage('assistant', `⚠️ Error: ${data.detail || 'Gagal memproses pesan.'}`);
        }
    } catch (err) {
        appendMessage('assistant', '⚠️ Gagal terhubung ke server backend.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Kirim</span> <i class="fa-solid fa-paper-plane text-xs"></i>';
    }
});

function quickPrompt(text) {
    userInput.value = text;
    chatForm.dispatchEvent(new Event('submit'));
}

function clearChat() {
    chatHistory = [];
    chatContainer.innerHTML = '';
    appendMessage('assistant', 'Sesi berhasil direset. Silakan tanyakan hal lain atau kirim tautan baru.');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMarkdown(text) {
    let formatted = escapeHtml(text);
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/^\s*\*\s(.*)$/gm, '• $1');
    return formatted;
}