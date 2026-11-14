// Utilitários da interface

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function mostrar(msg) {
  const a = document.getElementById('aviso'); a.textContent = msg; a.style.display = 'block';
  clearTimeout(mostrar.t); mostrar.t = setTimeout(() => { a.style.display = 'none'; }, 4000);
}
export function dataHora(iso) {
  return new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
// Liga os botões [data-acao] de um elemento a funções (substitui ligações anteriores)
export function ligar(el, acoes) {
  el.onclick = async e => {
    const b = e.target.closest('[data-acao]');
    if (!b || !el.contains(b) || b.disabled) return;
    const f = acoes[b.dataset.acao]; if (!f) return;
    e.preventDefault();
    try { await f(b.dataset, b, e); } catch (err) { mostrar(err.message); }
  };
}
// Liga formulários [data-form] a funções que recebem os dados do formulário
export function ligarForms(el, forms) {
  el.onsubmit = async e => {
    const f = forms[e.target.dataset.form]; if (!f) return;
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
    const erro = e.target.querySelector('.erro-form'); if (erro) erro.textContent = '';
    try { await f(Object.fromEntries(new FormData(e.target)), e.target); }
    catch (err) { if (erro) erro.textContent = err.message; else mostrar(err.message); }
    finally { if (btn) btn.disabled = false; }
  };
}
// Pede um segundo clique em vez de usar diálogos do browser
export function confirmar(chave, msg) {
  const agora = Date.now();
  if (confirmar.chave === chave && agora - confirmar.t < 5000) { confirmar.chave = null; return true; }
  confirmar.chave = chave; confirmar.t = agora; mostrar(msg + ' Clica outra vez para confirmar.');
  return false;
}
export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); mostrar('Copiado.'); }
  catch { mostrar('Não foi possível copiar. Seleciona o texto e copia à mão.'); }
}

// Carimbo: a legenda das folhas de projeto, no topo de cada ecrã.
// Os valores dos campos já vêm escapados (podem ter HTML simples).
export function carimbo(titulo, descricao, campos = []) {
  const lista = campos.length % 2 ? [...campos, ['', '']] : campos;
  return `<header class="carimbo"><div class="titulo"><h1>${esc(titulo)}</h1>${descricao ? `<p>${descricao}</p>` : ''}</div>
    ${lista.length ? `<div class="campos">${lista.map(([r, v]) => `<div class="campo"><span>${esc(r)}</span>${v || '&nbsp;'}</div>`).join('')}</div>` : ''}</header>`;
}
