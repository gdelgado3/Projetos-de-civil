// Obras: lista, ficha única da obra e geração dos três documentos
import { api } from '../api.js';
import { esc, ligar, ligarForms, mostrar, confirmar, carimbo } from '../util.js';
import { TIPOS, nomeObra } from '/js/motor.js';

export async function vistaObras(el, ctx) {
  const [lista, gab] = await Promise.all([api('GET', '/api/obras'), api('GET', '/api/gabinete')]);
  const nomeDep = id => gab.departamentos.find(d => d.id === id)?.nome || '—';
  const nDocs = lista.reduce((s, o) => s + Object.keys(o.documentos).length, 0);
  el.innerHTML = `${carimbo('Obras', 'Cada obra tem uma ficha preenchida uma só vez. A memória, os cálculos e a proposta usam todos os mesmos dados.',
    [['Gabinete', esc(gab.gabinete.nome)], ['Obras', lista.length], ['Documentos gerados', nDocs], ['Data', new Date().toLocaleDateString('pt-PT')]])}
  <section class="cartao">
    <table><tr><th>Obra</th><th>Departamento</th><th>Documentos</th></tr>
    ${lista.map(o => `<tr><td><a href="#/app/obras/${o.id}"><b>${esc(o.nome)}</b></a></td><td>${esc(nomeDep(o.departamentoId))}</td>
      <td>${Object.entries(TIPOS).map(([t, n]) => { const d = o.documentos[t];
        return `<span class="etq ${!d ? 'vazio' : d.aceites === d.total ? 'aceite' : 'pendente'}">${n}${d ? ` · ${d.aceites}/${d.total} revistas` : ''}</span>`; }).join('')}</td></tr>`).join('')
      || '<tr><td colspan="3">Ainda não há obras.</td></tr>'}
    </table>
    <form data-form="nova" class="linha" style="margin-top:12px">
      <input name="nome" required placeholder="Designação da obra nova" style="max-width:320px;margin:0">
      <select name="departamentoId" style="max-width:220px;margin:0">${gab.departamentos.map(d => `<option value="${d.id}">${esc(d.nome)}</option>`).join('')}</select>
      <button type="submit">+ Obra nova</button><span class="erro-form"></span>
    </form>
  </section>`;
  ligarForms(el, { nova: async f => { const r = await api('POST', '/api/obras', f); location.hash = `#/app/obras/${r.id}`; } });
}

export async function vistaObra(el, ctx, id) {
  const [d, gab] = await Promise.all([api('GET', `/api/obras/${id}`), api('GET', '/api/gabinete')]);
  desenhar(el, ctx, d, gab);
}

