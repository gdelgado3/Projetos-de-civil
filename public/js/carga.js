// Ecrã de carregamento: uma grua a erguer um edifício, em time-lapse.
// Fica visível desde a primeira pintura e só sai quando a app está pronta (e a obra acabada).
const el = () => document.getElementById('carga');
let desde = Date.now();
const visivel = () => { const e = el(); return !!e && !e.classList.contains('fim') && e.style.display !== 'none'; };

export function mostrarCarga() {
  const e = el(); if (!e || visivel()) return;
  e.style.display = ''; void e.offsetWidth; e.classList.remove('fim'); desde = Date.now();
}
// Espera pelo mínimo (para a obra chegar ao topo) e desvanece; devolve uma promessa para encadear o que vem a seguir
export function esconderCarga(minMs = 3200) {
  return new Promise(resolve => {
    const e = el(); if (!e || !visivel()) return resolve();
    setTimeout(() => { e.classList.add('fim'); setTimeout(() => { e.style.display = 'none'; resolve(); }, 560); }, Math.max(0, minMs - (Date.now() - desde)));
  });
}
