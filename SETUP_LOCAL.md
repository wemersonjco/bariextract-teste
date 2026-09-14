# BariExtract — cópia local (sem laboratoriais)

Este é um resumo do que foi ajustado nesta cópia para rodar localmente, com um projeto Supabase
próprio (separado do sistema em produção na Vercel).

## O que mudou em relação ao projeto original

1. **`ENV_LOCAL.txt`** criado na raiz do projeto com o conteúdo do `.env` já pronto:
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` já preenchidos com o novo projeto Supabase.
   - `VITE_GEMINI_KEY` como placeholder — **preencha com sua chave antes de rodar**.
   - Não consegui criar o `.env` diretamente (arquivos começando com ponto são bloqueados pela
     ferramenta que uso para gravar no seu PC). É só renomear `ENV_LOCAL.txt` para `.env` na raiz
     do projeto (pelo Windsurf/VS Code: botão direito → Rename) e apagar o `.txt` do nome.
   - `.env` já está no `.gitignore`, então depois de renomeado não vai parar em nenhum repositório.

2. **Feature "Extração Complementar (Laboratoriais)" removida**, conforme pedido:
   - Removida do `src/App.tsx`: import, estado, botão, modal e a chamada que extraía/salvava
     laboratoriais durante o processamento normal.
   - Removida do `src/App.tsx` a aba "Exames Laboratoriais" do Excel exportado.
   - Removidas as funções específicas de laboratoriais de `src/services/examesSupabaseService.ts`
     (mantido: cliente Supabase, `isSupabaseConfigured`, `converterDataParaSupabase`, que ainda
     são usados pelo restante do app).
   - Removido o tipo `ExamesLaboratoriais` de `src/types.ts`.
   - `src/components/ExtraçãoComplementar.tsx` e `src/services/examesLaboratoriaisService.ts`
     ficaram **sem uso** (não são mais importados por ninguém). Podem ser apagados quando quiser
     — não apaguei porque no momento não consigo rodar comandos diretamente no seu PC (veja nota
     abaixo), mas não atrapalham em nada ficando aí.

3. **Bug corrigido**: no código original, ao criar um paciente novo o campo salvo era
   `eda_pos_h_pylori`, mas ao carregar/editar o campo lido era `eda_pos_hpylori` (sem o
   underscore antes de "pylori") — nomes diferentes. Isso fazia esse campo específico
   provavelmente falhar silenciosamente ao salvar um paciente novo. Padronizei para
   `eda_pos_hpylori` em todo o `App.tsx`, e a tabela nova já nasce com esse nome de coluna.

4. **Novo script `supabase_setup_local.sql`**: cria só a tabela `patients` (sem a tabela de
   laboratoriais) no novo projeto Supabase. Também corrige a política de RLS do original — lá,
   a policy comparava `auth.uid()` com o próprio `id` do paciente, o que bloqueava inserts/updates
   na prática. Como este é um sistema de uso interno (login único, não multi-tenant por paciente),
   a nova policy libera CRUD completo para qualquer usuário autenticado.

## Passo a passo para colocar no ar

1. **Rodar o SQL**: abra o painel do novo projeto Supabase → SQL Editor → New query → cole o
   conteúdo de `supabase_setup_local.sql` → Run. Confira no final que aparece a tabela `patients`
   com 0 registros.

2. **Criar um usuário de teste para login**: painel do Supabase → Authentication → Users →
   "Add user" → preencha email e senha → marque "Auto Confirm User" (assim não precisa configurar
   envio de email) → Create user. Use esse email/senha para logar no BariExtract local.

3. **Preencher a chave Gemini**: abra o `.env` na raiz do projeto e troque
   `COLE_SUA_CHAVE_GEMINI_AQUI` pela sua chave real.

4. **Instalar dependências e rodar**:
   ```
   npm install
   npm run dev
   ```
   O app sobe em `http://localhost:3000`.

## Observação

