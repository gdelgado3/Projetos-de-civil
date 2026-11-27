# Documentos de Civil — MVP

Gera o primeiro rascunho das **memórias descritivas** e dos **cálculos descritivos** de um gabinete de engenharia civil, a partir dos seus projetos anteriores. O engenheiro revê, valida e assina.

Projeto de inovação da JUNITEC.

## Arrancar

Precisa de **Node.js 22.13 ou mais recente** (usa a base de dados SQLite que vem com o Node).

```bash
npm install
npm start          # http://localhost:3000
npm test           # teste do fluxo completo com dois utilizadores
```

Variáveis opcionais:

| Variável | Para quê | Por omissão |
|---|---|---|
| `PORT` | Porta do servidor | `3000` |
| `DB_FICHEIRO` | Caminho da base de dados | `dados/documentos-civil.db` |
| `NODE_ENV=production` | Cookie de sessão só por HTTPS | — |
| `DEMO_CODIGO` | Liga a entrada por código: `/demo?codigo=…` cria uma conta temporária com um gabinete de exemplo só para cada visitante (para o QR do slide). Sem esta variável a rota está desligada; mudá-la invalida os QR antigos | — |
| `DEMO_ABERTA` | `1` = quem abre a página inicial sem conta entra direto na demo, sem código (para um QR fixo que aponta para a página inicial). A equipa entra em `/#/entrar`. Desligar depois da demo | — |
| `DEMO_MAX` / `DEMO_HORAS` | Máximo de contas de demo ao mesmo tempo / horas até serem apagadas automaticamente | `80` / `12` |
| `SUPERADMIN_EMAILS` | Emails da administração da plataforma (separados por vírgulas): veem o separador «Administração», onde se apagam contas e gabinetes e se limpa a demo | — |

## Fluxo

1. **Criar conta** (nome, email, palavra-passe).
2. **Primeira entrada:** a app não deixa fazer mais nada sem:
   - **Passo 1:** dados do gabinete (nome, NIF, localidade, descrição, plano);
   - **Passo 2:** departamentos, com área e descrição (podem carregar-se 3 projetos e 1 obra fictícios para experimentar);
   - **Passo 3:** o perfil da pessoa (nome, função, departamento, telefone).
3. **Convites:** o administrador cria um convite por email e envia o link. Quem o abre cria conta (ou entra) e preenche o seu perfil antes de usar a app. O plano limita os utilizadores: Pequeno até 3, Médio até 10, contando os convites pendentes.
4. **Arquivo:** projetos anteriores com ficha e documentos (colar texto ou carregar .docx).
5. **Obras:** ficha única por obra, geração dos três documentos.
6. **Rever e exportar:** aceitar, editar, rejeitar ou trocar a fonte secção a secção; ver a origem de cada parágrafo; exportar Word.
7. **Apagar:** cada pessoa pode apagar a própria conta; o administrador do gabinete pode apagar o gabinete.
8. **Chat da equipa:** mensagens em tempo real, partilha de obras, documentos e projetos do arquivo. As gerações, as revisões terminadas e as entradas na equipa aparecem automaticamente.

## Como é gerado o rascunho (sem IA)

- A base é o projeto anterior mais parecido (tipo de obra, material, dono de obra, concelho) e mais recente, do mesmo departamento.
- Os dados da obra antiga são trocados pelos da ficha. O que falta fica `[A CONFIRMAR]`.
- Um parágrafo que se repete noutras obras é reaproveitado. Um parágrafo que só existe numa obra não é copiado: fica `[A CONFIRMAR]` com a referência ao lado.
- Não calcula nem inventa números. Um valor com unidades que muda entre obras fica marcado para confirmar.
- Deteta dados de obras antigas esquecidos no texto.
- Cada parágrafo guarda o projeto e a secção de onde veio, e o Word leva um anexo com a origem do texto.
- Não deixa aceitar uma secção que ainda tenha `[A CONFIRMAR]` ou dados de obras antigas.

## Estrutura

```
src/
  server.js    API (Express) e ficheiros do frontend
  db.js        Esquema SQLite
  auth.js      Palavras-passe (scrypt) e sessões (cookie HttpOnly)
  motor.js     Motor de geração (partilhado com o browser em /js/motor.js)
  docx.js      Ler e escrever .docx sem bibliotecas
  exemplo.js   Dados de exemplo fictícios
public/
  index.html, css/estilo.css
  js/main.js            Router: conta → onboarding → perfil → app
  js/vistas/*.js        Ecrãs (conta, onboarding, moldura, gabinete, arquivo, obras, rever, chat)
test/fumo.mjs           Teste do fluxo completo
```

## Limitações conhecidas

- **Os convites não são enviados por email:** o link é copiado e enviado à mão.
- **Não há recuperação de palavra-passe.**
- **PDF:** o texto tem de ser copiado e colado (os .docx são lidos diretamente).
- **Edições ao mesmo tempo:** se duas pessoas editarem a mesma secção em simultâneo, fica a última gravação.
- **Pagamentos:** não existem; o plano só limita o número de utilizadores.
- **Um só servidor:** o SQLite e o chat em tempo real (Server-Sent Events) assumem uma única instância.

## Pôr online

O `Dockerfile` serve para qualquer alojamento. A base de dados fica em `/data`, por isso é preciso ligar aí um **volume (disco persistente)**. Sem ele, os dados apagam-se a cada redeploy.

- **Railway:** novo projeto a partir do repositório (usa `railway.json` e o `Dockerfile`), juntar um volume montado em `/data` e gerar um domínio público.
- **Render:** «New → Blueprint» com o `render.yaml`. O disco exige o plano Starter.
- Verificação de saúde: `GET /api/saude`.
