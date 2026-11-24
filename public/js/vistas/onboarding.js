// Primeira entrada: 1) dados do gabinete, 2) departamentos, 3) o teu perfil
import { api } from '../api.js';
import { esc, ligar, ligarForms } from '../util.js';
import { AREAS, PLANOS } from '/js/motor.js';

const DESCRICOES = {
  'Hidráulica': 'Abastecimento de água, reservatórios, condutas e drenagem.',
  'Geotecnia': 'Estudos geotécnicos, fundações e contenções.',
  'Estruturas': 'Estruturas de betão armado e metálicas.'
};
// Rascunho do onboarding guardado só enquanto a página está aberta
const rascunho = { passo: 1, gabinete: { nome: '', nif: '', localidade: '', descricao: '', plano: 'pequeno' }, departamentos: AREAS.map(a => ({ nome: a, area: a, descricao: DESCRICOES[a] })), exemplo: true };

// Os três passos da primeira entrada, como as colunas de uma legenda
function passos(n) {
  const nomes = [['Gabinete', 'Nome, NIF, descrição'], ['Departamentos', 'Áreas e descrições'], ['O teu perfil', 'Função e departamento']];
  return `<div class="passos" style="--n:${n}"><span class="trilho"><i></i></span>${nomes.map(([t, d], i) => `<div class="${i + 1 === n ? 'atual' : i + 1 < n ? 'feito' : ''}"><b>${t}</b>${d}</div>`).join('')}</div>`;
}

// Fundo vivo: uma malha de pontos de obra que se ligam entre si e seguem o rato
let parar = null;
function fundo(raiz) {
  if (parar) parar();
  const c = raiz.querySelector('#fundo'); if (!c) return;
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const x = c.getContext('2d'); let w, h, pts, rato = { x: -999, y: -999 }, ativo = true, raf;
  const medir = () => { const r = devicePixelRatio || 1; w = c.width = innerWidth * r; h = c.height = innerHeight * r; c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
    const n = Math.min(90, Math.round(innerWidth * innerHeight / 17000)); pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .35 * r, vy: (Math.random() - .5) * .35 * r, a: Math.random() < .14 })); };
  const desenhar = () => {
    const r = devicePixelRatio || 1, D = 150 * r; x.clearRect(0, 0, w, h);
    for (const p of pts) { if (!reduzido) { p.x += p.vx; p.y += p.vy; } if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      for (let j = i + 1; j < pts.length; j++) { const q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < D) { x.strokeStyle = `rgba(${p.a || q.a ? '245,162,10' : '140,175,235'},${(1 - d / D) * .38})`; x.lineWidth = r; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(q.x, q.y); x.stroke(); } }
      const dr = Math.hypot(p.x - rato.x * r, p.y - rato.y * r);
      if (dr < 200 * r) { x.strokeStyle = `rgba(255,190,70,${(1 - dr / (200 * r)) * .7})`; x.lineWidth = r * 1.2; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(rato.x * r, rato.y * r); x.stroke(); }
      x.fillStyle = p.a ? '#F5A20A' : 'rgba(170,200,245,.85)'; x.beginPath(); x.arc(p.x, p.y, (p.a ? 3.2 : 2) * r, 0, 7); x.fill();
    }
    if (ativo && !reduzido) raf = requestAnimationFrame(desenhar);
  };
  const mover = e => { rato = { x: e.clientX, y: e.clientY }; if (reduzido) desenhar(); };
  medir(); desenhar(); addEventListener('resize', medir); addEventListener('pointermove', mover);
  parar = () => { ativo = false; cancelAnimationFrame(raf); removeEventListener('resize', medir); removeEventListener('pointermove', mover); parar = null; };
  const ver = new MutationObserver(() => { if (!document.body.contains(c)) { ver.disconnect(); if (parar) parar(); } }); ver.observe(document.body, { childList: true, subtree: true });
}
const palco = (conteudo) => `<div class="palco"><div class="aurora"><i></i><i></i><i></i></div><canvas id="fundo" aria-hidden="true"></canvas><div class="onboarding">${conteudo}</div></div>`;
const cab = (eu) => `<div class="topo"><div class="marca"><span class="selo">D</span>Documentos de Civil</div>
  <div class="linha" style="font-size:14px">${esc(eu.utilizador.nome)} <button class="claro" data-acao="sair">Sair</button></div></div>`;