No momento não consigo rodar comandos de terminal diretamente no seu PC (falha conhecida ligada
à atualização do Windows de 08/09, que afeta a ponte usada para isso) — por isso os passos 4 acima
são para você rodar (você mencionou que vai usar o Windsurf, sem problema). Consigo continuar
editando arquivos do projeto normalmente.

---

## Atualização — Anonimização, indicador de progresso e novo visual

### ⚠️ Ação necessária no banco: rode o script de migração

Você já executou uma versão anterior do `supabase_setup_local.sql` (com a coluna `nome`). **Não
rode esse arquivo de novo.** Em vez disso, abra o SQL Editor do seu projeto Supabase e rode o
novo arquivo **`supabase_migration_anonimizacao.sql`** inteiro. Ele:

- Cria a coluna `codigo_anonimizado` em `patients` e a tabela `patient_identities` (o gabarito).
- Se você já tiver pacientes de teste cadastrados, migra automaticamente o nome de cada um para
  o gabarito (gerando um código para cada) antes de apagar a coluna `nome`. Se preferir simplificar,
  pode também simplesmente apagar os pacientes de teste direto no Table Editor antes de rodar —
  aí a migração não tem nada para converter.
- Configura a segurança do gabarito: o app só consegue **gravar** e **excluir** um registro ali,
  nunca **ler** de volta (não existe política de SELECT nem de UPDATE). Só é possível ver o nome
  de um paciente entrando direto no Supabase (Table Editor ou SQL Editor) — nunca pelo app.

### 1. Anonimização dos pacientes

- Cada paciente extraído recebe um código aleatório no formato `PAC-7F3K9` (gerado no navegador,
  sem sequência previsível). Esse código é o que aparece em toda a interface: lista lateral,
  ficha do paciente, formulário de edição, cabeçalho — em nenhum lugar do app aparece o nome real.
- O nome real que a IA extrai do prontuário é enviado uma única vez para `patient_identities`
  (o gabarito) logo após o paciente ser salvo, e não fica guardado em nenhuma variável do app
  depois disso.
- Para descobrir o nome de um paciente a partir do código, é preciso entrar direto no Supabase e
  rodar (comentário já deixado no fim do `supabase_migration_anonimizacao.sql`):
  ```sql
  SELECT p.codigo_anonimizado, i.nome_original
  FROM patients p
  JOIN patient_identities i ON i.patient_id = p.id
  WHERE p.codigo_anonimizado = 'PAC-XXXXX';
  ```
- O Excel exportado não inclui nome nem número de prontuário — só o código anonimizado e os
  dados clínicos.

### 2. Indicador visual de progresso na extração

Ao clicar para extrair, o card de entrada dá lugar a uma sequência animada com 4 etapas:
**Anonimizando dados → Extraindo dados → Finalizando processo → Extração completada**, com
ícone de check em cada etapa concluída e a barra de progresso/retentativas da IA embutida na
etapa "Extraindo dados". Isso deixa claro que o sistema está trabalhando, principalmente ao
processar um lote com vários prontuários de uma vez.

### 3. Novo visual

Paleta e tipografia refeitas (fonte Inter + JetBrains Mono para os códigos), com um degradê
teal → esmeralda → índigo como cor de marca (usado no logo, botões principais e badges),
cards com sombra suave, sidebar e login redesenhados, e uma badge de escudo (🛡) reforçando
visualmente que os dados dos pacientes são tratados de forma anonimizada.

### Arquivos novos/alterados nesta rodada

- `src/utils/anonymization.ts` (novo) — gera os códigos `PAC-XXXXX`.
- `src/services/examesSupabaseService.ts` — nova função `salvarIdentidadePaciente` (grava no
  gabarito).
- `src/types.ts`, `src/services/geminiService.ts`, `src/App.tsx` — fluxo de anonimização,
  indicador de progresso e o novo visual.
- `src/index.css`, `src/components/Login.jsx`, `src/components/Loading.jsx` — novo visual.
- `supabase_setup_local.sql` (atualizado, útil só para quem for criar o banco do zero) e
  `supabase_migration_anonimizacao.sql` (novo — é este que você deve rodar agora).

