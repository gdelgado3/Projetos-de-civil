// Obras: lista, ficha única da obra e geração dos três documentos
import { api, descarregar } from '../api.js';
import { esc, ligar, ligarForms, mostrar, confirmar, carimbo, icone, anel, regua, animar } from '../util.js';
import { TIPOS, nomeObra } from '/js/motor.js';

const ICONE_TIPO = { memoria: 'memoria', calculos: 'calculos', proposta: 'proposta' };
const DESC_TIPO = {
  memoria: 'Texto descritivo da solução, montado a partir das memórias das tuas obras anteriores.',
  calculos: 'Bases e descrição dos cálculos, com os valores que mudam entre obras marcados para confirmar.',
  proposta: 'Proposta técnica para concurso, com a estrutura e o texto que o gabinete já usa.'
};
let filtro = 'todas', pesquisa = '';
const passoPorObra = {};

function estadoDoc(d) {
  if (!d) return 'vazio';
  return d.aceites === d.total ? 'aceite' : 'pendente';
}

export async function vistaObras(el, ctx) {
  const [lista, gab] = await Promise.all([api('GET', '/api/obras'), api('GET', '/api/gabinete')]);
  const nomeDep = id => gab.departamentos.find(d => d.id === id)?.nome || '—';
  const nDocs = lista.reduce((s, o) => s + Object.keys(o.documentos).length, 0);
  const nRevistos = lista.reduce((s, o) => s + Object.values(o.documentos).filter(d => d.aceites === d.total).length, 0);
  const passa = o => {
    const est = Object.keys(TIPOS).map(t => estadoDoc(o.documentos[t]));
    if (filtro === 'pendentes' && !est.includes('pendente')) return false;
    if (filtro === 'revistas' && !(est.every(e => e === 'aceite'))) return false;
    if (filtro === 'novas' && !est.every(e => e === 'vazio')) return false;
    return !pesquisa || (o.nome + ' ' + nomeDep(o.departamentoId)).toLowerCase().includes(pesquisa.toLowerCase());
  };
  const cartaoObra = o => {
    const minis = Object.entries(TIPOS).map(([t, n]) => { const d = o.documentos[t], e = estadoDoc(d);
      return `<div class="mini ${e}">${icone(ICONE_TIPO[t], 20)}<span>${n.split(' ')[0]}</span><small>${d ? `${d.aceites}/${d.total} revistas` : 'por gerar'}</small></div>`; }).join('');
    const tot = Object.values(o.documentos).reduce((s, d) => s + d.total, 0), ac = Object.values(o.documentos).reduce((s, d) => s + d.aceites, 0);
    return `<a class="obra-card" href="#/app/obras/${o.id}">
      <div class="topo"><span class="etq">${esc(nomeDep(o.departamentoId))}</span>${anel(tot ? ac / tot * 100 : 0, 'revisto')}</div>
      <h3>${esc(o.nome)}</h3>
      <div class="mini-docs">${minis}</div>
      <div class="abrir"><span>Abrir obra</span>${icone('seguir', 18)}</div></a>`;
  };
  const filtros = [['todas', 'Todas'], ['pendentes', 'Por rever'], ['revistas', 'Revistas'], ['novas', 'Sem documentos']];
  const visiveis = lista.filter(passa);
  el.innerHTML = `${carimbo('Obras', 'Cada obra tem uma ficha preenchida uma só vez. A memória, os cálculos e a proposta usam todos os mesmos dados.',
    [['Gabinete', esc(gab.gabinete.nome)], ['Data', new Date().toLocaleDateString('pt-PT')]])}
  <div class="numeros">
    <div class="numero"><div class="bolha">${icone('obras', 22)}</div><div><b data-conta="${lista.length}">${lista.length}</b><span>obras no gabinete</span></div></div>
    <div class="numero"><div class="bolha">${icone('ficha', 22)}</div><div><b data-conta="${nDocs}">${nDocs}</b><span>documentos gerados</span></div></div>
    <div class="numero"><div class="bolha">${icone('check', 22)}</div><div><b data-conta="${nRevistos}">${nRevistos}</b><span>totalmente revistos</span></div></div>
  </div>
  <div class="filtros">
    <label class="pesquisa" style="margin:0">${icone('pesquisar', 18)}<input id="pesq" type="search" placeholder="Procurar obra ou departamento" value="${esc(pesquisa)}"></label>
    ${filtros.map(([k, n]) => `<button class="filtro ${filtro === k ? 'ativo' : ''}" data-acao="filtro" data-k="${k}">${n}</button>`).join('')}
  </div>
  <div class="obras-grid">
    ${visiveis.map(cartaoObra).join('')}
    <div class="obra-nova" id="obra-nova">
      <h3 style="margin:0">Nova obra</h3>
      <button class="abrir-nova" data-acao="abrirNova">${icone('plus', 18)}Criar obra</button>
      <form data-form="nova">
        <input name="nome" required placeholder="Designação da obra">
        <select name="departamentoId">${gab.departamentos.map(d => `<option value="${d.id}">${esc(d.nome)}</option>`).join('')}</select>
        <button type="submit">Criar obra</button><span class="erro-form"></span>
      </form>
    </div>
  </div>
  ${!visiveis.length && lista.length ? `<div class="vazio-estado">${icone('pesquisar', 36)}<p>Nenhuma obra corresponde a este filtro.</p></div>` : ''}`;
  el.querySelector('#pesq').oninput = e => {
    pesquisa = e.target.value; const pos = e.target.selectionStart;
    vistaObras(el, ctx).then(() => { const i = el.querySelector('#pesq'); i.focus(); i.setSelectionRange(pos, pos); });
  };
  ligar(el, {
    filtro: x => { filtro = x.k; vistaObras(el, ctx); },
    abrirNova: () => { const c = el.querySelector('#obra-nova'); c.classList.add('aberta'); c.querySelector('input').focus(); }
  });
  ligarForms(el, { nova: async f => { const r = await api('POST', '/api/obras', f); location.hash = `#/app/obras/${r.id}`; } });
  animar(el);
}

