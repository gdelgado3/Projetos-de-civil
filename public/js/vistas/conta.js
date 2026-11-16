// Ecrãs de conta: entrar, registar e aceitar convite
import { api } from '../api.js';
import { esc, ligarForms, ligar } from '../util.js';

// Ecrã dividido: à esquerda, uma folha de memória a ser revista; à direita, o formulário
const mostra = `<div class="mostra">
  <div><div class="marca">Documentos<br>de Civil</div>
    <p class="frase">O primeiro rascunho da memória descritiva, montado com o que o gabinete já escreveu.</p></div>
  <div class="amostra" aria-hidden="true">
    <h4>2. Localização e enquadramento</h4>
    <p>O reservatório localiza-se em <span class="m-dado">Cerro da Fonte</span>, concelho de <span class="m-dado">Porto Exemplo</span>, com a soleira à cota <span class="m-dado">175,30 m</span>.</p>
    <p>Prevê-se iluminação exterior, à semelhança do <span class="m-antigo">Reservatório de Vale Fundo</span>.</p>
    <p><span class="m-conf">[A CONFIRMAR: acesso à obra]</span></p>
    <div class="carimbo-v">Verificado<small>A. Silva</small></div>
  </div>
  <p style="margin:0;font-size:13px;color:#B9CEDF">O engenheiro revê, valida e assina. Nada sai sem revisão.</p>
</div>`;
const pagina = corpo => `<div class="dividido">${mostra}<div class="formulario">${corpo}</div></div>`;

const formEntrar = (email = '', bloqueado = false) => `
  <form data-form="entrar">
    <label>Email<input name="email" type="email" autocomplete="email" required value="${esc(email)}" ${bloqueado ? 'readonly' : ''}></label>
    <label>Palavra-passe<input name="senha" type="password" autocomplete="current-password" required></label>
    <p class="erro-form"></p>
    <button type="submit">Entrar</button>
  </form>`;
const formRegistar = (email = '', bloqueado = false) => `
  <form data-form="registar">
    <label>Nome<input name="nome" autocomplete="name" required></label>
    <label>Email<input name="email" type="email" autocomplete="email" required value="${esc(email)}" ${bloqueado ? 'readonly' : ''}></label>
    <label>Palavra-passe (mínimo 8 caracteres)<input name="senha" type="password" autocomplete="new-password" minlength="8" required></label>
    <p class="erro-form"></p>
    <button type="submit">Criar conta</button>
  </form>`;

export function vistaEntrar(raiz, seguinte, demoAberta = false) {
  raiz.innerHTML = pagina(`<h1>Entrar</h1><p class="nota">Entra na conta do teu gabinete.</p>${formEntrar()}
      <p class="nota">Ainda não tens conta? <a href="#/registar">Criar conta</a></p>
      ${demoAberta ? '<p class="nota"><a class="botao sec" href="/demo">Experimentar sem criar conta</a></p>' : ''}`);
  ligarForms(raiz, { entrar: async d => { await api('POST', '/api/entrar', d); seguinte(); } });
}

export function vistaRegistar(raiz, seguinte) {
  raiz.innerHTML = pagina(`<h1>Criar conta</h1>
      <p class="nota">A seguir pedimos os dados do teu gabinete e o teu perfil. Se foste convidado para um gabinete, abre o link do convite em vez de criares conta aqui.</p>
      ${formRegistar()}
      <p class="nota">Já tens conta? <a href="#/">Entrar</a></p>`);
  ligarForms(raiz, { registar: async d => { await api('POST', '/api/registar', d); location.hash = '#/'; seguinte(); } });
}

// Convite: mostra o gabinete e deixa aceitar (criando conta ou entrando, se for preciso)
export async function vistaConvite(raiz, token, eu, seguinte) {
  let c;
  try { c = await api('GET', `/api/convites/${encodeURIComponent(token)}`); }
  catch (e) {
    raiz.innerHTML = pagina(`<h1>Convite</h1><p class="nota">${esc(e.message)}</p><p><a class="botao" href="#/">Ir para o início</a></p>`);
    return;
  }
  const aceitar = async () => { await api('POST', `/api/convites/${encodeURIComponent(token)}/aceitar`); location.hash = '#/'; seguinte(); };
  let corpo;
  if (eu.utilizador && eu.utilizador.email === c.email) {
    corpo = `<p>Entraste como <b>${esc(eu.utilizador.email)}</b>.</p><button data-acao="aceitar">Aceitar convite</button>`;
  } else if (eu.utilizador) {
    corpo = `<p>Este convite é para <b>${esc(c.email)}</b>, mas entraste como ${esc(eu.utilizador.email)}.</p><button class="sec" data-acao="sair">Sair e entrar com a conta certa</button>`;
  } else {
    corpo = c.existeConta
      ? `<p class="nota">Já existe uma conta com este email. Entra para aceitar.</p>${formEntrar(c.email, true)}`
      : `<p class="nota">Cria a tua conta para te juntares à equipa.</p>${formRegistar(c.email, true)}`;
  }
  raiz.innerHTML = pagina(`<p class="nota" style="margin:0">Foste convidado para</p><h1>${esc(c.gabinete)}</h1>
      ${c.aceite ? '<p class="nota">Este convite já foi usado.</p><p><a class="botao" href="#/">Ir para o início</a></p>' : corpo}`);
  ligar(raiz, {
    aceitar,
    sair: async () => { await api('POST', '/api/sair'); seguinte(); }
  });
  ligarForms(raiz, {
    entrar: async d => { await api('POST', '/api/entrar', d); await aceitar(); },
    registar: async d => { await api('POST', '/api/registar', d); await aceitar(); }
  });
}