### 4. Revisão antes de salvar (adicionado depois)

Como o app extrai vários prontuários de uma vez, a extração e o salvamento no banco foram
separados: primeiro a IA extrai todos os itens do lote (nada é salvo ainda), depois entra uma
etapa **"Revisão clínica"** — mostra um paciente por vez, com os campos principais editáveis,
para conferir antes de gravar. Nessa tela é possível:

- Navegar entre os pacientes do lote (Anterior/Próximo) e corrigir qualquer campo.
- Descartar um paciente específico (ele não é salvo).
- Cancelar a revisão inteira (nenhum paciente do lote é salvo).
- Clicar em **"Confirmar e Salvar Todos"** a qualquer momento — não precisa passar por todos um a
  um: revisou os primeiros e confia no restante? Clique e salva o lote inteiro de uma vez.

O nome real extraído continua não aparecendo em nenhum momento nessa tela — ele só é gravado no
gabarito (`patient_identities`) depois que "Confirmar e Salvar Todos" é clicado.

### 5. Prontuário também anonimizado

O número do prontuário passou a receber o mesmo tratamento do nome: ele nunca mais aparece em
nenhuma tela do app (lista de pacientes, ficha, revisão, edição) e não fica mais na tabela
`patients`. Ele vai direto para o gabarito (`patient_identities`, coluna `prontuario_original`),
com a mesma segurança do nome — o app só consegue gravar ali, nunca ler de volta.

**⚠️ Ação necessária no banco**: rode o script **`supabase_migration_prontuario.sql`** no SQL
Editor do seu Supabase (depois do `supabase_migration_anonimizacao.sql`, que você já deve ter
rodado). Ele migra o prontuário de pacientes de teste existentes para o gabarito e remove a
coluna `prontuario` de `patients`.

### 6. Página "Sobre" dentro do app

Nova aba **"Sobre"** na navegação principal (ao lado de Pacientes e Dashboard), com uma página
explicando o que é o BariExtract: por que foi criado, o passo a passo de como funciona (do texto
colado até o dado salvo), reforço de como a anonimização funciona na prática, quais categorias
de variáveis são coletadas (com uma lista expansível por categoria), e como a IA é usada — deixando
claro que o texto do prontuário enviado para o Gemini não fica guardado em lugar nenhum do
BariExtract depois da extração.

### Arquivos novos/alterados nesta rodada

- `supabase_migration_prontuario.sql` (novo — rode este no Supabase).
- `supabase_setup_local.sql` (atualizado, útil só para quem for criar o banco do zero).
- `src/services/examesSupabaseService.ts` — `salvarIdentidadePaciente` agora também grava o
  prontuário no gabarito.
- `src/types.ts`, `src/services/geminiService.ts`, `src/App.tsx` — remoção do prontuário do
  modelo de dados e de toda a interface.
- `src/components/Sobre.tsx` (novo) — a página "Sobre".

### 7. Ordem correta no indicador de progresso

O indicador de progresso da extração mostrava "Anonimizando dados" antes de "Extraindo dados",
o que não fazia sentido (não dá pra anonimizar um dado que ainda não foi extraído). Corrigido:
agora a ordem real do processamento é **Extraindo dados → Anonimizando dados → Revisão clínica →
Finalizando processo → Extração completada**, e o indicador visual reflete exatamente essa ordem
(o código de anonimização só é gerado depois que a extração de todo o lote termina).

### 8. Todas as variáveis coletadas agora são editáveis

Antes, tanto a tela de revisão (antes de salvar) quanto a tela de edição (depois de salvo) só
mostravam um recorte pequeno de campos (~15 de todas as variáveis extraídas). As demais — todas
as comorbidades, hábitos/aspectos psicossociais, exames pré-operatórios, e todo o acompanhamento
de peso pós-operatório — eram extraídas e gravadas no banco, mas não podiam ser corrigidas
manualmente se a IA errasse algo.

