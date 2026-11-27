// Router: decide o ecrã a partir da conta e do passo do fluxo
import { api } from './api.js';
import { vistaEntrar, vistaRegistar, vistaConvite } from './vistas/conta.js';
import { vistaOnboarding, vistaPerfil } from './vistas/onboarding.js';
import { montarApp, desmontarApp } from './vistas/shell.js';
import { esconderCarga } from './carga.js';

let primeiraVez = true; // só a abertura da página conta como "ler o QR"; sair da conta não reentra na demo
async function encaminhar() {
  const raiz = document.getElementById('app');
  const partes = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  const abertura = primeiraVez && !location.hash; primeiraVez = false;
  let eu = null;
  try { eu = await api('GET', '/api/eu'); } catch { eu = { utilizador: null }; }
  // Demo aberta (QR do slide): quem chega à página inicial sem conta entra direto na demonstração.
  // A equipa entra com a sua conta em /#/entrar.
  if (!eu.utilizador && eu.demoAberta && abertura) { location.replace('/demo'); return; }

  // Convite: funciona com ou sem conta
  if (partes[0] === 'convite' && partes[1]) { desmontarApp(); esconderCarga(900); return vistaConvite(raiz, partes[1], eu, encaminhar); }

  if (!eu.utilizador) {
    desmontarApp();
    esconderCarga(900);
    return partes[0] === 'registar' ? vistaRegistar(raiz, encaminhar) : vistaEntrar(raiz, encaminhar, eu.demoAberta);
  }
  // Primeira entrada: dados do gabinete e perfil antes de tudo o resto
  if (eu.estado === 'sem_gabinete') { desmontarApp(); esconderCarga(1400); return vistaOnboarding(raiz, eu, encaminhar); }
  if (eu.estado === 'perfil_incompleto') { desmontarApp(); esconderCarga(1400); return vistaPerfil(raiz, eu, encaminhar); }

  if (partes[0] !== 'app' || !partes[1]) { location.replace('#/app/obras'); return; }
  return montarApp(raiz, eu, partes.slice(1), encaminhar);
}

window.addEventListener('hashchange', encaminhar);
window.addEventListener('recarregar', encaminhar);
encaminhar();
