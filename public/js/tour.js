// Visita guiada da demonstração: leva a pessoa pelo caminho completo (ficha, gerar, rever, exportar)
// com um foco que acompanha o elemento certo e só deixa clicar onde interessa.
import { esc, icone } from './util.js';

const q = s => document.querySelector(s);
const dormir = ms => new Promise(r => setTimeout(r, ms));
const OBRAS = '#/app/obras';
const irPara = h => { if (location.hash !== h) location.hash = h; };
async function esperar(sel, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { const e = q(sel); if (e && e.getBoundingClientRect().width) return e; await dormir(100); }
  return null;
}
async function clicar(sel) { const e = await esperar(sel, 4000); if (e && !e.disabled) e.click(); return !!e; }
const passoObra = n => async () => { if (!q(`.etapa:nth-child(${n}).ativa`)) await clicar(`.etapa:nth-child(${n})`); };
const gerado = n => `.doc:nth-child(${n}).gerado, .doc:nth-child(${n}).revisto`;
const ACEITAR = '.seccao:not(.aceite):not(.rejeitada):not(:has(.m-conf, .m-antigo)) [data-acao=aceitar]:not([disabled])';

const PASSOS = [
  { alvo: null, titulo: 'Visita guiada de dois minutos', botao: 'Começar', entrar: async () => irPara(OBRAS),
    texto: 'Vais fazer o caminho completo: dar contexto a uma obra, gerar os três documentos, rever e exportar. Eu mostro onde clicar.' },
  { alvo: '.obra-card', clicar: '.obra-card', botao: 'Abrir a obra', entrar: async () => irPara(OBRAS),
    titulo: 'Escolhe uma obra', texto: 'Cada obra tem a sua ficha e os seus documentos. Esta é um exemplo já preparado. Clica para a abrir.' },
  { alvo: '.etapas', titulo: 'Três passos, sempre pela mesma ordem',
    texto: 'Dar contexto, gerar o rascunho e rever e exportar. A régua de cada passo mostra o quanto já está feito.' },
  { alvo: '.passo-obra.ativo', entrar: passoObra(1), titulo: 'Dar contexto: a ficha da obra',
    texto: 'Preenches uma vez os dados da obra, como dono de obra, localização e fase. Os três documentos usam estes mesmos dados, e o que ficar vazio aparece como [A CONFIRMAR].' },
  { alvo: '.docs', entrar: passoObra(2), titulo: 'Gerar o rascunho',
    texto: 'Memória descritiva, cálculos descritivos e proposta para concurso. Cada um é montado a partir das obras anteriores do gabinete.' },
  { alvo: '.doc:nth-child(1) [data-acao=gerar]', clicar: '.doc:nth-child(1) [data-acao=gerar]', botao: 'Gerar a memória', skip: () => q(gerado(1)),
    titulo: 'Gera a memória descritiva', texto: 'Clica em «Gerar rascunho». Demora um segundo: a app escolhe a obra anterior mais parecida e troca os dados pelos da ficha.' },
  { alvo: '.docs', botao: 'Gerar os outros dois', titulo: 'Agora os outros dois',
    texto: 'Gera também os cálculos e a proposta. Partem da mesma ficha, por isso ficam coerentes entre si.',
    fazer: async () => { for (const n of [2, 3]) if (!q(gerado(n))) { await clicar(`.doc:nth-child(${n}) [data-acao=gerar]`); await esperar(`.doc:nth-child(${n}) .doc-dados`, 10000); } } },
  { alvo: '.doc:nth-child(1) .doc-dados', titulo: 'O que foi reaproveitado',
    texto: 'A régua mostra quanto do texto veio de obras anteriores. Os pontos a confirmar são valores que mudam de obra para obra: a app nunca inventa números.' },
  { alvo: '.etapa:nth-child(3)', clicar: '.etapa:nth-child(3)', botao: 'Ir para a revisão', titulo: 'Passa à revisão',
    texto: 'Um rascunho só vale depois de o engenheiro o rever. Clica no terceiro passo.' },
  { alvo: '.rever-linha .botao', clicar: '.rever-linha .botao', botao: 'Abrir a memória', titulo: 'Abre a memória descritiva',
    texto: 'Cada documento mostra quantas secções já foram verificadas. Abre o primeiro.' },
  { alvo: '.alertas', titulo: 'O que precisa de atenção',
    texto: 'Antes de ler, vês logo quantos dados de obras antigas ficaram no texto, quantos pontos estão por confirmar e quantas secções falta rever.' },
  { alvo: '.documento .par', clicar: '.documento .par', botao: 'Mostrar a origem', titulo: 'De onde veio esta frase?',
    texto: 'Clica num parágrafo para ver de que projeto e secção veio.' },
  { alvo: '.painel', titulo: 'Origem e texto original',
    texto: 'Aqui está o projeto de origem, o texto original e as outras obras onde a frase aparece. É assim que confirmas que nada foi inventado.' },
  { alvo: '.legenda', titulo: 'Só se aceita o que está limpo',
    texto: 'Uma secção com pontos [A CONFIRMAR] ou dados de outra obra não pode ser aceite: edita-a primeiro. Vamos aceitar uma que já está limpa.' },
  { alvo: ACEITAR, clicar: ACEITAR, botao: 'Aceitar a secção', opcional: true, titulo: 'Aceita a secção',
    texto: 'Quando estiveres satisfeito com uma secção, aceita-a. Fica com o teu carimbo de verificado.' },
  { alvo: '.carimbo-v', opcional: true, titulo: 'Verificado por ti',
    texto: 'O carimbo guarda quem validou e quando. A barra de progresso no topo sobe a cada secção aceite.' },
  { alvo: '.barra-rever', titulo: 'Exportar para Word',
    texto: 'Quando as secções estiverem verificadas, exporta o Word ou o PDF. No PDF escolhes o tema do Documentos de Civil ou a marca e a cor do teu gabinete. Os botões estão nesta barra: experimenta no fim do guia.' },
  { alvo: '.seg a:nth-child(2)', clicar: '.seg a:nth-child(2)', botao: 'Ver os cálculos', titulo: 'O mesmo para os cálculos',
    texto: 'Muda de documento aqui. Clica em «Cálculos».' },
  { alvo: '.documento', titulo: 'Cálculos descritivos',
    texto: 'Mesma lógica: texto reaproveitado, valores a confirmar assinalados e origem de cada parágrafo. A proposta para concurso funciona da mesma maneira.' },
  { alvo: '[data-id=arquivo]', clicar: '[data-id=arquivo]', botao: 'Abrir o arquivo', titulo: 'De onde vem tudo isto',
    texto: 'O Arquivo guarda os projetos anteriores do gabinete. Quanto mais juntares, melhor fica o rascunho.' },
  { alvo: '#conteudo .hero', titulo: 'Arquivo de projetos',
    texto: 'Cola o texto ou carrega um .docx de cada projeto, por departamento. Fica disponível para todas as obras novas.' },
  { alvo: null, botao: 'Terminar o guia', final: true, titulo: 'Agora é contigo',
    texto: 'Experimenta exportar o Word, editar um parágrafo, rejeitar uma secção ou criar uma obra nova. O botão «Guia da demo» no menu repete esta visita.' }
];

