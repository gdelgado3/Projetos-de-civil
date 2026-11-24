// Arquivo de projetos anteriores: de onde sai o texto dos rascunhos
import { api } from '../api.js';
import { esc, ligar, ligarForms, mostrar, confirmar, carimbo, icone } from '../util.js';
import { TIPOS, textoParaSeccoes } from '/js/motor.js';

let aba = 'memoria';
const ajustar = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 6, Math.round(innerHeight * 0.68)) + 'px'; };

export async function vistaArquivo(el, ctx, projetoId) {
  const [lista, gab] = await Promise.all([api('GET', '/api/projetos'), api('GET', '/api/gabinete')]);
  const deps = gab.departamentos; const nomeDep = id => deps.find(d => d.id === id)?.nome || '—';
  const novo = projetoId === 'novo';
  const p = novo
    ? { nome: '', ano: String(new Date().getFullYear()), departamentoId: gab.membros.find(m => m.id === gab.eu.id)?.departamentoId || deps[0]?.id, ficha: {}, textos: {} }
    : projetoId ? await api('GET', `/api/projetos/${projetoId}`) : null;

  const nSec = lista.reduce((s, x) => s + Object.values(x.seccoes).reduce((a, b) => a + b, 0), 0);
  el.innerHTML = `
  ${carimbo('Arquivo de projetos', 'O texto dos rascunhos sai daqui. Para testar com documentos reais, os RECAPE publicados pela APA (siaia.apambiente.pt) incluem memórias descritivas de projetos entregues.',
    [['Projetos', lista.length], ['Secções', nSec], ['Departamentos', deps.length], ['Gabinete', esc(gab.gabinete.nome)]])}
  <section class="cartao">
    <table><tr><th>Projeto</th><th>Departamento</th><th>Ano</th><th>Documentos</th><th></th></tr>
    ${lista.map(x => `<tr><td><b>${esc(x.nome)}</b></td><td>${esc(nomeDep(x.departamentoId))}</td><td>${esc(x.ano)}</td>
      <td>${Object.entries(TIPOS).map(([t, n]) => `<span class="etq ${x.seccoes[t] ? '' : 'vazio'}">${n}${x.seccoes[t] ? ' · ' + x.seccoes[t] + ' secções' : ''}</span>`).join('')}</td>
      <td class="linha"><a class="botao sec" href="#/app/arquivo/${x.id}">Abrir</a></td></tr>`).join('')
      || '<tr><td colspan="5">Ainda não há projetos no arquivo.</td></tr>'}
    </table>
    <p><a class="botao" href="#/app/arquivo/novo">+ Projeto anterior</a></p>
  </section>
  ${p ? `<section class="cartao">
    <h2>${novo ? 'Novo projeto' : esc(p.nome)}</h2>
    <form data-form="projeto">
      <div class="grelha3">
        <label>Nome *<input name="nome" required value="${esc(p.nome)}"></label>
        <label>Departamento *<select name="departamentoId">${deps.map(d => `<option value="${d.id}" ${d.id === p.departamentoId ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></label>
        <label>Ano<input name="ano" value="${esc(p.ano)}"></label>
      </div>
      <details class="ficha-det" ${novo ? 'open' : ''}><summary>Ficha deste projeto</summary>
        <p class="nota">Escreve os valores exatamente como aparecem no texto. É assim que a app os troca pelos da obra nova e deteta dados antigos esquecidos.</p>
        <div class="grelha4">${gab.gabinete.campos.map(c => `<label>${esc(c)}<input name="ficha:${esc(c)}" value="${esc(p.ficha[c] || '')}"></label>`).join('')}</div>
      </details>
      <h3 style="margin-top:18px">Documentos</h3>
      <p class="nota">Cola o texto ou carrega um .docx. Um título é uma linha numerada (ex.: «2. Localização») ou começada por #. Separa parágrafos com uma linha em branco. PDF (como os da APA): copia o texto e cola aqui.</p>
      <nav class="seg" style="--i:${Object.keys(TIPOS).indexOf(aba)}">${Object.entries(TIPOS).map(([t, n]) => `<button type="button" class="${t === aba ? 'ativo' : ''}" data-acao="aba" data-t="${t}">${icone(t, 18)}<span>${n.split(' ')[0]} <small data-contagem="${t}">${textoParaSeccoes(p.textos[t] || '').length}</small></span></button>`).join('')}</nav>
      ${Object.entries(TIPOS).map(([t, n]) => `<div class="aba-doc ${t === aba ? 'ativa' : ''}" data-aba="${t}">
        <textarea name="texto:${t}" data-tipo="${t}" rows="10" placeholder="# 1. Introdução&#10;&#10;Texto do primeiro parágrafo…">${esc(p.textos[t] || '')}</textarea>
        <p class="linha"><label class="botao sec" style="margin:0">${icone('descarregar', 18)}Carregar .docx<input type="file" accept=".docx" data-docx="${t}" hidden></label><span class="nota" style="margin:0">${n}: as secções lidas aparecem no número ao lado do separador.</span></p>
      </div>`).join('')}
      <p class="erro-form"></p>
      <div class="linha"><button type="submit">Guardar projeto</button><a class="botao sec" href="#/app/arquivo">Fechar</a>
      ${novo ? '' : '<button type="button" class="perigo" data-acao="remover">Remover do arquivo</button>'}</div>
    </form>
  </section>` : ''}`;

  ligarForms(el, {
    projeto: async f => {
      const corpo = { nome: f.nome, ano: f.ano, departamentoId: f.departamentoId, ficha: {}, textos: {} };
      Object.entries(f).forEach(([k, v]) => {
        if (k.startsWith('ficha:')) corpo.ficha[k.slice(6)] = v;
        if (k.startsWith('texto:')) corpo.textos[k.slice(6)] = v;
      });
      if (novo) { const r = await api('POST', '/api/projetos', corpo); mostrar('Projeto juntado ao arquivo.'); location.hash = `#/app/arquivo/${r.id}`; }
      else { await api('PUT', `/api/projetos/${projetoId}`, corpo); mostrar('Projeto guardado.'); vistaArquivo(el, ctx, projetoId); }
    }
  });
  const mostrarAba = () => { const nav = el.querySelector('.seg'); if (!nav) return; nav.style.setProperty('--i', Object.keys(TIPOS).indexOf(aba));
    nav.querySelectorAll('button').forEach(x => x.classList.toggle('ativo', x.dataset.t === aba));
    el.querySelectorAll('.aba-doc').forEach(x => { const on = x.dataset.aba === aba; x.classList.toggle('ativa', on); if (on) ajustar(x.querySelector('textarea')); }); };
  el.querySelectorAll('.aba-doc.ativa textarea').forEach(ajustar);
  ligar(el, {
    aba: x => { aba = x.t; mostrarAba(); },
    remover: async () => { if (confirmar('proj' + projetoId, 'Remover este projeto do arquivo?')) { await api('DELETE', `/api/projetos/${projetoId}`); location.hash = '#/app/arquivo'; } },
  });
  // Contagem de secções ao escrever e leitura de .docx no servidor
  el.oninput = e => { const t = e.target.dataset.tipo; if (t) { el.querySelector(`[data-contagem="${t}"]`).textContent = textoParaSeccoes(e.target.value).length; ajustar(e.target); } };
  el.onchange = async e => {
    const t = e.target.dataset.docx; const f = e.target.files?.[0]; if (!t || !f) return;
    try {
      const r = await api('POST', '/api/docx-para-texto', f);
      const area = el.querySelector(`textarea[data-tipo="${t}"]`); area.value = r.texto; ajustar(area);
      el.querySelector(`[data-contagem="${t}"]`).textContent = r.seccoes;
      mostrar(`${f.name}: ${r.seccoes} secções lidas. Confirma os títulos e guarda.`);
    } catch (err) { mostrar(err.message, 'erro'); }
    e.target.value = '';
  };
}
