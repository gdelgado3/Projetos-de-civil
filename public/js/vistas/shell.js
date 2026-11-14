// Moldura da aplicação: índice à esquerda, folha à direita, ligação em tempo real ao chat
import { api } from '../api.js';
import { esc, ligar, mostrar } from '../util.js';
import { vistaGabinete } from './gabinete.js';
import { vistaArquivo } from './arquivo.js';
import { vistaObras, vistaObra } from './obras.js';
import { vistaRever } from './rever.js';
import { vistaChat, receberMensagem } from './chat.js';
import { vistaPlataforma } from './plataforma.js';

let fonte = null;      // EventSource do chat
let naoLidas = 0;
let rotaAtual = [];
let utilizadorId = null;

const SEPARADORES = [['obras', 'Obras'], ['arquivo', 'Arquivo de projetos'], ['chat', 'Chat da equipa'], ['gabinete', 'Gabinete e equipa']];

export function desmontarApp() {
  if (fonte) { fonte.close(); fonte = null; }
  naoLidas = 0;
  delete document.getElementById('app').dataset.shell;
}

function abrirStream() {
  if (fonte) fonte.close();
  fonte = new EventSource('/api/chat/stream');
  fonte.addEventListener('mensagem', e => {
    const msg = JSON.parse(e.data);
    if (rotaAtual[0] === 'chat') receberMensagem(msg);
    else if (msg.autor?.id !== utilizadorId) { naoLidas++; atualizarBadge(); }
  });
}
function atualizarBadge() {
  const b = document.getElementById('badge-chat');
  if (b) { b.textContent = naoLidas; b.style.display = naoLidas ? 'inline-block' : 'none'; }
}

export async function montarApp(raiz, eu, rota, recarregar) {
  rotaAtual = rota;
  // A moldura só é desenhada uma vez (ou quando muda o utilizador ou o gabinete)
  const chave = `${eu.utilizador.id}:${eu.gabineteAtivo.id}`;
  if (raiz.dataset.shell !== chave) {
    raiz.dataset.shell = chave; utilizadorId = eu.utilizador.id;
    const g = eu.gabineteAtivo;
    raiz.innerHTML = `<div class="app">
      <aside class="lateral">
        <div class="marca">Documentos<br>de Civil<small>Menos tempo a documentar, mais tempo a projetar</small></div>
        <div class="gab">${eu.gabinetes.length > 1
          ? `<label style="color:inherit">Gabinete<select data-mudar="gabinete">${eu.gabinetes.map(x => `<option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>`
          : `Gabinete<b>${esc(g.nome)}</b>`}</div>
        <nav id="nav"></nav>
        <div class="eu"><b>${esc(eu.utilizador.nome)}</b>${esc(g.funcao || '')}${g.papel === 'admin' ? ', administrador' : ''}
          <div style="margin-top:10px"><button class="claro" data-acao="sair">Sair</button></div></div>
      </aside>
      <main class="principal"><div id="conteudo"></div><p class="rodape">Os rascunhos são um ponto de partida: o engenheiro responsável revê, valida e assina.</p></main>
    </div>`;
    const lateral = raiz.querySelector('.lateral');
    ligar(lateral, {
      sair: async () => { await api('POST', '/api/sair'); desmontarApp(); location.hash = '#/'; recarregar(); }
    });
    lateral.onchange = async e => {
      if (e.target.dataset.mudar !== 'gabinete') return;
      await api('POST', '/api/gabinete-ativo', { gabineteId: e.target.value });
      location.hash = '#/app/obras'; recarregar();
    };
    naoLidas = 0; abrirStream();
  }
  if (rota[0] === 'chat') naoLidas = 0;
  const separadores = eu.plataformaAdmin ? [...SEPARADORES, ['plataforma', 'Administração']] : SEPARADORES;
  document.getElementById('nav').innerHTML = separadores.map(([id, nome]) =>
    `<a href="#/app/${id}" class="${rota[0] === id ? 'ativo' : ''}">${nome}${id === 'chat' ? '<span class="badge" id="badge-chat" style="display:none"></span>' : ''}</a>`).join('');
  atualizarBadge();

  const el = document.getElementById('conteudo');
  const ctx = { eu, recarregar };
  try {
    if (rota[0] === 'gabinete') await vistaGabinete(el, ctx);
    else if (rota[0] === 'arquivo') await vistaArquivo(el, ctx, rota[1]);
    else if (rota[0] === 'obras' && rota[1] && rota[2] === 'rever') await vistaRever(el, ctx, rota[1], rota[3] || 'memoria');
    else if (rota[0] === 'obras' && rota[1]) await vistaObra(el, ctx, rota[1]);
    else if (rota[0] === 'chat') await vistaChat(el, ctx);
    else if (rota[0] === 'plataforma' && eu.plataformaAdmin) await vistaPlataforma(el, ctx);
    else await vistaObras(el, ctx);
  } catch (e) {
    el.innerHTML = `<section class="cartao"><p>${esc(e.message)}</p><a class="botao" href="#/app/obras">Voltar às obras</a></section>`;
    if (e.status !== 404) mostrar(e.message);
  }
  window.scrollTo(0, 0);
}