export async function vistaObra(el, ctx, id) {
  const [d, gab] = await Promise.all([api('GET', `/api/obras/${id}`), api('GET', '/api/gabinete')]);
  desenhar(el, ctx, d, gab);
}

function desenhar(el, ctx, d, gab, gerado) {
  const o = d.obra;
  const passo = passoPorObra[o.id] ?? (Object.values(d.documentos).some(x => x.rascunho) ? 1 : 0);
  const docs = Object.entries(TIPOS).map(([t, n]) => d.documentos[t]);
  const nGer = docs.filter(x => x.rascunho).length;
  const tot = docs.reduce((s, x) => s + (x.rascunho ? x.rascunho.seccoes.length : 0), 0);
  const ace = docs.reduce((s, x) => s + (x.rascunho ? x.rascunho.seccoes.filter(q => q.estado === 'aceite').length : 0), 0);
  const etapas = [['Dar contexto', 'A ficha da obra', 'ficha', 100 * (gab.gabinete.campos.filter(c => o.ficha[c]).length / Math.max(1, gab.gabinete.campos.length))],
    ['Gerar o rascunho', `${nGer} de 3 documentos`, 'gerar', nGer / 3 * 100], ['Rever e exportar', `${ace} de ${tot} secções`, 'ver', tot ? ace / tot * 100 : 0]];
  const cartoes = Object.entries(TIPOS).map(([t, n]) => {
    const doc = d.documentos[t]; const r = doc.rascunho;
    const total = r ? r.seccoes.length : 0, aceites = r ? r.seccoes.filter(s => s.estado === 'aceite').length : 0;
    const pontos = r ? doc.alertas.conf + doc.alertas.nums + doc.alertas.antigos.length : 0;
    const cls = !r ? '' : aceites === total ? 'revisto' : 'gerado';
    return `<article class="doc ${cls} ${gerado === t ? 'novo' : ''}">
      <div class="doc-topo"><div class="doc-ico">${icone(ICONE_TIPO[t], 28)}</div>${r ? anel(total ? aceites / total * 100 : 0, 'revisto') : ''}</div>
      <div><h3>${n}</h3>${doc.desatualizado ? '<span class="etq pendente">A ficha mudou: gera de novo</span>' : ''}</div>
      <p class="doc-desc">${DESC_TIPO[t]}</p>
      ${r ? `<div class="doc-dados">
        <div class="l"><span>Texto reaproveitado</span><b data-conta="${doc.reaproveitado}" data-sufixo="%">${doc.reaproveitado}%</b></div>${regua(doc.reaproveitado, 'reaproveitado')}
        <div class="l"><span>Secções revistas</span><b>${aceites} de ${total}</b></div>
        <div class="l"><span>Pontos a confirmar</span><b>${pontos}</b></div></div>`
        : `<div class="doc-vazio">${doc.nProjetos ? `Pronto para gerar, com base em ${doc.nProjetos} projeto(s) do departamento.` : 'Junta ao arquivo pelo menos um projeto do departamento com este documento.'}</div>`}
      <div class="doc-acoes">
        <button data-acao="gerar" data-tipo="${t}" data-espera ${doc.nProjetos ? '' : 'disabled'}>${icone('gerar', 18)}${r ? 'Gerar de novo' : 'Gerar rascunho'}</button>
        ${r ? `<a class="botao sec" href="#/app/obras/${o.id}/rever/${t}">${icone('ver', 18)}Rever e exportar</a>` : ''}
      </div></article>`;
  }).join('');
  const revLinhas = Object.entries(TIPOS).map(([t, n]) => { const doc = d.documentos[t], r = doc.rascunho; if (!r) return '';
    const a = r.seccoes.filter(s => s.estado === 'aceite').length;
    return `<div class="rever-linha">${anel(r.seccoes.length ? a / r.seccoes.length * 100 : 0, 'revisto')}<div><h3>${n}</h3><p class="nota">${a} de ${r.seccoes.length} secções verificadas, ${doc.alertas.conf + doc.alertas.nums + doc.alertas.antigos.length} pontos a confirmar.</p></div>
      <a class="botao" href="#/app/obras/${o.id}/rever/${t}">${icone('ver', 18)}Abrir</a></div>`; }).join('');

  const nomeDep = gab.departamentos.find(x => x.id === o.departamentoId)?.nome;
  el.innerHTML = `
  <a class="voltar" href="#/app/obras">${icone('voltar', 18)}Todas as obras</a>
  ${carimbo(nomeObra(o), '', [['Dono de obra', esc(o.ficha['Dono de obra'] || '—')], ['Departamento', esc(nomeDep || '—')], ['Fase', esc(o.ficha['Fase do projeto'] || '—')], ['Ano', esc(o.ficha['Ano'] || '—')]])}
  <nav class="etapas" style="--i:${passo}" aria-label="Passos da obra">
    ${etapas.map(([nome, sub, , pct], i) => `<button class="etapa ${i === passo ? 'ativa' : ''} ${pct >= 100 && i !== passo ? 'feita' : ''}" data-acao="passo" data-i="${i}"><span class="num">${pct >= 100 && i !== passo ? icone('check', 18) : i + 1}</span><b>${nome}</b><small>${esc(sub)}</small><span class="mini-regua">${regua(pct, nome)}</span></button>`).join('')}
  </nav>
  <section class="passo-obra ${passo === 0 ? 'ativo' : ''}">
    <div class="cartao">
      <h2>Ficha da obra</h2>
      <form data-form="ficha">
        <label style="max-width:360px">Departamento<select name="departamentoId">${gab.departamentos.map(x => `<option value="${x.id}" ${x.id === o.departamentoId ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
        <p class="nota">Preenches uma vez. O que ficar vazio aparece nos documentos como [A CONFIRMAR].</p>
        <div class="grelha3">${gab.gabinete.campos.map(c => `<label>${esc(c)}<input name="ficha:${esc(c)}" value="${esc(o.ficha[c] || '')}"></label>`).join('')}</div>
        <p class="erro-form"></p>
        <div class="ficha-fim"><button type="submit" data-espera>${icone('check', 18)}Guardar ficha</button>
          <button type="button" class="perigo" data-acao="remover">Remover obra</button></div>
      </form>
    </div>
  </section>
  <section class="passo-obra ${passo === 1 ? 'ativo' : ''}">
    <div class="cab-sec"><div><h2>Escolhe o documento</h2><p class="nota" style="margin:0">Gera os três com os mesmos dados da ficha. Podes gerar de novo sempre que a ficha mudar.</p></div></div>
    <div class="docs">${cartoes}</div>
    <div class="cartao" style="margin-top:18px"><details open><summary>Como é montado o rascunho</summary><ul class="nota">
      <li>A base é o projeto anterior mais parecido com a obra nova (tipo de obra, material, dono de obra, concelho) e mais recente.</li>
      <li>Os dados da obra antiga são trocados pelos da ficha. O que falta fica [A CONFIRMAR].</li>
      <li>Um parágrafo que se repete noutras obras é reaproveitado. Um parágrafo que só existe numa obra não é copiado: fica [A CONFIRMAR] com a referência ao lado.</li>
      <li>A app não calcula nem inventa números. Um valor com unidades que muda entre obras fica marcado para confirmar.</li>
      <li>Cada parágrafo guarda o projeto e a secção de onde veio.</li>
    </ul></details></div>
  </section>
  <section class="passo-obra ${passo === 2 ? 'ativo' : ''}">
    <div class="cartao"><h2>Rever e exportar</h2><p class="nota">Nada sai como final sem o engenheiro aceitar cada secção.</p>
      ${revLinhas ? `<div class="linha" style="margin-bottom:12px"><button class="sec" data-acao="pdfTodos" data-espera>${icone('descarregar', 18)}PDF com os documentos gerados</button></div>` : ''}<div class="rever-lista">${revLinhas || '<div class="vazio-estado"><p>Ainda não há rascunhos. Gera um documento no passo anterior.</p><button data-acao="passo" data-i="1">Ir gerar</button></div>'}</div></div>
  </section>`;
  animar(el);

  ligarForms(el, {
    ficha: async f => {
      const ficha = {}; Object.entries(f).forEach(([k, v]) => { if (k.startsWith('ficha:')) ficha[k.slice(6)] = v; });
      const novo = await api('PUT', `/api/obras/${o.id}`, { departamentoId: f.departamentoId, ficha });
      mostrar('Ficha guardada.'); passoPorObra[o.id] = 1; desenhar(el, ctx, novo, gab);
    }
  });
  ligar(el, {
    pdfTodos: async () => { await descarregar(`/api/obras/${o.id}/pdf`); mostrar('PDF descarregado.'); },
    passo: x => { passoPorObra[o.id] = +x.i; desenhar(el, ctx, d, gab); },
    gerar: async x => {
      const novo = await api('POST', `/api/obras/${o.id}/gerar/${x.tipo}`);
      mostrar(`${TIPOS[x.tipo]} gerada: ${novo.documentos[x.tipo].reaproveitado}% do texto reaproveitado.`);
      passoPorObra[o.id] = 1; desenhar(el, ctx, novo, gab, x.tipo);
    },
    remover: async () => { if (confirmar('obra' + o.id, 'Remover esta obra e os seus rascunhos?')) { await api('DELETE', `/api/obras/${o.id}`); location.hash = '#/app/obras'; } }
  });
}
