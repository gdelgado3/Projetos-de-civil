// Rever e exportar: secção a secção, com a origem de cada parágrafo ao lado
import { api, descarregar } from '../api.js';
import { esc, ligar, mostrar, copiar, carimbo, icone, regua, animar } from '../util.js';
import { TIPOS, NOMES_MARCA, segmentar, nomeObra, seccaoDe } from '/js/motor.js';

let sel = null;      // parágrafo selecionado {s, p}
let editar = null;   // índice da secção em edição
let contexto = '';   // obra:tipo, para limpar a seleção ao mudar
let acabadoDeAceitar = null; // para animar só o carimbo novo

const NOMES_TIPO = { reaproveitado: p => `repete-se em ${1 + p.aparece.length} obras`, especifico: () => 'específico', unico: () => 'fonte única', editado: () => 'editado', referencia: () => 'da referência' };
const EXPLIC = {
  reaproveitado: 'Este parágrafo repete-se noutras obras do gabinete. Os dados da obra antiga foram trocados pelos da ficha.',
  especifico: 'Este parágrafo só existe na obra de origem, por isso não foi copiado. Usa a referência como ponto de partida, se fizer sentido.',
  unico: 'Esta secção só existe numa obra do arquivo. O texto foi adaptado, mas não há outras obras para confirmar que é texto-padrão.',
  editado: 'Texto editado pelo engenheiro.',
  referencia: 'Texto tirado da referência. Os dados da ficha foram trocados; confirma o resto.'
};
function marcado(texto, marcas) {
  return segmentar(texto, marcas).map(s => s.tipo ? `<span class="m-${s.tipo}" title="${NOMES_MARCA[s.tipo]}">${esc(s.t)}</span>` : esc(s.t)).join('');
}

export async function vistaRever(el, ctx, obraId, tipo) {
  if (!TIPOS[tipo]) tipo = 'memoria';
  if (contexto !== obraId + ':' + tipo) { sel = null; editar = null; contexto = obraId + ':' + tipo; }
  const d = await api('GET', `/api/obras/${obraId}`);
  desenhar(el, d, tipo);
}

