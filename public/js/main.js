// Router: decide o ecrã a partir da conta e do passo do fluxo
import { api } from './api.js';
import { vistaEntrar, vistaRegistar, vistaConvite } from './vistas/conta.js';
import { vistaOnboarding, vistaPerfil } from './vistas/onboarding.js';
import { montarApp, desmontarApp } from './vistas/shell.js';

async function encaminhar() {
  const raiz = document.getElementById('app');
  const partes = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  let eu = null;
  try { eu = await api('GET', '/api/eu'); } catch { eu = { utilizador: null }; }

  // Convite: funciona com ou sem conta
  if (partes[0] === 'convite' && partes[1]) { desmontarApp(); return vistaConvite(raiz, partes[1], eu, encaminhar); }

  if (!eu.utilizador) {
    desmontarApp();
    return partes[0] === 'registar' ? vistaRegistar(raiz, encaminhar) : vistaEntrar(raiz, encaminhar);
  }
  // Primeira entrada: dados do gabinete e perfil antes de tudo o resto
  if (eu.estado === 'sem_gabinete') { desmontarApp(); return vistaOnboarding(raiz, eu, encaminhar); }
  if (eu.estado === 'perfil_incompleto') { desmontarApp(); return vistaPerfil(raiz, eu, encaminhar); }

  if (partes[0] !== 'app' || !partes[1]) { location.replace('#/app/obras'); return; }
  return montarApp(raiz, eu, partes.slice(1), encaminhar);
}

window.addEventListener('hashchange', encaminhar);
window.addEventListener('recarregar', encaminhar);
encaminhar();