const E = { ativo: false, i: 0, ocupado: false, uid: null, nos: null, chave: '', versao: 0 };
const guardar = v => { try { localStorage.setItem('dc-guia-' + E.uid, String(v)); } catch { /* sem armazenamento */ } };
const lerGuardado = () => { try { return localStorage.getItem('dc-guia-' + E.uid); } catch { return null; } };

function criarNos() {
  const d = document.createElement('div'); d.className = 'tour';
  d.innerHTML = `<div class="tour-vel"></div><i class="tb t"></i><i class="tb b"></i><i class="tb l"></i><i class="tb r"></i><div class="tour-foco"></div><div class="tour-cartao" role="dialog" aria-live="polite"></div>`;
  document.body.appendChild(d);
  E.nos = { raiz: d, vel: d.querySelector('.tour-vel'), foco: d.querySelector('.tour-foco'), cartao: d.querySelector('.tour-cartao'),
    t: d.querySelector('.tb.t'), b: d.querySelector('.tb.b'), l: d.querySelector('.tb.l'), r: d.querySelector('.tb.r') };
  E.nos.cartao.addEventListener('click', e => {
    const a = e.target.closest('[data-t]')?.dataset.t;
    if (a === 'saltar') terminar(false); else if (a === 'seguinte') seguinte(); else if (a === 'inicio') mostrar(0);
  });
}
const caixa = (n, x, y, w, h) => { n.style.cssText = `left:${x}px;top:${y}px;width:${Math.max(0, w)}px;height:${Math.max(0, h)}px;display:block`; };

