// Gabinete e equipa: dados, departamentos, campos da ficha, membros, convites e o meu perfil
import { api } from '../api.js';
import { esc, ligar, ligarForms, mostrar, confirmar, copiar, carimbo } from '../util.js';
import { AREAS, PLANOS } from '/js/motor.js';

const linkConvite = token => `${location.origin}/#/convite/${token}`;

export async function vistaGabinete(el, ctx) {
  const d = await api('GET', '/api/gabinete');
  const g = d.gabinete; const admin = d.eu.papel === 'admin'; const dis = admin ? '' : 'disabled';
  const eu = d.membros.find(m => m.id === d.eu.id);
  const nomeDep = id => d.departamentos.find(x => x.id === id)?.nome || '—';
  const opcoesDep = sel => d.departamentos.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');

  el.innerHTML = `
  ${carimbo(g.nome, esc(g.descricao), [['NIF', esc(g.nif || '—')], ['Localidade', esc(g.localidade || '—')], ['Plano', esc(PLANOS[g.plano].nome)], ['Equipa', `${d.limite.membros} de ${d.limite.max}`]])}
  <section class="cartao">
    <h2>Dados do gabinete</h2>
    ${admin ? '' : '<p class="nota">Só um administrador pode alterar estes dados.</p>'}
    <form data-form="gabinete">
      <div class="grelha3">
        <label>Nome<input name="nome" value="${esc(g.nome)}" ${dis}></label>
        <label>NIF<input name="nif" value="${esc(g.nif)}" ${dis}></label>
        <label>Localidade<input name="localidade" value="${esc(g.localidade)}" ${dis}></label>
      </div>
      <label>Descrição<textarea name="descricao" rows="3" ${dis}>${esc(g.descricao)}</textarea></label>
      <label style="max-width:420px">Plano<select name="plano" ${dis}>${Object.entries(PLANOS).map(([k, p]) => `<option value="${k}" ${k === g.plano ? 'selected' : ''}>${p.nome}: até ${p.max} utilizadores (${p.preco})</option>`).join('')}</select></label>
      <p class="erro-form"></p>
      ${admin ? '<button type="submit">Guardar</button>' : ''}
    </form>
  </section>

  <section class="cartao">
    <h2>Departamentos</h2>
    <p class="nota">A geração só usa projetos do arquivo do mesmo departamento da obra.</p>
    ${d.departamentos.map(x => `<form class="caixa" data-form="dep" data-id="${x.id}">
      <div class="grelha2">
        <label>Nome<input name="nome" value="${esc(x.nome)}" ${dis}></label>
        <label>Área<select name="area" ${dis}><option value="">Outra</option>${AREAS.map(a => `<option ${a === x.area ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
      </div>
      <label>Descrição do departamento<textarea name="descricao" rows="2" ${dis}>${esc(x.descricao)}</textarea></label>
      <p class="erro-form"></p>
      ${admin ? `<div class="linha"><button type="submit">Guardar</button><button type="button" class="perigo" data-acao="removerDep" data-id="${x.id}">Remover</button></div>` : ''}
    </form>`).join('')}
    ${admin ? `<form class="caixa" data-form="novoDep"><h3>Novo departamento</h3>
      <div class="grelha2"><label>Nome<input name="nome" required></label>
      <label>Área<select name="area"><option value="">Outra</option>${AREAS.map(a => `<option>${a}</option>`).join('')}</select></label></div>
      <label>Descrição<textarea name="descricao" rows="2"></textarea></label><p class="erro-form"></p><button type="submit">Adicionar</button></form>` : ''}
  </section>

  <section class="cartao">
    <h2>O meu perfil</h2>
    <form data-form="perfil">
      <div class="grelha3">
        <label>Nome<input name="nome" required value="${esc(ctx.eu.utilizador.nome)}"></label>
        <label>Função<input name="funcao" required value="${esc(eu?.funcao)}"></label>
        <label>Departamento<select name="departamentoId" required>${opcoesDep(eu?.departamentoId)}</select></label>
      </div>
      <label style="max-width:300px">Telefone<input name="telefone" value="${esc(eu?.telefone)}"></label>
      <p class="erro-form"></p><button type="submit">Guardar perfil</button>
    </form>
  </section>

  <section class="cartao">
    <h2>Equipa <span class="etq">${d.limite.membros} membros · ${d.limite.pendentes} convites · máximo ${d.limite.max}</span></h2>
    <table><tr><th>Nome</th><th>Função</th><th>Departamento</th><th>Contacto</th><th>Papel</th><th></th></tr>
    ${d.membros.map(m => `<tr><td><b>${esc(m.nome)}</b>${m.perfilCompleto ? '' : ' <span class="etq pendente">perfil por completar</span>'}</td>
      <td>${esc(m.funcao || '—')}</td><td>${esc(nomeDep(m.departamentoId))}</td>
      <td>${esc(m.email)}${m.telefone ? '<br>' + esc(m.telefone) : ''}</td><td>${m.papel === 'admin' ? 'Administrador' : 'Membro'}</td>
      <td>${admin && m.id !== d.eu.id ? `<button class="perigo" data-acao="removerMembro" data-id="${m.id}">Remover</button>` : ''}</td></tr>`).join('')}
    </table>
  </section>

  ${admin ? `<section class="cartao">
    <h2>Convidar para a equipa</h2>
    <p class="nota">Cria o convite e envia o link à pessoa (por email ou mensagem). Quem entra pela primeira vez preenche o seu perfil antes de usar a app. O envio automático de email fica para uma versão seguinte.</p>
    <form data-form="convite" class="linha">
      <input name="email" type="email" required placeholder="email@gabinete.pt" style="max-width:320px;margin:0">
      <select name="papel" style="max-width:180px;margin:0"><option value="membro">Membro</option><option value="admin">Administrador</option></select>
      <button type="submit">Criar convite</button>
      <span class="erro-form"></span>
    </form>
    ${d.convites.length ? `<table style="margin-top:12px"><tr><th>Email</th><th>Papel</th><th>Link</th><th></th></tr>
      ${d.convites.map(c => `<tr><td>${esc(c.email)}</td><td>${c.papel === 'admin' ? 'Administrador' : 'Membro'}</td>
        <td><input readonly value="${esc(linkConvite(c.token))}" style="margin:0"></td>
        <td class="linha"><button class="sec" data-acao="copiar" data-token="${c.token}">Copiar link</button><button class="perigo" data-acao="cancelarConvite" data-token="${c.token}">Cancelar</button></td></tr>`).join('')}</table>`
      : '<p class="nota">Não há convites pendentes.</p>'}
  </section>` : ''}

  <section class="cartao" style="border-color:var(--vermelho)">
    <h2>Apagar</h2>
    <form data-form="apagarConta">
      <h3>A minha conta</h3>
      <p class="nota">Apaga a tua conta. Se fores a única pessoa no gabinete, o gabinete também é apagado. Se fores o único administrador, o membro mais antigo passa a administrador.</p>
      <div class="linha"><input name="senha" type="password" required placeholder="A tua palavra-passe" autocomplete="current-password" style="max-width:260px;margin:0">
      <button type="submit" class="perigo">Apagar a minha conta</button></div>
      <p class="erro-form"></p>
    </form>
    ${admin ? `<form data-form="apagarGabinete">
      <h3>O gabinete</h3>
      <p class="nota">Apaga o gabinete com o arquivo, as obras, os rascunhos e o chat, para toda a equipa. Escreve o nome do gabinete para confirmar.</p>
      <div class="linha"><input name="nome" required placeholder="${esc(g.nome)}" autocomplete="off" style="max-width:320px;margin:0">
      <button type="submit" class="perigo">Apagar o gabinete</button></div>
      <p class="erro-form"></p>
    </form>` : ''}
  </section>

  <section class="cartao">
    <h2>Campos da ficha da obra</h2>
    <p class="nota">São os dados inseridos uma só vez por obra. Servem para trocar os dados das obras antigas pelos da obra nova.</p>
    <div>${g.campos.map((c, i) => `<span class="chip">${esc(c)}${admin ? `<button title="Remover" data-acao="removerCampo" data-i="${i}">×</button>` : ''}</span>`).join('')}</div>
    ${admin ? `<form data-form="campo" class="linha" style="margin-top:8px"><input name="campo" required placeholder="Ex.: Extensão da conduta" style="max-width:320px;margin:0"><button type="submit">Adicionar campo</button></form>` : ''}
  </section>`;

  const recarregar = () => vistaGabinete(el, ctx);
  ligarForms(el, {
    gabinete: async f => { await api('PUT', '/api/gabinete', f); mostrar('Gabinete guardado.'); delete document.getElementById('app').dataset.shell; ctx.recarregar(); },
    dep: async (f, form) => { await api('PUT', `/api/departamentos/${form.dataset.id}`, f); mostrar('Departamento guardado.'); },
    novoDep: async f => { await api('POST', '/api/departamentos', f); recarregar(); },
    perfil: async f => { await api('PUT', '/api/perfil', f); mostrar('Perfil guardado.'); delete document.getElementById('app').dataset.shell; ctx.recarregar(); },
    convite: async f => { const r = await api('POST', '/api/convites', f); await copiar(linkConvite(r.token)); mostrar('Convite criado. O link foi copiado.'); recarregar(); },
    apagarConta: async f => { await api('DELETE', '/api/conta', f); mostrar('Conta apagada.'); location.hash = '#/'; ctx.recarregar(); },
    apagarGabinete: async f => { await api('DELETE', '/api/gabinete', f); mostrar('Gabinete apagado.'); location.hash = '#/'; ctx.recarregar(); },
    campo: async f => { await api('PUT', '/api/gabinete', { campos: [...g.campos, f.campo] }); recarregar(); }
  });
  ligar(el, {
    removerDep: async x => { if (confirmar('dep' + x.id, 'Remover este departamento?')) { await api('DELETE', `/api/departamentos/${x.id}`); recarregar(); } },
    removerMembro: async x => { if (confirmar('m' + x.id, 'Remover esta pessoa do gabinete?')) { await api('DELETE', `/api/membros/${x.id}`); recarregar(); } },
    copiar: x => copiar(linkConvite(x.token)),
    cancelarConvite: async x => { await api('DELETE', `/api/convites/${x.token}`); recarregar(); },
    removerCampo: async x => { await api('PUT', '/api/gabinete', { campos: g.campos.filter((_, i) => i !== +x.i) }); recarregar(); }
  });
}