function desenhar(el, d, tipo) {
  const o = d.obra; const doc = d.documentos[tipo]; const r = doc.rascunho;
  const idx = Object.keys(TIPOS).indexOf(tipo);
  const seletor = `<nav class="seg" style="--i:${idx}" aria-label="Tipo de documento">${Object.entries(TIPOS).map(([t, n]) => `<a class="${t === tipo ? 'ativo' : ''}" href="#/app/obras/${o.id}/rever/${t}">${icone(t, 18)}<span>${n.split(' ')[0]}${d.documentos[t].rascunho ? '' : ' <small>por gerar</small>'}</span></a>`).join('')}</nav>`;
  const voltar = `<a class="voltar" href="#/app/obras/${o.id}">${icone('voltar', 18)}Voltar à obra</a>`;
  if (!r) {
    el.innerHTML = `${voltar}<section class="cartao"><h2>Rever e exportar</h2>${seletor}<div class="vazio-estado">${icone(tipo, 40)}<p>Este documento ainda não foi gerado.</p>
      <button data-acao="gerar" data-espera ${doc.nProjetos ? '' : 'disabled'}>${icone('gerar', 18)}Gerar agora</button></div></section>`;
    ligar(el, { gerar: async () => { desenhar(el, await api('POST', `/api/obras/${o.id}/gerar/${tipo}`), tipo); } });
    return;
  }
  const a = doc.alertas;
  const seccoes = r.seccoes.map((s, si) => {
    const pars = s.paragrafos.map((p, pi) => editar === si
      ? `<textarea rows="3" data-edit="${pi}">${esc(p.texto)}</textarea>`
      : `<p class="par ${sel && sel.s === si && sel.p === pi ? 'sel' : ''}" data-acao="sel" data-s="${si}" data-p="${pi}">${marcado(p.texto, { ...d.marcas, numeros: s.estado === 'aceite' ? [] : p.numeros })}<span class="tag">${NOMES_TIPO[p.tipo] ? NOMES_TIPO[p.tipo](p) : ''}</span></p>`).join('');
    const estado = s.estado === 'rejeitada' ? '<span class="etq rejeitada">Rejeitada</span>' : s.estado === 'pendente' ? '<span class="etq pendente">Por rever</span>' : '';
    const quando = s.revistoEm ? new Date(s.revistoEm).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) : '';
    const selo = s.estado === 'aceite' ? `<div class="carimbo-v ${acabadoDeAceitar === si ? 'novo' : ''}">Verificado<small>${esc(s.revistoPor || '')} ${quando}</small></div>` : '';
    const nFontes = +String(s.presenca).split(' ')[0];
    return `<div class="seccao ${s.estado}">${selo}
      <div class="cab"><h3>${esc(s.titulo)}</h3>${estado}</div>
      <p class="nota">Fonte: ${esc(s.fonteNome)} · secção presente em ${esc(s.presenca)} obras</p>
      ${pars}
      <div class="linha acoes" style="margin-top:8px">${editar === si
        ? `<button data-acao="guardar" data-s="${si}">Guardar</button><button class="sec" data-acao="cancelar">Cancelar</button>`
        : `<button data-acao="aceitar" data-s="${si}" ${s.estado === 'aceite' ? 'disabled' : ''}>Aceitar</button>
           <button class="sec" data-acao="editar" data-s="${si}">Editar</button>
           ${nFontes > 1 ? `<button class="sec" data-acao="outraFonte" data-s="${si}">Outra fonte</button>` : ''}
           <button class="perigo" data-acao="rejeitar" data-s="${si}">${s.estado === 'rejeitada' ? 'Repor' : 'Rejeitar'}</button>`}</div>
    </div>`;
  }).join('');

  const aceites = r.seccoes.filter(s => s.estado === 'aceite').length; const ativas = r.seccoes.filter(s => s.estado !== 'rejeitada').length;
  el.innerHTML = `
  ${voltar}
  ${carimbo(TIPOS[tipo], 'Nada sai como final sem o engenheiro aceitar cada secção. Clica num parágrafo para ver de onde veio.',
    [['Obra', esc(nomeObra(o))], ['Estado', aceites === ativas ? 'Revisto' : 'Rascunho'], ['Gerado', `${esc(r.geradoEm)}${r.geradoPor ? ', ' + esc(r.geradoPor) : ''}`], ['Secções verificadas', `${aceites} de ${ativas}`]])}
  ${seletor}
  <div class="barra-rever"><div class="prog"><b>${aceites} de ${ativas} secções verificadas</b><span>${a.pend} por rever</span>${regua(ativas ? aceites / ativas * 100 : 0, 'verificado')}</div>
    <div class="linha"><button data-acao="word" data-espera>${icone('descarregar', 18)}Exportar Word</button><button class="sec" data-acao="copiar">${icone('copiar', 18)}Copiar</button></div></div>
  <section class="cartao">
    ${doc.desatualizado ? `<p class="nota"><span class="etq pendente">A ficha da obra mudou depois de este rascunho ser gerado.</span> Gera de novo para manter os documentos coerentes.</p>` : ''}
    <div class="alertas">
      <div class="alerta ${a.antigos.length ? 'mau' : ''}"><b>${a.antigos.length}</b>dados de obras antigas no texto</div>
      <div class="alerta"><b>${a.conf}</b>pontos [A CONFIRMAR]</div>
      <div class="alerta"><b>${a.nums}</b>valores a confirmar</div>
      <div class="alerta"><b>${a.pend}</b>secções por rever</div>
    </div>
    ${a.antigos.length ? `<p class="nota"><b>Dados antigos encontrados:</b> ${a.antigos.map(x => `«${esc(x.valor)}» em ${esc(x.seccao)}`).join('; ')}</p>` : ''}
    <p class="legenda"><span><span class="m-dado">Dado da ficha</span></span><span><span class="m-conf">Falta confirmar</span></span><span><span class="m-num">Valor que muda entre obras</span></span><span><span class="m-antigo">Dado de outra obra</span></span></p>
  </section>
  <div class="revisao">
    <article class="documento"><div class="cab-doc"><h2 style="margin:0">${esc(nomeObra(o))}</h2><span class="nota">${TIPOS[tipo]}, ${esc(o.ficha['Fase do projeto'] || '')}</span></div>${seccoes}</article>
    <aside class="cartao painel">${painel(r)}</aside>
  </div>`;
  acabadoDeAceitar = null;
  animar(el, true);

  // Ações de revisão: o servidor aplica e devolve a obra atualizada
  const acao = async (si, nome, corpo) => { desenhar(el, await api('POST', `/api/obras/${o.id}/rascunhos/${tipo}/seccoes/${si}/${nome}`, corpo || {}), tipo); };
  ligar(el, {
    sel: x => { sel = { s: +x.s, p: +x.p }; desenhar(el, d, tipo); },
    aceitar: async x => { acabadoDeAceitar = +x.s; await acao(x.s, 'aceitar'); },
    rejeitar: x => acao(x.s, 'rejeitar'),
    outraFonte: async x => { sel = null; await acao(x.s, 'outra-fonte'); mostrar('Secção montada a partir de outra obra.'); },
    editar: x => { editar = +x.s; desenhar(el, d, tipo); },
    cancelar: () => { editar = null; desenhar(el, d, tipo); },
    guardar: async x => {
      const textos = [...el.querySelectorAll('textarea[data-edit]')].sort((p, q) => p.dataset.edit - q.dataset.edit).map(t => t.value);
      editar = null; await acao(x.s, 'editar', { textos });
    },
    usarReferencia: async () => { await acao(sel.s, 'usar-referencia', { paragrafo: sel.p }); mostrar('Texto da referência copiado. Confirma os valores marcados.'); },
    word: () => descarregar(`/api/obras/${o.id}/rascunhos/${tipo}/docx`),
    copiar: () => copiar(r.seccoes.filter(s => s.estado !== 'rejeitada').map(s => s.titulo + '\n\n' + s.paragrafos.map(p => p.texto).join('\n\n')).join('\n\n')),
  });
}

function painel(r) {
  const p = sel && r.seccoes[sel.s]?.paragrafos[sel.p];
  if (!p) return `<h3>Origem do texto</h3><p class="nota">Clica num parágrafo para ver de que projeto e secção veio, e o texto original.</p>`;
  return `<h3>Origem do texto</h3>
    <p><span class="etq">${esc(p.origem.projeto)} (${esc(p.origem.ano)})</span><span class="etq">${esc(p.origem.seccao)}</span></p>
    <p class="nota">${EXPLIC[p.tipo] || ''}</p>
    <p class="nota"><b>Texto original</b></p>
    <div class="original">${esc(p.referencia)}</div>
    ${p.aparece.length ? `<p class="nota">Também aparece em: ${p.aparece.map(esc).join(', ')}</p>` : ''}
    ${p.numeros.length ? `<p class="nota">Valores que mudam entre obras: ${p.numeros.map(n => `<span class="m-num">${esc(n)}</span>`).join(' ')}</p>` : ''}
    ${p.tipo === 'especifico' ? '<button data-acao="usarReferencia">Usar a referência como base</button>' : ''}`;
}
