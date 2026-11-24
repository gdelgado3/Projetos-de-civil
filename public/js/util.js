// Utilitários da interface

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ===== Ícones: traço fino, herdam a cor do texto =====
const ICONES = {
  obras: '<path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/><path d="M9 11h.01M15 11h.01"/>',
  arquivo: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  gabinete: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4.5 2 4.5 4.5"/>',
  plataforma: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  memoria: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M9 9h2"/>',
  calculos: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01"/>',
  proposta: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  ficha: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 12h6M9 16h4"/>',
  descarregar: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  ver: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  gerar: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17v4M17 19h4"/>',
  partilhar: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
  voltar: '<path d="M15 6l-6 6 6 6"/>',
  seguir: '<path d="M9 6l6 6-6 6"/>',
  pesquisar: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  aviso: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>'
};
export function icone(nome, tam = 20) {
  return `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] || ''}</svg>`;
}

// ===== Progresso: anel e régua de obra (animam quando se chama animar) =====
export function anel(pct, rotulo = '') {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="anel" style="--p:${p}" role="img" aria-label="${p}% ${esc(rotulo)}"><svg viewBox="0 0 52 52"><circle class="f" cx="26" cy="26" r="22"/><circle class="v" cx="26" cy="26" r="22"/></svg><b data-conta="${p}" data-sufixo="%">${p}%</b></div>`;
}
export function regua(pct, rotulo = '') {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="regua" style="--p:${p}" role="img" aria-label="${p}% ${esc(rotulo)}"><i></i></div>`;
}
const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Dispara a animação de anéis, réguas e contadores dentro de um elemento.
// instantaneo: desenha logo o estado final (para redesenhos depois de uma ação).
export function animar(el, instantaneo = false) {
  const alvos = el.querySelectorAll('.anel, .regua');
  if (instantaneo || reduzMovimento()) { alvos.forEach(a => a.classList.add('on')); return; }
  requestAnimationFrame(() => requestAnimationFrame(() => alvos.forEach(a => a.classList.add('on'))));
  el.querySelectorAll('[data-conta]').forEach(n => {
    const fim = +n.dataset.conta, suf = n.dataset.sufixo || '', t0 = performance.now(), dur = 750;
    const passo = t => { const k = Math.min(1, (t - t0) / dur); n.textContent = Math.round(fim * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(passo); };
    n.textContent = '0' + suf; requestAnimationFrame(passo);
  });
}

// ===== Avisos: aparecem no canto, com cor e ícone conforme o tipo =====
export function mostrar(msg, tipo) {
  const caixa = document.getElementById('avisos'); if (!caixa) return;
  tipo = tipo || 'ok';
  const a = document.createElement('div'); a.className = `aviso ${tipo === 'aviso' ? 'atencao' : tipo}`;
  a.innerHTML = `${icone(tipo === 'ok' ? 'check' : 'aviso', 18)}<span>${esc(msg)}</span>`;
  caixa.appendChild(a);
  while (caixa.children.length > 3) caixa.firstChild.remove();
  setTimeout(() => { a.classList.add('sai'); setTimeout(() => a.remove(), 260); }, tipo === 'erro' ? 6000 : 4000);
}
// Barra fina no topo enquanto um ecrã carrega
export function carregar(ligado) {
  const b = document.getElementById('barra'); if (!b) return;
  if (ligado) { b.className = 'a'; return; }
  b.className = 'fim'; clearTimeout(carregar.t); carregar.t = setTimeout(() => { b.className = ''; }, 380);
}
export function dataHora(iso) {
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
// Liga os botões [data-acao] de um elemento a funções (substitui ligações anteriores).
// Enquanto a ação corre, o botão fica com um indicador de carregamento.
export function ligar(el, acoes) {
  el.onclick = async e => {
    const b = e.target.closest('[data-acao]');
    if (!b || !el.contains(b) || b.disabled) return;
    const f = acoes[b.dataset.acao]; if (!f) return;
    e.preventDefault();
    const longa = b.hasAttribute('data-espera');
    if (longa) { b.classList.add('a-carregar'); b.disabled = true; }
    try { await f(b.dataset, b, e); } catch (err) { mostrar(err.message, 'erro'); }
    finally { if (longa && b.isConnected) { b.classList.remove('a-carregar'); b.disabled = false; } }
  };
}
// Liga formulários [data-form] a funções que recebem os dados do formulário
export function ligarForms(el, forms) {
  el.onsubmit = async e => {
    const f = forms[e.target.dataset.form]; if (!f) return;
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]'); if (btn) { btn.disabled = true; btn.classList.add('a-carregar'); }
    const erro = e.target.querySelector('.erro-form'); if (erro) erro.textContent = '';
    try { await f(Object.fromEntries(new FormData(e.target)), e.target); }
    catch (err) { if (erro) erro.textContent = err.message; else mostrar(err.message, 'erro'); }
    finally { if (btn) { btn.disabled = false; btn.classList.remove('a-carregar'); } }
  };
}
// Pede um segundo clique em vez de usar diálogos do browser
export function confirmar(chave, msg) {
  const agora = Date.now();
  if (confirmar.chave === chave && agora - confirmar.t < 5000) { confirmar.chave = null; return true; }
  confirmar.chave = chave; confirmar.t = agora; mostrar(msg + ' Clica outra vez para confirmar.', 'aviso');
  return false;
}
export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); mostrar('Copiado.'); }
  catch { mostrar('Não foi possível copiar. Seleciona o texto e copia à mão.', 'erro'); }
}

// Cabeçalho de cada ecrã: título, descrição e os dados principais em destaque.
// Os valores dos campos já vêm escapados (podem ter HTML simples); números animam ao entrar.
export function carimbo(titulo, descricao, campos = []) {
  const dado = v => typeof v === 'number' ? `<span data-conta="${v}">${v}</span>` : (v || '&nbsp;');
  return `<header class="hero"><div class="hero-txt"><h1>${esc(titulo)}</h1>${descricao ? `<p>${descricao}</p>` : ''}</div>
    ${campos.length ? `<dl class="hero-campos">${campos.map(([r, v]) => `<div><dt>${esc(r)}</dt><dd>${dado(v)}</dd></div>`).join('')}</dl>` : ''}
    <span class="cota" aria-hidden="true"></span></header>`;
}