Agora as duas telas mostram **todas** as variáveis que realmente são usadas em algum lugar do
app (ficha do paciente ou Excel exportado), organizadas nas mesmas categorias da aba "Sobre":
Identificação e Perfil, Dados Cirúrgicos e Antropometria, Hábitos e Aspectos Psicossociais,
Comorbidades, Exames Pré-operatórios, EDA e USG Pós-operatório, e Acompanhamento Pós-operatório.

Ficaram de fora, propositalmente, alguns campos que a IA ainda extrai mas que hoje não aparecem
em nenhum lugar do app nem no Excel exportado (exames laboratoriais como HbA1c/glicemia/TSH/perfil
lipídico, espirometria, RX tórax, ecocardiograma, risco pulmonar/cardiovascular e dose de
Clexane) — consistente com o ajuste feito na aba "Sobre", que só descreve o que de fato é
coletado e utilizado. Se um dia esses campos passarem a ser exibidos/exportados, dá pra
adicioná-los à mesma lista.

### Arquivos alterados nesta rodada

- `src/App.tsx` — reordenação do indicador de progresso (extração antes de anonimização) e nova
  constante `EDITABLE_FIELD_SECTIONS`, usada tanto no formulário de edição quanto na tela de
  revisão, para cobrir todas as variáveis coletadas.

### 9. IA parou de extrair os campos que nunca eram usados

Os campos citados no item 8 como "fora do que é usado hoje" (exames laboratoriais — HbA1c,
glicemia de jejum, TSH, T4 livre, B12, vitamina D, colesterol total, HDL, LDL, triglicerídeos,
TGO, TGP —, espirometria, RX tórax, ecocardiograma (FE, PSAP, outras alterações), risco
pulmonar, risco cardiovascular e dose de Clexane) foram **removidos do que a IA extrai**, não só
escondidos na interface. Isso reduz o schema que vai em toda chamada ao Gemini (menos ~20 campos
por prontuário), o que economiza tokens tanto na requisição quanto na resposta — sem nenhuma
perda, já que esses campos não apareciam em lugar nenhum do app.

Os campos foram removidos de `PatientData` (`src/types.ts`), do schema de extração e da lista de
sanitização (`src/services/geminiService.ts`), e de todos os pontos do `src/App.tsx` que liam ou
gravavam esses campos (carregamento de pacientes, inserção, atualização). As colunas
correspondentes continuam existindo na tabela `patients` no Supabase — não fiz migração para
removê-las, porque isso é só uma limpeza opcional e não afeta o funcionamento; elas simplesmente
não recebem mais dados. Se quiser uma migração para apagá-las também, é só pedir.

O campo `outrasAlteracoesGI` (outras alterações gastrointestinais) estava na mesma situação —
extraído e salvo, mas nunca exibido nem exportado — e também foi removido, junto com os demais.

### Arquivos alterados nesta rodada

- `src/types.ts` — remoção dos campos não utilizados de `PatientData` e de `CSV_HEADERS`.
- `src/services/geminiService.ts` — remoção desses campos do schema de extração da IA e da lista
  de sanitização.
- `src/App.tsx` — remoção das referências a esses campos no carregamento, na extração, na
  inserção e na atualização de pacientes.

### 10. Prontuários modelo para os avaliadores da competição testarem

Como o BariExtract só funciona bem com prontuários no formato/protocolo do seu serviço, e você
não pode enviar prontuários reais para quem for avaliar o sistema na competição, criei 3
prontuários **100% fictícios** no mesmo formato dos prontuários reais (mesma estrutura de
"Consultas Ambulatoriais", mesmas especialidades — Bariátrica, Nutrição, Psicologia, Cardiologia,
Endocrinologia —, mesmo jargão e abreviações). Nenhum dado de paciente real foi usado: nomes,
números de prontuário (faixa 999xxx/1, fora de qualquer intervalo real), datas e valores clínicos
foram todos inventados especificamente para este fim. Cada página traz uma faixa verde no topo
dizendo "PRONTUÁRIO MODELO — DADOS 100% FICTÍCIOS", para não haver qualquer dúvida.

