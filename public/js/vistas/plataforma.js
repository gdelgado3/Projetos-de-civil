// Administração da plataforma: todas as contas e gabinetes, e limpeza depois da demo
import { api } from '../api.js';
import { esc, ligar, ligarForms, mostrar, confirmar, carimbo } from '../util.js';

const data = iso => new Date(iso).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export async function vistaPlataforma(el, ctx) {
  const d = await api('GET', '/api/plataforma');
  el.innerHTML = `
  ${carimbo('Administração', 'Só a administração da plataforma vê esta página. Aqui apagas contas e gabinetes, por exemplo depois de uma demo.',
    [['Contas', d.utilizadores.length], ['Gabinetes', d.gabinetes.length]])}
  <section class="cartao">
    <h2>Contas</h2>
    <table><tr><th>Nome</th><th>Email</th><th>Gabinetes</th><th>Criada</th><th></th></tr>
    ${d.utilizadores.map(u => `<tr><td><b>${esc(u.nome)}</b>${u.plataformaAdmin ? ' <span class="etq">administração</span>' : ''}</td>
      <td>${esc(u.email)}</td><td>${esc(u.gabinetes || '—')}</td><td>${data(u.criadoEm)}</td>
      <td>${u.eu ? '' : `<button class="perigo" data-acao="apagarConta" data-id="${u.id}" data-nome="${esc(u.nome)}">Apagar</button>`}</td></tr>`).join('')}
    </table>
    <p class="nota">Ao apagar uma conta, os gabinetes onde essa pessoa estava sozinha também são apagados.</p>
  </section>
  <section class="cartao">
    <h2>Gabinetes</h2>
    <table><tr><th>Gabinete</th><th>Pessoas</th><th>Projetos</th><th>Obras</th><th>Criado</th><th></th></tr>
    ${d.gabinetes.map(g => `<tr><td><b>${esc(g.nome)}</b></td><td>${g.membros}</td><td>${g.projetos}</td><td>${g.obras}</td><td>${data(g.criadoEm)}</td>
      <td><button class="perigo" data-acao="apagarGabinete" data-id="${g.id}" data-nome="${esc(g.nome)}">Apagar</button></td></tr>`).join('')}
    </table>
  </section>
  <section class="cartao" style="border-color:var(--vermelho)">
    <h2>Limpar a demo</h2>
    <p class="nota">Apaga todas as contas e gabinetes, menos as contas da administração e os gabinetes onde elas estão. Não se pode desfazer.</p>
    <form data-form="limpar" class="linha">
      <input name="confirmacao" placeholder="Escreve APAGAR" autocomplete="off" style="max-width:220px;margin:0">
      <button type="submit" class="perigo">Apagar tudo o resto</button>
      <span class="erro-form"></span>
    </form>
  </section>`;

  const recarregar = () => vistaPlataforma(el, ctx);
  ligar(el, {
    apagarConta: async x => {
      if (!confirmar('u' + x.id, `Apagar a conta de ${x.nome}?`)) return;
      await api('DELETE', `/api/plataforma/utilizadores/${x.id}`); mostrar('Conta apagada.'); recarregar();
    },
    apagarGabinete: async x => {
      if (!confirmar('g' + x.id, `Apagar o gabinete ${x.nome} e tudo o que tem?`)) return;
      await api('DELETE', `/api/plataforma/gabinetes/${x.id}`); mostrar('Gabinete apagado.');
      if (x.id === ctx.eu.gabineteAtivo.id) { location.hash = '#/'; ctx.recarregar(); } else recarregar();
    }
  });
  ligarForms(el, {
    limpar: async f => {
      const r = await api('POST', '/api/plataforma/limpar', f);
      mostrar(`Apagadas ${r.utilizadores} contas e ${r.gabinetes} gabinetes.`); recarregar();
    }
  });
}
