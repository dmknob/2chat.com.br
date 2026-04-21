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

  // ─── Submit (Para Múltiplos Formulários) ──────────────────────────────────
  
  const forms = document.querySelectorAll('form[id^="betaForm"]');

  forms.forEach(currentForm => {
      currentForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        
        // Determinar o msg container pai ou adjacente
        const currentMsg = currentForm.parentElement.parentElement.querySelector('[id^="betaMsg"]') 
                           || currentForm.nextElementSibling;
                           
        if (currentMsg) currentMsg.classList.add('hidden');
    
        const currentEmailEl = currentForm.querySelector('input[type="email"]');
        const submitBtn      = currentForm.querySelector('button[type="submit"]');
        const email          = currentEmailEl.value.trim();
        const honeypot       = currentForm.querySelector('[name="honeypot"]')?.value;
    
        // Honeypot: bot detectado — silencia sem feedback
        if (honeypot) return;
        
        function localSetMsg(text, isError) {
            if (!currentMsg) return;
            currentMsg.textContent = text;
            currentMsg.className   = 'mt-4 text-sm font-medium transition-all duration-300 ' +
              (isError ? 'text-red-400' : 'text-green-400');
            currentMsg.classList.remove('hidden');
        }
        
        function localSetLoading(on) {
            submitBtn.disabled = on;
            submitBtn.innerHTML = on ? 'Enviando...' : (currentForm.id === 'betaForm2' ? 'Garantir minha vaga' : 'Entrar no Beta');
        }
    
        // Validação client-side (UX)
        if (!email || !email.includes('@') || email.length < 5) {
          localSetMsg('Por favor, insira um e-mail válido.', true);
          currentEmailEl.focus();
          return;
        }
    
        localSetLoading(true);
    
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
            modal.classList.remove('hidden');
            modal.focus();
            currentForm.reset();
          } else {
            const data = await response.json().catch(() => ({}));
            localSetMsg(data.error || 'Erro ao enviar. Tente novamente.', true);
          }
    
        } catch (err) {
          if (err.name === 'AbortError') {
            modal.classList.remove('hidden');
            currentForm.reset();
          } else {
            localSetMsg('Sem conexão. Verifique sua internet.', true);
          }
        } finally {
          localSetLoading(false);
        }
      });
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
