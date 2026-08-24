# Sistema de Gestão — Imobiliária

Sistema interno de controle para a imobiliária: imóveis, proprietários, inquilinos/compradores, contratos (aluguel, administração e venda), pagamentos mensais recebidos pela imobiliária, contas de água/energia, laudos de vistoria e notas fiscais.

**Arquitetura:** SPA (React + Vite) 100% client-side, hospedada como site estático no GitHub Pages. Não há servidor — o navegador fala diretamente com o Supabase (banco, autenticação e arquivos), e a segurança dos dados é garantida pelas políticas de RLS do Postgres.

## Como funciona a parte financeira

- **Aluguel simples**: a imobiliária recebe só a taxa do primeiro aluguel. Ao criar o contrato, é gerado **um único** pagamento no valor informado.
- **Administração**: a imobiliária recebe **10% do aluguel todo mês**. Ao criar o contrato, são gerados automaticamente os pagamentos mensais (10% do valor do aluguel) do início até a vigência final do contrato.
- **Venda**: a imobiliária recebe uma comissão sobre a venda — percentual (ex: 5%) ou valor fixo, dependendo do negócio. É gerado um pagamento único com o valor calculado.

Todos esses valores aparecem na tela **Pagamentos**, que serve como o controle de "o que a imobiliária tem a receber e já recebeu". As **Notas Fiscais** ficam registradas separadamente para controle fiscal, podendo ser vinculadas a um contrato específico.

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto (grátis).
2. Em **SQL Editor**, execute **todos** os arquivos de [`supabase/migrations/`](supabase/migrations/) na ordem do nome (`0001` até `0007` e, por último, a migração datada). Eles criam o schema completo, as permissões, as operações transacionais e os buckets de arquivos. Não publique uma versão nova do frontend antes de aplicar as migrações correspondentes.
3. Em **Authentication → Users**, clique em **Add user** para criar o login de cada funcionário (e-mail + senha). Não há tela de cadastro pública. Usuários novos recebem o papel `corretor`; um administrador pode alterar `public.perfis.papel` para `admin`, `financeiro` ou `corretor`.
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key** (nunca a `service_role`/secret key — essa não é usada neste projeto e não deve ficar em nenhum arquivo do repositório).

## 2. Configurar o projeto localmente

```bash
npm install
cp .env.example .env.local
```

Edite `.env.local` com a URL e a chave anon do seu projeto Supabase:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Rodar localmente:

```bash
npm run dev
```

Requer **Node.js 22 ou superior**. Para validar as regras financeiras e de datas:

```bash
npm test
npm run build
```

## 3. Publicar no GitHub Pages

O repositório já vem com um workflow (`.github/workflows/deploy.yml`) que builda e publica automaticamente a cada push na branch `main`.

1. No repositório do GitHub, vá em **Settings → Pages** e em "Build and deployment" selecione **Source: GitHub Actions**.
2. Ainda no GitHub, vá em **Settings → Secrets and variables → Actions** e crie dois *repository secrets*:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   (os mesmos valores do seu `.env.local`)
3. Dê push na branch `main` — o Actions builda o projeto e publica em `https://SEU-USUARIO.github.io/imobiliaria/`.

Se o nome do repositório não for `imobiliaria`, ajuste a constante `REPO_NAME` em [`vite.config.ts`](vite.config.ts) para bater com o nome real do repositório (o GitHub Pages serve o site nesse subcaminho).

## Segurança

- Como é uma SPA sem servidor, a sessão de login fica no navegador (padrão do Supabase Auth via `localStorage`), e não em cookie protegido por servidor. Isso é normal para esse tipo de site, mas significa que quem tiver acesso ao navegador/computador logado tem acesso à sessão.
- Todo o controle de acesso real está nas políticas de **Row Level Security** do Supabase. Administradores controlam exclusões e configurações; o financeiro registra recebimentos, repasses, contas e notas; corretores gerenciam cadastros e contratos.
- A `anon key` é pública por natureza (fica visível no código do site) — isso é esperado e seguro *desde que* o RLS esteja ativo em todas as tabelas, como já está no `0001_init.sql`.

## Estrutura

- `src/pages/` — todas as telas (dashboard, imóveis, proprietários, pessoas, contratos, pagamentos, contas de consumo, notas fiscais) e login.
- `src/lib/supabase.ts` — client do Supabase usado no navegador.
- `src/lib/auth.tsx` — contexto de sessão e rota protegida.
- `src/lib/pagamentos.ts` — regra de geração automática dos pagamentos mensais/únicos por tipo de contrato.
- `supabase/migrations/` — histórico completo e ordenado do schema do banco.
- `.github/workflows/deploy.yml` — build e publicação automática no GitHub Pages.

## Próximos passos possíveis (fora do escopo desta versão)

- Perfis de acesso diferenciados (ex: financeiro x corretor).
- Notificações automáticas (e-mail/WhatsApp) de vencimento de contrato ou pagamento.
- Geração de relatórios em PDF.
