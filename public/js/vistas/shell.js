// Moldura da aplicação: menu à esquerda, área de trabalho à direita, 
import { api } from '../api.js';
import { esc, ligar, mostrar, icone, carregar, animar } from '../util.js';
import { vistaGabinete } from './gabinete.js';
import { vistaArquivo } from './arquivo.js';
import { vistaObras, vistaObra } from './obras.js';
import { vistaRever } from './rever.js';
import { vistaPlataforma } from './plataforma.js';
import { iniciarGuia, reiniciarGuia, eDemo } from '../tour.js';

let rotaAtual = [];
let utilizadorId = null;
let ultimaRota = '';

// [id, nome completo, nome curto (menu de baixo, no telemóvel), ícone]
const SEPARADORES = [
  ['obras', 'Obras', 'Obras', 'obras'],
  ['arquivo', 'Arquivo de projetos', 'Arquivo', 'arquivo'],
  ['gabinete', 'Gabinete e equipa', 'Equipa', 'gabinete']
];
const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="12" fill="#F5A20A"/><rect x="11" y="11" width="18" height="3.4" rx="1.7" fill="#0B1F3F"/><rect x="11" y="18.3" width="12" height="3.4" rx="1.7" fill="#0B1F3F"/><rect x="11" y="25.6" width="18" height="3.4" rx="1.7" fill="#0B1F3F" opacity=".45"/></svg>`;

const lerCompacta = () => { try { return localStorage.getItem('dc-compacta') === '1'; } catch { return false; } };
const gravarCompacta = v => { try { localStorage.setItem('dc-compacta', v ? '1' : '0'); } catch { /* sem armazenamento: só não fica guardado */ } };

export function desmontarApp() {
  ultimaRota = '';
  delete document.getElementById('app').dataset.shell;
}


// O indicador do menu desliza até ao separador ativo
function posicionarIndicador(animado = true) {
  const nav = document.getElementById('nav'), ind = document.getElementById('nav-ind');
  if (!nav || !ind) return;
  const ativo = nav.querySelector('.nav-item.ativo');
  if (!ativo) { ind.classList.remove('pronto'); return; }
  if (!animado) ind.style.transition = 'none';
  ind.style.setProperty('--y', ativo.offsetTop + 'px');
  ind.style.height = ativo.offsetHeight + 'px';
  ind.classList.add('pronto');
  if (!animado) { void ind.offsetHeight; ind.style.transition = ''; }
}

const iniciais = nome => String(nome || '?').trim().split(/\s+/).filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase();

export async function montarApp(raiz, eu, rota, recarregar) {
  rotaAtual = rota;
  // A moldura só é desenhada uma vez (ou quando muda o utilizador ou o gabinete)
  const chave = `${eu.utilizador.id}:${eu.gabineteAtivo.id}`;
  if (raiz.dataset.shell !== chave) {
    raiz.dataset.shell = chave; utilizadorId = eu.utilizador.id;
    const g = eu.gabineteAtivo;
    const separadores = eu.plataformaAdmin ? [...SEPARADORES, ['plataforma', 'Administração', 'Admin', 'plataforma']] : SEPARADORES;
    raiz.innerHTML = `<div class="app ${lerCompacta() ? 'compacta' : ''}">
      <aside class="lateral">
        <div class="topo-lat">${LOGO}
          <div class="marca">Documentos<br>de Civil<small>Menos tempo a documentar, mais tempo a projetar</small></div>
          <button class="recolher" data-acao="recolher" title="Recolher ou abrir o menu" aria-label="Recolher ou abrir o menu">${icone('menu', 18)}</button>
        </div>
        <div class="gab">${eu.gabinetes.length > 1
          ? `<label style="color:inherit;margin:0">Gabinete<select data-mudar="gabinete">${eu.gabinetes.map(x => `<option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>`
          : `Gabinete<b>${esc(g.nome)}</b>`}</div>
        <nav class="nav" id="nav" aria-label="Menu principal"><span class="nav-ind" id="nav-ind"></span>
          ${separadores.map(([id, nome, curto, ico]) => `<a class="nav-item" data-id="${id}" href="#/app/${id}" title="${nome}">${icone(ico, 21)}<span class="rotulo">${nome}</span><span class="curto">${curto}</span></a>`).join('')}
        </nav>
        ${eDemo(eu) ? `<button class="guia-btn" data-acao="guia" title="Repetir a visita guiada">${icone('gerar', 20)}<span class="rotulo">Guia da demo</span></button>` : ''}
        <div class="eu"><div class="avatar" aria-hidden="true">${esc(iniciais(eu.utilizador.nome))}</div>
          <div class="eu-txt"><b>${esc(eu.utilizador.nome)}</b>${esc(g.funcao || '')}${g.papel === 'admin' ? ', administrador' : ''}</div>
          <button class="claro" data-acao="sair" title="Sair" aria-label="Sair da conta">${icone('sair', 18)}</button></div>
      </aside>
      <main class="principal"><div id="conteudo"></div><p class="rodape">Os rascunhos são um ponto de partida: o engenheiro responsável revê, valida e assina.</p></main>
    </div>`;
    const lateral = raiz.querySelector('.lateral');
    ligar(lateral, {
      guia: () => reiniciarGuia(eu),
      sair: async () => { await api('POST', '/api/sair'); desmontarApp(); location.hash = '#/'; recarregar(); },
      recolher: () => {
        const app = raiz.querySelector('.app'); const v = app.classList.toggle('compacta'); gravarCompacta(v);
        posicionarIndicador(false); setTimeout(() => posicionarIndicador(false), 380);
      }
    });
    lateral.onchange = async e => {
      if (e.target.dataset.mudar !== 'gabinete') return;
      await api('POST', '/api/gabinete-ativo', { gabineteId: e.target.value });
      location.hash = '#/app/obras'; recarregar();
    };
    window.onresize = () => posicionarIndicador(false);
  }
  const primeiraVez = !document.getElementById('nav-ind').classList.contains('pronto');
  document.querySelectorAll('#nav .nav-item').forEach(a => a.classList.toggle('ativo', a.dataset.id === rota[0]));
  posicionarIndicador(!primeiraVez);

  const el = document.getElementById('conteudo');
  const ctx = { eu, recarregar };
  const chaveRota = rota.join('/'); const mudou = chaveRota !== ultimaRota; ultimaRota = chaveRota;
  carregar(true);
  try {
    if (rota[0] === 'gabinete') await vistaGabinete(el, ctx);
    else if (rota[0] === 'arquivo') await vistaArquivo(el, ctx, rota[1]);
    else if (rota[0] === 'obras' && rota[1] && rota[2] === 'rever') await vistaRever(el, ctx, rota[1], rota[3] || 'memoria');
    else if (rota[0] === 'obras' && rota[1]) await vistaObra(el, ctx, rota[1]);
    else if (rota[0] === 'plataforma' && eu.plataformaAdmin) await vistaPlataforma(el, ctx);
    else await vistaObras(el, ctx);
  } catch (e) {
    el.innerHTML = `<section class="cartao"><p>${esc(e.message)}</p><a class="botao" href="#/app/obras">Voltar às obras</a></section>`;
    if (e.status !== 404) mostrar(e.message, 'erro');
  }
  carregar(false);
  if (mudou) { el.classList.remove('entra'); void el.offsetWidth; el.classList.add('entra'); }
  animar(el);
  window.scrollTo({ top: 0, behavior: 'instant' });
  iniciarGuia(eu);
}
