// Dados de exemplo FICTÍCIOS para experimentar o fluxo sem documentos reais.
// Três reservatórios antigos e uma obra nova, todos inventados.

function ficha(designacao, dono, concelho, local, ano, capacidade, cota, material, coord) {
  return { 'Designação da obra': designacao, 'Dono de obra': dono, 'Concelho': concelho, 'Local': local, 'Tipo de obra': 'reservatório apoiado', 'Fase do projeto': 'Projeto de Execução', 'Ano': ano, 'Capacidade': capacidade, 'Cota de soleira': cota, 'Material': material, 'Coordenador do projeto': coord };
}
function doc(seccoes) { return { seccoes: seccoes.filter(Boolean).map(([titulo, paragrafos]) => ({ titulo, paragrafos: paragrafos.filter(Boolean) })) }; }

function memoria(f, v) {
  return doc([
    ['1. Introdução', [`A presente Memória Descritiva e Justificativa refere-se ao ${f['Fase do projeto']} do ${f['Designação da obra']}, elaborado para ${f['Dono de obra']}, no concelho de ${f['Concelho']}.`, `O projeto foi desenvolvido pelo Departamento de Hidráulica, sob a coordenação de ${f['Coordenador do projeto']}.`]],
    ['2. Localização e enquadramento', [`O reservatório localiza-se em ${f['Local']}, concelho de ${f['Concelho']}, com a soleira à cota ${f['Cota de soleira']}.`, v.acesso]],
    ['3. Descrição da solução', [`Trata-se de um ${f['Tipo de obra']} com capacidade de ${f['Capacidade']}, constituído por duas células independentes, de modo a permitir a limpeza de uma célula sem interromper o abastecimento.`, `A estrutura é em ${f['Material']}, com paredes de ${v.paredes} de espessura e laje de cobertura apoiada em pilares interiores.`, v.camara]],
    ['4. Impermeabilização e durabilidade', ['As faces interiores das células são revestidas com um sistema de impermeabilização certificado para contacto com água destinada ao consumo humano.', 'O recobrimento mínimo das armaduras é de 40 mm, de acordo com a classe de exposição XC4/XD2 definida na NP EN 1992-1-1.']],
    v.extra,
    ['6. Regulamentação', ['Na elaboração do projeto foi considerada a regulamentação em vigor, nomeadamente o Decreto Regulamentar n.º 23/95 e a NP EN 1992-3.']]
  ]);
}
function calculos(f, v) {
  return doc([
    ['1. Objeto', [`A presente nota de cálculo refere-se ao dimensionamento estrutural do ${f['Designação da obra']}, com capacidade de ${f['Capacidade']}, integrado no ${f['Fase do projeto']}.`]],
    ['2. Regulamentação', ['Os cálculos seguem a NP EN 1990, a NP EN 1991, a NP EN 1992-1-1 e a NP EN 1992-3, com os respetivos Anexos Nacionais.']],
    ['3. Materiais', [`Betão: ${f['Material']}. Aço: A500 NR SD. Recobrimento nominal das armaduras: 40 mm.`]],
    ['4. Ações consideradas', [`Considerou-se o peso próprio, a impulsão hidrostática com o reservatório cheio, uma sobrecarga na cobertura de 1,0 kN/m² e a ação sísmica regulamentar para o concelho de ${f['Concelho']}.`, `O solo de fundação, caracterizado no estudo geotécnico, apresenta uma tensão admissível de ${v.solo}.`]],
    ['5. Verificações', [`As paredes, com ${v.paredes} de espessura, verificam o estado limite de fendilhação com uma abertura máxima de fendas de 0,2 mm.`, `A laje de fundo foi verificada ao punçoamento e à flexão, considerando a soleira à cota ${f['Cota de soleira']}.`]]
  ]);
}
// Devolve { projetos, obra } prontos a inserir
export function dadosExemplo(nomeGab) {
  const camara = 'Junto às células existe uma câmara de manobras onde se instalam as válvulas de seccionamento, o medidor de caudal e os equipamentos de telegestão.';
  const lista = [
    [ficha('Reservatório de Vale Fundo (exemplo)', 'Águas do Exemplo, S.A.', 'Vila Exemplo', 'Cabeço da Vinha', '2023', '2 000 m³', '142,50 m', 'betão armado C30/37', 'Eng.ª Ana Exemplo'), {
      acesso: 'O acesso faz-se pelo caminho municipal existente a norte, que será beneficiado numa extensão de 120 m.', paredes: '0,35 m', camara,
      extra: ['5. Instalações complementares', ['Prevê-se vedação perimetral com 2,0 m de altura, portão de acesso e iluminação exterior.']],
      solo: '300 kPa', prazo: '90 dias', condicionante: 'Destaca-se a necessidade de manter o reservatório existente em funcionamento durante toda a obra.' }],
    [ficha('Reservatório de Serra Alta (exemplo)', 'Município de Vila Exemplo', 'Vila Exemplo', 'Alto do Moinho', '2024', '1 500 m³', '210,00 m', 'betão armado C30/37', 'Eng. Rui Exemplo'), {
      acesso: 'O acesso é garantido por um caminho novo, a construir a partir da estrada nacional, com cerca de 250 m de extensão.', paredes: '0,35 m', camara,
      extra: ['5. Arranjos exteriores', ['Os arranjos exteriores seguem a solução adotada no Reservatório de Vale Fundo (exemplo): regularização do terreno, plantação de espécies autóctones e um caminho pedonal de acesso a partir de Alto do Moinho.']],
      solo: '250 kPa', prazo: '120 dias', condicionante: 'O terreno tem declive acentuado, o que obriga a prever muros de suporte provisórios durante a escavação.' }],
    [ficha('Reservatório de Ribeira Seca (exemplo)', 'Águas do Exemplo, S.A.', 'Porto Exemplo', 'Quinta do Pinhal', '2025', '3 000 m³', '88,20 m', 'betão armado C35/45', 'Eng.ª Ana Exemplo'), {
      acesso: 'Prevê-se o acesso pelo arruamento da zona industrial, sem necessidade de obras de beneficiação.', paredes: '0,40 m',
      camara: 'Junto às células localiza-se a câmara de manobras, onde se instalam as válvulas de seccionamento, o medidor de caudal e o equipamento de telegestão.',
      extra: ['5. Instalações complementares', ['Prevê-se vedação perimetral com 2,0 m de altura, portão de acesso e iluminação exterior, à semelhança do Reservatório de Vale Fundo (exemplo).']],
      solo: '300 kPa', prazo: '90 dias', condicionante: 'A proximidade de uma linha de água obriga a articular a solução com a entidade licenciadora dos recursos hídricos.' }]
  ];
  const projetos = lista.map(([f, v]) => ({
    nome: f['Designação da obra'], ano: f['Ano'], ficha: f,
    documentos: { memoria: memoria(f, v), calculos: calculos(f, v) }
  }));
  const obra = { ficha: ficha('Reservatório de Monte Claro (exemplo)', 'Município de Porto Exemplo', 'Porto Exemplo', 'Cerro da Fonte', '2026', '2 500 m³', '175,30 m', 'betão armado C30/37', '') };
  return { projetos, obra };
}