export function vistaOnboarding(raiz, eu, seguinte) {
  const g = rascunho.gabinete;
  const convites = eu.convitesPendentes.length ? `<section class="cartao"><h2>Tens convites</h2>
    <p class="nota">Se vais trabalhar num gabinete que já usa o Documentos de Civil, aceita o convite em vez de criar outro gabinete.</p>
    ${eu.convitesPendentes.map(c => `<div class="linha"><b>${esc(c.gabinete)}</b><a class="botao" href="#/convite/${esc(c.token)}">Ver convite</a></div>`).join('')}</section>` : '';
  let corpo;
  if (rascunho.passo === 1) {
    corpo = `${passos(1)}<section class="cartao"><h2>Dados do gabinete</h2>
      <p class="nota">Antes de começar, diz-nos quem é o teu gabinete. Ficas como administrador e podes convidar a equipa depois.</p>
      <form data-form="gabinete">
        <label>Nome do gabinete *<input name="nome" required value="${esc(g.nome)}"></label>
        <div class="grelha2">
          <label>NIF<input name="nif" inputmode="numeric" value="${esc(g.nif)}"></label>
          <label>Localidade<input name="localidade" value="${esc(g.localidade)}"></label>
        </div>
        <label>Descrição do gabinete *<textarea name="descricao" rows="3" required placeholder="Ex.: gabinete de projeto com 8 pessoas, focado em obras hidráulicas e estruturas.">${esc(g.descricao)}</textarea></label>
        <label>Plano<select name="plano">${Object.entries(PLANOS).map(([k, p]) => `<option value="${k}" ${k === g.plano ? 'selected' : ''}>${p.nome}: até ${p.max} utilizadores (${p.preco})</option>`).join('')}</select></label>
        <p class="nota">Os pagamentos ficam fora do MVP: o plano só limita o número de utilizadores.</p>
        <p class="erro-form"></p>
        <button type="submit">Seguinte: departamentos →</button>
      </form></section>`;
  } else {
    corpo = `${passos(2)}<section class="cartao"><h2>Departamentos</h2>
      <p class="nota">Cada obra e cada projeto do arquivo pertencem a um departamento. A geração só usa projetos do mesmo departamento. Podes mudar isto depois.</p>
      <form data-form="departamentos">
        ${rascunho.departamentos.map((d, i) => `<div class="caixa">
          <div class="grelha2">
            <label>Nome *<input name="nome_${i}" value="${esc(d.nome)}"></label>
            <label>Área<select name="area_${i}"><option value="">Outra</option>${AREAS.map(a => `<option ${a === d.area ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
          </div>
          <label>Descrição do departamento<textarea name="descricao_${i}" rows="2">${esc(d.descricao)}</textarea></label>
          <button type="button" class="perigo" data-acao="removerDep" data-i="${i}">Remover</button>
        </div>`).join('')}
        <p><button type="button" class="sec" data-acao="novoDep">+ Departamento</button></p>
        <label style="display:flex;gap:8px;align-items:center;font-weight:400"><input type="checkbox" name="exemplo" style="width:auto;margin:0" ${rascunho.exemplo ? 'checked' : ''}> Carregar 3 projetos e 1 obra de exemplo (fictícios) para experimentar já</label>
        <p class="erro-form"></p>
        <div class="linha"><button type="button" class="sec" data-acao="voltar">← Voltar</button><button type="submit">Criar gabinete e seguir para o perfil →</button></div>
      </form></section>`;
  }
  raiz.innerHTML = palco(`${cab(eu)}<div class="boas"><h1>${rascunho.passo === 1 ? 'Vamos montar o teu gabinete' : 'Organiza as áreas de trabalho'}</h1><p>${rascunho.passo === 1 ? 'Três passos e já tens o primeiro rascunho a caminho.' : 'Cada departamento tem o seu arquivo. A geração só usa projetos do mesmo departamento.'}</p></div>${convites}${corpo}`); fundo(raiz); window.scrollTo(0, 0);

  // Lê o formulário de departamentos para o rascunho (para não perder o que foi escrito)
  const lerDeps = () => {
    const f = raiz.querySelector('form[data-form=departamentos]'); if (!f) return;
    const d = new FormData(f);
    rascunho.departamentos = rascunho.departamentos.map((_, i) => ({ nome: d.get(`nome_${i}`) || '', area: d.get(`area_${i}`) || '', descricao: d.get(`descricao_${i}`) || '' }));
    rascunho.exemplo = d.get('exemplo') === 'on';
  };
  ligar(raiz, {
    sair: async () => { await api('POST', '/api/sair'); seguinte(); },
    novoDep: () => { lerDeps(); rascunho.departamentos.push({ nome: '', area: '', descricao: '' }); vistaOnboarding(raiz, eu, seguinte); },
    removerDep: d => { lerDeps(); rascunho.departamentos.splice(+d.i, 1); vistaOnboarding(raiz, eu, seguinte); },
    voltar: () => { lerDeps(); rascunho.passo = 1; vistaOnboarding(raiz, eu, seguinte); }
  });
  ligarForms(raiz, {
    gabinete: d => { Object.assign(rascunho.gabinete, d); rascunho.passo = 2; vistaOnboarding(raiz, eu, seguinte); },
    departamentos: async () => {
      lerDeps();
      const deps = rascunho.departamentos.filter(x => x.nome.trim());
      if (!deps.length) throw new Error('Indica pelo menos um departamento.');
      await api('POST', '/api/gabinetes', { ...rascunho.gabinete, departamentos: deps, exemplo: rascunho.exemplo });
      rascunho.passo = 1;
      seguinte();
    }
  });
}

// Perfil da pessoa no gabinete: obrigatório para quem cria e para quem é convidado
export function vistaPerfil(raiz, eu, seguinte) {
  const g = eu.gabineteAtivo;
  raiz.innerHTML = palco(`${cab(eu)}<div class="boas"><h1>Falta só o teu perfil</h1><p>É assim que a equipa te reconhece em ${esc(g.nome)}.</p></div>${passos(3)}
    <section class="cartao"><h2>O teu perfil em ${esc(g.nome)}</h2>
      <p class="nota">A equipa vê estes dados no gabinete. O teu nome fica registado quando aceitas secções de um documento.</p>
      <form data-form="perfil">
        <label>Nome *<input name="nome" required value="${esc(eu.utilizador.nome)}"></label>
        <div class="grelha2">
          <label>Função *<input name="funcao" required placeholder="Ex.: Projetista de hidráulica" value="${esc(g.funcao || '')}"></label>
          <label>Departamento *<select name="departamentoId" required><option value="">Escolhe…</option>${g.departamentos.map(d => `<option value="${d.id}" ${d.id === g.departamentoId ? 'selected' : ''}>${esc(d.nome)}</option>`).join('')}</select></label>
        </div>
        <label>Telefone<input name="telefone" inputmode="tel" value="${esc(g.telefone || '')}"></label>
        <p class="erro-form"></p>
        <button type="submit">Concluir e entrar →</button>
      </form>
    </section>`); fundo(raiz);
  ligar(raiz, { sair: async () => { await api('POST', '/api/sair'); seguinte(); } });
  ligarForms(raiz, { perfil: async d => { await api('PUT', '/api/perfil', d); location.hash = '#/app/obras'; seguinte(); } });
}