Os 3 casos cobrem cenários diferentes de teste:
- **Modelo 1 (caso simples)**: Sleeve, poucas comorbidades, acompanhamento completo de 1 ano sem
  intercorrências.
- **Modelo 2 (caso complexo)**: Bypass, múltiplas comorbidades (HAS, DM2, dislipidemia, esteatose),
  e desenvolve colelitíase no pós-operatório — testa o alerta "Desenvolveu Colelitíase" da ficha.
- **Modelo 3 (acompanhamento parcial)**: só tem pré-operatório e os primeiros 40 dias de
  pós-operatório registrados — testa como o sistema lida com um prontuário incompleto.

Na tela de upload, quando não há nenhum arquivo/texto selecionado, aparece uma seção "Não tem um
prontuário à mão para testar?" com um botão de download para cada um dos 3 modelos. A pessoa
baixa o PDF e já pode arrastar de volta para o próprio BariExtract testar a extração.

Os arquivos ficam em `public/prontuarios-modelo/` (pasta pública do Vite, incluída
automaticamente em qualquer build/deploy) — não precisa de nenhuma configuração extra para os
links de download funcionarem, seja rodando local (`npm run dev`) ou publicado.

**Antes de submeter para a competição**: dei uma revisada no conteúdo clínico dos 3 modelos, mas
como não sou da área, vale você conferir rapidamente se o jargão/abreviações/valores fazem
sentido clínico (mandei os 3 PDFs para você revisar). Se algo precisar de ajuste, é só avisar.

### Arquivos novos nesta rodada

- `public/prontuarios-modelo/prontuario-modelo-1-caso-simples.pdf` (novo)
- `public/prontuarios-modelo/prontuario-modelo-2-caso-complexo.pdf` (novo)
- `public/prontuarios-modelo/prontuario-modelo-3-acompanhamento-parcial.pdf` (novo)
- `src/App.tsx` — nova constante `SAMPLE_RECORDS` e seção de download na tela de upload.

### 11. Tour de boas-vindas ao fazer login

Criei um tour de apresentação que aparece automaticamente na primeira vez que alguém loga no
BariExtract neste navegador — pensado tanto para você quanto para os avaliadores da competição,
que provavelmente nunca viram o sistema antes.

O tour tem 7 passos, cobrindo exatamente o que foi pedido e mais algumas coisas que me pareceram
úteis de incluir:

1. **Contexto institucional** — deixa claro que o BariExtract foi construído em cima do protocolo
   do serviço de cirurgia bariátrica que é hoje o maior programa do tipo em Mato Grosso, e que
   usar em outro serviço/protocolo exige adaptar as variáveis extraídas e o prompt da IA. Esse
   passo tem um destaque visual (caixa amber) para chamar atenção para esse aviso, já que é o
   ponto mais importante para quem for avaliar de fora.
2. **Envio do prontuário** — explica colar texto ou enviar arquivo(s), inclusive vários pacientes
   de uma vez, e menciona os prontuários modelo (seção 10) para quem não tem um prontuário real
   à mão.
3. **Anonimização** — explica o código anônimo gerado antes de qualquer leitura pela IA.
4. **Extração e revisão** — explica a extração pela IA e a revisão obrigatória antes de salvar.
5. **Pacientes e Dashboard** — explica a busca/edição por paciente e as estatísticas agregadas.
6. **Exportação** — explica o Excel anonimizado.
7. **Final** — avisa que o tour pode ser revisto a qualquer momento e aponta para a aba Sobre
   para quem quiser mais detalhes sobre segurança/anonimização.

Outras decisões/ideias que incluí além do que foi pedido:

- **Botão "Pular tour"** fixo no canto superior direito da janela do tour (pedido explicitamente),
  além de navegação Voltar/Próximo e bolinhas de progresso clicáveis para pular direto para
  qualquer passo.