// A cada fotograma o foco segue o elemento (sobrevive a redesenhos e ao scroll)
let ultimaChave = '';
function quadro() {
  if (!E.ativo) return;
  const p = PASSOS[E.i], n = E.nos; let r = null;
  if (p && p.alvo && !E.aCarregar) { const el = q(p.alvo); if (el) { const b = el.getBoundingClientRect(); if (b.width) r = b; } }
  const W = innerWidth, H = innerHeight;
  if (r) {
    const pad = 8, x = Math.max(0, r.left - pad), y = Math.max(0, r.top - pad), w = Math.min(W, r.right + pad) - x, h = Math.min(H, r.bottom + pad) - y;
    n.vel.style.display = 'none'; caixa(n.foco, x, y, w, h);
    caixa(n.t, 0, 0, W, y); caixa(n.b, 0, y + h, W, H - y - h); caixa(n.l, 0, y, x, h); caixa(n.r, x + w, y, W - x - w, h);
    const chave = [x, y, w, h, E.i, E.aCarregar].map(v => Math.round(v)).join(',');
    if (chave !== ultimaChave) { ultimaChave = chave; colocarCartao({ x, y, w, h }); }
  } else {
    n.foco.style.display = 'none'; n.vel.style.display = 'block';
    [n.t, n.b, n.l, n.r].forEach(b => { b.style.display = 'none'; });
    const chave = 'centro' + E.i + E.aCarregar; if (chave !== ultimaChave) { ultimaChave = chave; colocarCartao(null); }
  }
  requestAnimationFrame(quadro);
}
function colocarCartao(c) {
  const k = E.nos.cartao, W = innerWidth, H = innerHeight, cw = Math.min(390, W - 24), ch = k.offsetHeight;
  k.style.width = cw + 'px';
  let x, y;
  if (!c) { x = (W - cw) / 2; y = Math.max(16, (H - ch) / 2); }
  else if (W < 700) { x = 12; y = H - ch - 12; }
  else if (c.h > H * 0.6 || (H - (c.y + c.h) < ch + 24 && c.y < ch + 24)) { x = W - cw - 24; y = H - ch - 24; }
  else if (H - (c.y + c.h) >= ch + 24) { x = Math.min(Math.max(16, c.x), W - cw - 16); y = c.y + c.h + 16; }
  else { x = Math.min(Math.max(16, c.x), W - cw - 16); y = c.y - ch - 16; }
  k.style.left = x + 'px'; k.style.top = Math.max(12, y) + 'px';
}

function desenharCartao(p, perdido) {
  const k = E.nos.cartao, n = PASSOS.length;
  if (perdido) {
    k.innerHTML = `<div class="tour-topo"><span class="tour-sel">${icone('aviso', 16)}Guia</span><button class="tour-x" data-t="saltar">Saltar guia</button></div>
      <h3>Parece que saíste do caminho</h3><p>Já não encontro o ecrã deste passo. Podes recomeçar a visita ou continuar à vontade sem ela.</p>
      <div class="linha"><button class="sec" data-t="saltar">Continuar sem guia</button><button data-t="inicio">Recomeçar</button></div>`;
    return;
  }
  const pct = Math.round(E.i / (n - 1) * 100);
  k.innerHTML = `<div class="tour-topo"><span class="tour-sel">${icone('gerar', 16)}Passo ${E.i + 1} de ${n}</span>${p.final ? '' : '<button class="tour-x" data-t="saltar">Saltar guia</button>'}</div>
    <div class="regua on" style="--p:${pct}"><i></i></div>
    <h3>${esc(p.titulo)}</h3><p>${esc(p.texto)}</p>
    ${p.clicar ? `<p class="tour-dica">${icone('seguir', 16)}Também podes clicar tu no destaque.</p>` : ''}
    <div class="linha"><button data-t="seguinte" data-espera>${esc(p.botao || 'Seguinte')}${icone('seguir', 18)}</button></div>`;
  k.classList.remove('entra'); void k.offsetWidth; k.classList.add('entra');
  ultimaChave = '';
}

