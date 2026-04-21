// public/js/main.js — Lógica do formulário de waitlist
// Extraído do index.html original para arquivo externo (cacheável)

(function () {
  'use strict';

  const form    = document.getElementById('betaForm');
  const emailEl = document.getElementById('betaEmail');
  const submit  = document.getElementById('betaSubmit');
  const msg     = document.getElementById('betaMsg');
  const modal   = document.getElementById('successModal');

  if (!form) return; // Guarda caso o script carregue em outra página

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function setMsg(text, isError) {
    msg.textContent = text;
    msg.className   = 'p-4 rounded-xl border text-sm font-medium transition-all duration-300 ' +
      (isError
        ? 'border-red-500/40 bg-red-500/10 text-red-400'
        : 'border-green-500/40 bg-green-500/10 text-green-400');
    msg.classList.remove('hidden');
  }

  function setLoading(on) {
    submit.disabled = on;
    submit.innerHTML = on
      ? `<span class="flex items-center justify-center gap-2">
           <svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
             <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
             <path class="opacity-75" fill="currentColor"
               d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
             </path>
           </svg>
           <span>Enviando...</span>
         </span>`
      : `<span class="flex items-center justify-center gap-2">
           <span>Entrar na lista de espera</span>
           <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
           </svg>
         </span>`;
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    msg.classList.add('hidden');

    const email    = emailEl.value.trim();
    const honeypot = form.querySelector('[name="honeypot"]')?.value;

    // Honeypot: bot detectado — silencia sem feedback
    if (honeypot) return;

    // Validação client-side (UX)
    if (!email || !email.includes('@') || email.length < 5) {
      setMsg('Por favor, insira um e-mail válido.', true);
      emailEl.focus();
      return;
    }

    setLoading(true);

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('/api/waitlist', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
        signal:  controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 409) {
        // 201 = novo cadastro | 409 = já cadastrado — ambos são "sucesso" pro usuário
        modal.classList.remove('hidden');
        modal.focus();
        form.reset();
      } else {
        const data = await response.json().catch(() => ({}));
        setMsg(data.error || 'Erro ao enviar. Tente novamente.', true);
      }

    } catch (err) {
      if (err.name === 'AbortError') {
        // Timeout: mostra o modal mesmo assim (UX > perfeição)
        modal.classList.remove('hidden');
        form.reset();
      } else {
        setMsg('Sem conexão. Verifique sua internet e tente novamente.', true);
      }
    } finally {
      setLoading(false);
    }
  });

  // ─── Modal ────────────────────────────────────────────────────────────────

  document.getElementById('modalClose')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  modal?.addEventListener('click', function (e) {
    if (e.target === this) this.classList.add('hidden');
  });

  // ESC fecha o modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
  });

})();
