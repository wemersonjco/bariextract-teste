# Deploy desta versão (competição) — GitHub + Vercel

Este guia é só para **esta cópia** do BariExtract (a versão sem laboratoriais, com prontuários
modelo, cadastro por código de convite e tour de boas-vindas) — a que você está usando para a
competição. Ela vai para um repositório GitHub e um projeto Vercel **novos e separados** do seu
sistema de produção (o que atende a pesquisa real dos 706 pacientes), para não misturar as duas
coisas.

Todos os comandos abaixo você roda no terminal (PowerShell/CMD/Git Bash — tanto faz), dentro da
pasta do projeto:

```
C:\Users\wemer\OneDrive\Desktop\BARIEXTRACT TESTE\bariextract-main\bariextract-main
```

## 0. Verifique se o Git está instalado

```
git --version
```

Se der erro de comando não reconhecido, instale em https://git-scm.com/download/win (next, next,
next — as opções padrão servem) e abra um terminal novo depois de instalar.

Se for a primeira vez usando Git nesse computador, configure seu nome e email (uma vez só, vale
para todos os projetos):

```
git config --global user.name "Wemerson"
git config --global user.email "wemersonjco@gmail.com"
```

## 1. Criar o repositório no GitHub

1. Acesse https://github.com/new (logado na sua conta).
2. **Nome do repositório**: sugestão `bariextract-competicao` (pode escolher outro nome).
3. **Visibilidade**: Privado é o mais seguro por padrão — só quem você convidar consegue ver o
   código. Se a organizadora da competição pedir para ver o código-fonte, você pode deixar
   Público, ou manter Privado e adicionar o avaliador como colaborador depois (Settings →
   Collaborators). O app publicado na Vercel funciona do mesmo jeito nos dois casos.
4. **NÃO marque** "Add a README file", "Add .gitignore" nem "Choose a license" — o projeto já tem
   esses arquivos, marcar essas opções só atrapalha o primeiro push.
5. Clique em "Create repository". Na próxima tela, copie a URL que aparece em "…or push an
   existing repository from the command line" (algo como
   `https://github.com/SEU_USUARIO/bariextract-competicao.git`) — você vai usar no passo 3.

## 2. Conferir se nada sensível vai ser enviado

O `.gitignore` do projeto já bloqueia o `.env` (onde ficam suas chaves reais) — só os arquivos de
exemplo (`.env.example`, `env-production.example`, que têm só texto de placeholder) vão para o
GitHub. Não precisa fazer nada aqui, é só para você saber que está seguro.

## 3. Primeiro commit e push

Ainda no terminal, dentro da pasta do projeto:

```
git init
git add .
git commit -m "Versao para avaliacao na competicao - BariExtract"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/bariextract-competicao.git
git push -u origin main
```

(Troque a URL do `git remote add` pela que você copiou no passo 1.)

Se o GitHub pedir login na hora do `git push` e recusar sua senha normal, é porque eles não
aceitam mais senha por linha de comando — nesse caso, a forma mais simples é instalar o **GitHub
Desktop** (https://desktop.github.com), abrir o projeto por lá e clicar em "Publish repository"
em vez de usar o `git push` manual. Ele cuida do login sozinho.

## 4. Criar o projeto na Vercel

1. Acesse https://vercel.com/new (logado na sua conta — se você já tinha conta de quando fez o
   deploy de produção, pode usar a mesma).
2. Se o repositório novo não aparecer na lista, clique em "Adjust GitHub App Permissions" e
   autorize a Vercel a acessar o `bariextract-competicao` (ou "All repositories").
3. Clique em "Import" no repositório `bariextract-competicao`.
4. A Vercel deve detectar sozinha "Vite" como o framework. Não precisa mexer em Build Command
   nem Output Directory — o `package.json` já tem o script `vercel-build` que a Vercel usa
   automaticamente.
5. **Antes de clicar em Deploy**, abra a seção "Environment Variables" e adicione as 4 variáveis
   abaixo, com os MESMOS valores que já estão no seu `.env` local (abra o `.env` no seu editor de
   código para copiar os valores reais — são as mesmas chaves que você já usa hoje):

   | Nome | Valor |
   |---|---|
   | `VITE_GEMINI_KEY` | (sua chave da API Gemini) |
   | `VITE_SUPABASE_URL` | (URL do projeto Supabase desta cópia) |
   | `VITE_SUPABASE_ANON_KEY` | (chave anônima do Supabase desta cópia) |
   | `VITE_INVITE_CODE` | (o código de convite que você definiu) |

   Marque "Production", "Preview" e "Development" para cada uma.
6. Clique em **Deploy**. Leva cerca de 1–2 minutos.
7. Ao terminar, a Vercel mostra a URL pública, algo como
   `https://bariextract-competicao.vercel.app` — é esse link que você vai enviar para os
   avaliadores.

## 5. Depois do primeiro deploy

- **Deploys seguintes são automáticos**: sempre que você fizer `git add` / `git commit` / `git
  push` para a branch `main`, a Vercel publica a nova versão sozinha, sem precisar repetir os
  passos da Vercel.
- **Teste tudo na URL publicada** antes de enviar para a competição:
  - Criar uma conta pelo cadastro (com o código de convite) usando um email que você consiga
    acessar, e confirmar pelo link recebido.
  - Ver se o tour aparece no primeiro login.
  - Baixar um dos prontuários modelo e testar a extração completa.
  - Conferir a exportação em Excel.
- Se o Supabase da competição tiver a confirmação de email ativada (como você escolheu), confira
  se o remetente do email de confirmação não está caindo no spam do avaliador — vale testar com
  um email seu de outro provedor (ex: Gmail) para ver como chega.

## Problemas comuns

- **"fatal: not a git repository"** ao rodar `git add`: você não está na pasta certa do projeto —
  confira com `cd` se está em
  `C:\Users\wemer\OneDrive\Desktop\BARIEXTRACT TESTE\bariextract-main\bariextract-main`.
- **Build falha na Vercel com erro de tipo/TypeScript**: raro, já que testei o `tsc --noEmit`
  aqui antes de cada entrega, mas se acontecer, o log de build da Vercel mostra a linha exata do
  erro — me manda que eu corrijo.
- **App abre mas dá erro de "Chave da API Gemini não configurada"**: alguma das 4 variáveis de
  ambiente não foi salva certo na Vercel — confira em Settings → Environment Variables do projeto.
