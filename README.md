# Sistema de Gestão — Imobiliária

Sistema interno de controle para a imobiliária: imóveis, proprietários, inquilinos/compradores, contratos (aluguel, administração e venda), pagamentos mensais recebidos pela imobiliária, contas de água/energia, laudos de vistoria e notas fiscais.

## Como funciona a parte financeira

- **Aluguel simples**: a imobiliária recebe só a taxa do primeiro aluguel. Ao criar o contrato, é gerado **um único** pagamento no valor informado.
- **Administração**: a imobiliária recebe **10% do aluguel todo mês**. Ao criar o contrato, são gerados automaticamente os pagamentos mensais (10% do valor do aluguel) do início até a vigência final do contrato.
- **Venda**: a imobiliária recebe uma comissão sobre a venda — percentual (ex: 5%) ou valor fixo, dependendo do negócio. É gerado um pagamento único com o valor calculado.

Todos esses valores aparecem na tela **Pagamentos**, que serve como o controle de "o que a imobiliária tem a receber e já recebeu". As **Notas Fiscais** ficam registradas separadamente para controle fiscal, podendo ser vinculadas a um contrato específico.

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto (grátis).
2. Em **SQL Editor**, cole e execute o conteúdo de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). Isso cria todas as tabelas, as permissões (RLS) e os buckets de arquivos (`laudos-vistoria` e `notas-fiscais`).
3. Em **Authentication → Users**, clique em **Add user** para criar o login de cada funcionário (e-mail + senha). Não há tela de cadastro pública — o acesso é só para quem a equipe cadastrar aqui.
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

## 2. Configurar o projeto localmente

```bash
npm install
cp .env.example .env.local
```

Edite `.env.local` com a URL e a chave anon do seu projeto Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

Rodar localmente:

```bash
npm run dev
```

Acesse `http://localhost:3000` e faça login com o usuário criado no passo 1.3.

## 3. Publicar no GitHub

```bash
git init
git add .
git commit -m "Sistema inicial de gestão da imobiliária"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

**Atenção:** o arquivo `.env.local` nunca é enviado ao GitHub (está no `.gitignore`). As chaves do Supabase ficam configuradas apenas no deploy (Vercel) e localmente.

## 4. Deploy (recomendado: Vercel)

1. Acesse [vercel.com](https://vercel.com), crie um projeto importando o repositório do GitHub.
2. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os mesmos valores do `.env.local`.
3. Deploy. Pronto — o sistema fica acessível por uma URL pública, protegido por login.

## Estrutura

- `app/(app)/` — telas internas (dashboard, imóveis, proprietários, pessoas, contratos, pagamentos, contas de consumo, notas fiscais), todas atrás do login.
- `app/login/` — tela de login.
- `lib/supabase/` — clients Supabase (browser, server, middleware de sessão).
- `lib/pagamentos.ts` — regra de geração automática dos pagamentos mensais/únicos por tipo de contrato.
- `supabase/migrations/0001_init.sql` — schema completo do banco.

## Próximos passos possíveis (fora do escopo desta versão)

- Perfis de acesso diferenciados (ex: financeiro x corretor).
- Notificações automáticas (e-mail/WhatsApp) de vencimento de contrato ou pagamento.
- Geração de relatórios em PDF.