async function mostrar(idx) {
  if (idx >= PASSOS.length) return terminar(true);
  const v = ++E.versao; E.i = idx; E.ocupado = false; guardar(idx);
  const p = PASSOS[idx];
  E.aCarregar = true; E.nos.cartao.classList.add('espera'); ultimaChave = '';
  try { if (p.entrar) await p.entrar(); } catch { /* o passo seguinte trata do que faltar */ }
  const el = p.alvo ? await esperar(p.alvo, p.opcional ? 2500 : 8000) : true;
  if (v !== E.versao || !E.ativo) return;
  if (!el) { if (p.opcional) return mostrar(idx + 1); E.aCarregar = false; E.nos.cartao.classList.remove('espera'); desenharCartao(p, true); ultimaChave = ''; return; }
  if (p.skip && p.skip()) return mostrar(idx + 1);
  if (p.alvo && el !== true) {
    const b = el.getBoundingClientRect();
    if (b.top < 70 || b.bottom > innerHeight - 20) { el.scrollIntoView({ block: b.height > innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' }); await dormir(450); }
  }
  if (v !== E.versao || !E.ativo) return;
  E.aCarregar = false; E.nos.cartao.classList.remove('espera'); desenharCartao(p, false);
}

async function seguinte() {
  if (E.ocupado) return; E.ocupado = true;
  const p = PASSOS[E.i], b = E.nos.cartao.querySelector('[data-t=seguinte]'); if (b) b.classList.add('a-carregar');
  try { if (p.final) return terminar(true); if (p.fazer) await p.fazer(); else if (p.clicar) await clicar(p.clicar); } catch { /* segue para o passo seguinte */ }
  mostrar(E.i + 1);
}
function aoClicar(e) {
  if (!E.ativo || E.ocupado || e.target.closest('.tour-cartao')) return;
  const p = PASSOS[E.i];
  if (p?.clicar && e.target.closest(p.clicar)) { E.ocupado = true; setTimeout(() => mostrar(E.i + 1), 60); }
}
function aoTeclar(e) { if (E.ativo && e.key === 'Escape') terminar(false); }

function terminar(completo) {
  E.ativo = false; E.versao++; guardar('fim');
  E.nos?.raiz.remove(); E.nos = null;
  document.removeEventListener('click', aoClicar, true); document.removeEventListener('keydown', aoTeclar);
  if (completo) irPara(OBRAS);
}
function comecar(idx) {
  if (E.ativo) return;
  E.ativo = true; criarNos();
  document.addEventListener('click', aoClicar, true); document.addEventListener('keydown', aoTeclar);
  requestAnimationFrame(quadro); mostrar(idx);
}

export const eDemo = eu => /@demo\.local$/.test(eu?.utilizador?.email || '');
// Arranca sozinho na primeira entrada de uma conta de demonstração e retoma se a página for recarregada a meio
export function iniciarGuia(eu) {
  if (!eDemo(eu) || E.ativo) return;
  E.uid = eu.utilizador.id;
  const g = lerGuardado();
  if (g === 'fim') return;
  comecar(g ? Math.min(+g || 0, PASSOS.length - 1) : 0);
}
export function reiniciarGuia(eu) {
  E.uid = eu.utilizador.id; if (E.ativo) terminar(false);
  guardar(0); comecar(0);
}