- **"Lembrar" que o tour já foi visto**: guardado em `localStorage` (chave
  `bariextract_tour_seen`), então ele só aparece sozinho na primeira vez — não a cada login, para
  não incomodar quem já usa o sistema no dia a dia. Se o `localStorage` estiver bloqueado (ex:
  navegação anônima), o tour simplesmente aparece de novo sem quebrar nada.
- **Botão "Tour" no cabeçalho** (ícone de interrogação, ao lado do indicador "IA Ativa"): permite
  reabrir o tour manualmente a qualquer momento — pensei que seria importante um avaliador
  conseguir rever as explicações sem precisar limpar o navegador.

### Arquivos novos/alterados nesta rodada

- `src/components/Tour.tsx` (novo) — componente do tour, 7 passos, navegação e botão de pular.
- `src/App.tsx` — import do `Tour`, estado `showTour`, efeito que mostra o tour no primeiro login
  (via `localStorage`), botão "Tour" no cabeçalho para reabrir manualmente.

### 12. Tela de cadastro (para os avaliadores criarem a própria conta)

Até agora, criar uma conta nova só era possível direto no painel do Supabase — inviável para os
avaliadores da competição. Adicionei uma tela de "Criar conta" na própria tela de login, com um
link para alternar entre "Entrar" e "Criar conta".

O cadastro usa o mesmo sistema de autenticação que já existia (Supabase Auth), então nada mudou
na segurança do login em si — as senhas continuam sendo armazenadas com hash pelo Supabase, nunca
em texto puro. O que mudou é só que agora qualquer pessoa (com o código de convite certo) pode
criar a própria conta, em vez de você precisar cadastrar uma por uma manualmente.

Conversamos sobre duas decisões importantes antes de implementar, e você escolheu:

1. **Código de convite obrigatório para se cadastrar** — além de email e senha, quem for criar
   conta precisa digitar um código que só você compartilha com os avaliadores. Isso evita que
   qualquer pessoa que ache o link do sistema publicado vire usuário com acesso aos dados de
   pesquisa (mesmo anonimizados). O código fica na variável de ambiente `VITE_INVITE_CODE` — não
   está fixo no código-fonte, então dá para trocar quando quiser sem precisar mexer em nada além
   do `.env`/das variáveis de ambiente do deploy.
2. **Confirmação por email obrigatória** — depois de se cadastrar, a pessoa recebe um email do
   Supabase com um link de confirmação e só consegue entrar depois de clicar nele. A tela já
   mostra uma mensagem clara avisando disso após o cadastro.

**Importante — duas coisas que você precisa configurar, porque eu não tenho como fazer isso à
distância:**

- **Adicionar `VITE_INVITE_CODE` no seu `.env` local** (arquivo na raiz do projeto) e também nas
  variáveis de ambiente do deploy na Vercel (Settings → Environment Variables), do mesmo jeito que
  já está com `VITE_GEMINI_KEY` e as chaves do Supabase. Exemplo:
  ```
  VITE_INVITE_CODE=escolha_um_codigo_aqui
  ```
  Pode ser qualquer texto — não precisa ser complexo, já que a segurança real do login continua
  sendo o email/senha de cada pessoa. É só um "porteiro" para triar quem pode se cadastrar. Sem
  essa variável configurada, a tela de cadastro mostra um aviso claro em vez de deixar cadastrar
  sem controle nenhum.
- **Conferir se "Confirm email" está ativado no seu projeto Supabase** (Authentication → Providers
  → Email, no painel do Supabase). É o padrão em projetos novos, então é provável que já esteja
  assim — mas vale confirmar antes de submeter para a competição, para garantir que o
  comportamento bate com o que você escolheu.

Os arquivos `.env.example` e `env-production.example` já foram atualizados com a nova variável,
como referência.

### Arquivos alterados nesta rodada

- `src/components/Login.jsx` — tela de cadastro adicionada (alternância Entrar/Criar conta,
  validação de código de convite, confirmação de senha, tela de "confira seu email" após o
  cadastro).