function desenhar(el, ctx, d, gab) {
  const o = d.obra;
  const cartoes = Object.entries(TIPOS).map(([t, n]) => {
    const doc = d.documentos[t]; const r = doc.rascunho;
    const estado = !r ? '<span class="etq vazio">Ainda não gerado</span>'
      : doc.desatualizado ? '<span class="etq pendente">A ficha mudou: gera de novo</span>'
      : `<span class="etq aceite">Gerado em ${esc(r.geradoEm)}${r.geradoPor ? ' por ' + esc(r.geradoPor) : ''}</span><span class="etq">${doc.reaproveitado}% reaproveitado</span><span class="etq">${r.seccoes.filter(s => s.estado === 'aceite').length}/${r.seccoes.length} revistas</span>`;
    return `<div class="caixa">
      <h3>${n}</h3>
      <p class="nota">${doc.nProjetos} projeto(s) do departamento com este documento.</p>
      <p>${estado}</p>
      <div class="linha">
        <button data-acao="gerar" data-tipo="${t}" ${doc.nProjetos ? '' : 'disabled'}>${r ? 'Gerar de novo' : 'Gerar rascunho'}</button>
        ${r ? `<a class="botao sec" href="#/app/obras/${o.id}/rever/${t}">Rever e exportar</a>` : ''}
      </div>
    </div>`;
  }).join('');
  // Destaque do documento gerado mais recentemente que exista
  const tipoDestaque = Object.keys(TIPOS).find(t => d.documentos[t].rascunho);
  const dd = tipoDestaque && d.documentos[tipoDestaque];
  const destaque = dd ? `<div class="destaque">
      <div><div class="grande">${dd.reaproveitado}%</div><div class="rot">do texto da ${TIPOS[tipoDestaque].toLowerCase()} reaproveitado de ${dd.rascunho.nProjetos} obras</div></div>
      <div><div class="grande">${dd.rascunho.seccoes.length}</div><div class="rot">secções</div></div>
      <div><div class="grande">${dd.alertas.conf + dd.alertas.nums + dd.alertas.antigos.length}</div><div class="rot">pontos para o engenheiro confirmar</div></div>
    </div>` : '';

  const nomeDep = gab.departamentos.find(x => x.id === o.departamentoId)?.nome;
  el.innerHTML = `
  <p class="nota" style="margin-top:0"><a href="#/app/obras">Todas as obras</a></p>
  ${carimbo(nomeObra(o), '', [['Dono de obra', esc(o.ficha['Dono de obra'] || '—')], ['Departamento', esc(nomeDep || '—')], ['Fase', esc(o.ficha['Fase do projeto'] || '—')], ['Ano', esc(o.ficha['Ano'] || '—')]])}
  <section class="cartao">
    <h2>Ficha da obra</h2>
    <form data-form="ficha">
      <label style="max-width:360px">Departamento<select name="departamentoId">${gab.departamentos.map(x => `<option value="${x.id}" ${x.id === o.departamentoId ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
      <p class="nota">Preenches uma vez. O que ficar vazio aparece nos documentos como [A CONFIRMAR].</p>
      <div class="grelha3">${gab.gabinete.campos.map(c => `<label>${esc(c)}<input name="ficha:${esc(c)}" value="${esc(o.ficha[c] || '')}"></label>`).join('')}</div>
      <p class="erro-form"></p>
      <div class="linha"><button type="submit">Guardar ficha</button>
        <button type="button" class="sec" data-acao="partilhar">Partilhar obra no chat</button>
        <button type="button" class="perigo" data-acao="remover">Remover obra</button></div>
    </form>
  </section>
  <section class="cartao">
    <h2>Gerar o rascunho</h2>
    <div class="grelha-tipos">${cartoes}</div>
    ${destaque}
    <details><summary>Como é montado o rascunho</summary><ul class="nota">
      <li>A base é o projeto anterior mais parecido com a obra nova (tipo de obra, material, dono de obra, concelho) e mais recente.</li>
      <li>Os dados da obra antiga são trocados pelos da ficha. O que falta fica [A CONFIRMAR].</li>
      <li>Um parágrafo que se repete noutras obras é reaproveitado. Um parágrafo que só existe numa obra não é copiado: fica [A CONFIRMAR] com a referência ao lado.</li>
      <li>A app não calcula nem inventa números. Um valor com unidades que muda entre obras fica marcado para confirmar.</li>
      <li>Cada parágrafo guarda o projeto e a secção de onde veio.</li>
    </ul></details>
  </section>`;

  ligarForms(el, {
    ficha: async f => {
      const ficha = {}; Object.entries(f).forEach(([k, v]) => { if (k.startsWith('ficha:')) ficha[k.slice(6)] = v; });
      const novo = await api('PUT', `/api/obras/${o.id}`, { departamentoId: f.departamentoId, ficha });
      mostrar('Ficha guardada.'); desenhar(el, ctx, novo, gab);
    }
  });
  ligar(el, {
    gerar: async x => {
      const novo = await api('POST', `/api/obras/${o.id}/gerar/${x.tipo}`);
      mostrar(`${TIPOS[x.tipo]} gerada: ${novo.documentos[x.tipo].reaproveitado}% do texto reaproveitado.`);
      desenhar(el, ctx, novo, gab);
    },
    partilhar: async () => { await api('POST', '/api/chat', { texto: '', anexo: { tipo: 'obra', id: o.id } }); mostrar('Partilhado no chat da equipa.'); },
    remover: async () => { if (confirmar('obra' + o.id, 'Remover esta obra e os seus rascunhos?')) { await api('DELETE', `/api/obras/${o.id}`); location.hash = '#/app/obras'; } }
  });
}
