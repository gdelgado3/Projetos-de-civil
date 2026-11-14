// Chat da equipa: mensagens em tempo real e partilha de obras, documentos e projetos
import { api } from '../api.js';
import { esc, ligar, mostrar, dataHora, carimbo } from '../util.js';

let lista = null;     // elemento com as mensagens, quando o chat está aberto
let euId = null;

function linkAnexo(a) {
  if (a.tipo === 'obra') return `#/app/obras/${a.id}`;
  if (a.tipo === 'rascunho') return `#/app/obras/${a.obraId}/rever/${a.docTipo}`;
  if (a.tipo === 'projeto') return `#/app/arquivo/${a.id}`;
  return '#/app/chat';
}
const NOME_ANEXO = { obra: 'Obra', rascunho: 'Documento', projeto: 'Arquivo' };
function htmlMensagem(m) {
  const anexo = m.anexo ? `<a class="anexo" href="${linkAnexo(m.anexo)}"><span class="tipo-anexo">${NOME_ANEXO[m.anexo.tipo] || ''}</span>${esc(m.anexo.titulo)}</a>` : '';
  if (!m.autor) return `<div class="msg sistema" data-id="${m.id}">${esc(m.texto)} <span class="hora">${dataHora(m.criadoEm)}</span>${anexo}</div>`;
  return `<div class="msg ${m.autor.id === euId ? 'minha' : ''}" data-id="${m.id}">
    <div class="quem">${esc(m.autor.nome)}<span class="hora">${dataHora(m.criadoEm)}</span></div>
    ${m.texto ? `<div class="corpo">${esc(m.texto)}</div>` : ''}${anexo}</div>`;
}
// Chamado pela moldura quando chega uma mensagem pelo stream
export function receberMensagem(m) {
  if (!lista || !document.body.contains(lista) || lista.querySelector(`[data-id="${m.id}"]`)) return;
  const perto = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
  lista.insertAdjacentHTML('beforeend', htmlMensagem(m));
  if (perto || m.autor?.id === euId) lista.scrollTop = lista.scrollHeight;
}

export async function vistaChat(el, ctx) {
  euId = ctx.eu.utilizador.id;
  const [mensagens, partilhaveis] = await Promise.all([api('GET', '/api/chat'), api('GET', '/api/partilhaveis')]);
  el.innerHTML = `${carimbo('Chat da equipa', 'Só a equipa do gabinete vê estas mensagens. As gerações, as revisões terminadas e as entradas na equipa aparecem aqui sozinhas.',
    [['Gabinete', esc(ctx.eu.gabineteAtivo.nome)], ['Partilháveis', partilhaveis.length]])}
  <section class="cartao chat">
    <div class="mensagens" id="mensagens">${mensagens.map(htmlMensagem).join('') || '<p class="nota">Ainda não há mensagens.</p>'}</div>
    <div class="compor">
      <textarea id="texto" rows="2" placeholder="Escreve à equipa… (Enter envia, Shift+Enter muda de linha)"></textarea>
      <button data-acao="enviar">Enviar</button>
      <div class="opcoes"><span class="nota" style="margin:0">Partilhar:</span>
        <select id="anexo"><option value="">Nada</option>${partilhaveis.map((p, i) => `<option value="${i}">${esc(p.titulo)}</option>`).join('')}</select>
      </div>
    </div>
  </section>`;
  lista = el.querySelector('#mensagens'); lista.scrollTop = lista.scrollHeight;
  const texto = el.querySelector('#texto'); const anexo = el.querySelector('#anexo');
  const enviar = async () => {
    const corpo = { texto: texto.value, anexo: anexo.value === '' ? null : partilhaveis[+anexo.value] };
    if (!corpo.texto.trim() && !corpo.anexo) return;
    const m = await api('POST', '/api/chat', corpo);
    texto.value = ''; anexo.value = '';
    receberMensagem(m);
  };
  ligar(el, { enviar });
  texto.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar().catch(err => mostrar(err.message)); } };
  texto.focus();
}