- `src/vite-env.d.ts` — tipo da nova variável `VITE_INVITE_CODE`.
- `.env.example` e `env-production.example` — documentação da nova variável.

### 13. Correção da fórmula de "% Excesso Peso Perdido"

Você reportou que o cálculo estava errado. Conferi o prompt que manda a IA calcular esse campo
(`src/services/geminiService.ts`) e encontrei o problema: a fórmula usada era

```
((Peso Inicial - Peso Último Pré-op) / Peso Inicial) × 100
```

Isso calcula o percentual de peso perdido durante o **preparo pré-operatório** (da 1ª consulta até
a véspera da cirurgia) — não o %EWL pós-operatório, que é o que esse campo deveria representar,
já que ele fica ao lado de "Peso 1 Ano PO" e "Perda Absoluta 1 Ano" na ficha do paciente e na
planilha exportada. Ou seja, o campo tinha o nome e o lugar de um resultado pós-operatório, mas
calculava outra coisa, referente só ao período antes da cirurgia.

Corrigi para a fórmula real de %EWL (percentual de excesso de peso perdido), usando a mesma
metodologia da sua pesquisa com os 706 pacientes (peso ideal pela fórmula clássica, excesso de
peso = peso de referência menos peso ideal):

1. **Peso Ideal (kg)** = Altura² × 25
2. **Excesso de Peso Inicial (kg)** = Peso Inicial − Peso Ideal
3. **% Excesso Peso Perdido** = ((Peso Inicial − Peso 1 Ano PO) / Excesso de Peso Inicial) × 100

Combinamos que o peso de referência pré-operatório é o **Peso Inicial (1ª consulta)** — não o
"Peso Último Pré-op" — para ficar consistente com o que já foi usado nos dados publicados/
submetidos da coorte. A IA só calcula esse campo quando Peso Inicial, Altura e Peso 1 Ano PO
estiverem todos disponíveis no texto do prontuário; caso contrário, deixa vazio (em vez de
calcular algo errado com dado faltando).

**Atenção**: essa correção vale só para prontuários extraídos a partir de agora. Pacientes que já
foram extraídos e salvos no banco com o valor antigo (calculado errado) não são recalculados
automaticamente — o BariExtract não faz alteração retroativa em dados já salvos. Se quiser, dá
para reprocessar/corrigir os pacientes já cadastrados; é só avisar.

### Arquivos alterados nesta rodada

- `src/services/geminiService.ts` — fórmula de `percentExcessoPesoPerdido` corrigida no prompt de
  extração da IA.

### 14. Removido o código de convite do cadastro

O formulário de inscrição da competição não tinha campo para você informar o código de convite
para os avaliadores, então não tinha como eles saberem qual código usar. Removi essa exigência —
agora a tela de "Criar conta" pede só email, senha e confirmar senha, sem código nenhum.

O que continua igual: o cadastro ainda usa o Supabase Auth normalmente (senha com hash, nunca em
texto puro), e a confirmação por email antes do primeiro login continua ativa (como você escolheu
antes) — então mesmo sem o código, cada avaliador ainda precisa confirmar um email de verdade
para conseguir entrar, o que já barra a maioria dos cadastros aleatórios.

**Fica um ponto de atenção para depois da competição**: sem o código de convite, qualquer pessoa
que encontrar o link consegue criar conta e ver os dados anonimizados de pesquisa cadastrados no
sistema (nunca nome ou prontuário real, mas ainda assim são dados clínicos). Quando a avaliação
terminar, vale a pena reativar essa proteção (ou simplesmente desligar o cadastro público) —
é só me pedir que eu reverto rapidinho, o código já existia e funcionava.

### Arquivos alterados nesta rodada

- `src/components/Login.jsx` — removido o campo e a validação de código de convite do cadastro.
- `src/vite-env.d.ts`, `.env.example`, `env-production.example` — removida a variável
  `VITE_INVITE_CODE` (não é mais usada; se você já tinha configurado essa variável na Vercel, pode
  deixar ou remover de lá também, não faz diferença agora).
