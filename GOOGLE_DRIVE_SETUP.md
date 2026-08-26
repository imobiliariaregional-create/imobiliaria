# Google Drive para os documentos do sistema

Novos contratos, autorizações, laudos, notas fiscais e o papel timbrado não são salvos no Storage do Supabase. O banco guarda somente o ID, nome, tipo e tamanho; o conteúdo fica na pasta privada escolhida no Google Drive. Anexos antigos continuam disponíveis durante a transição.

## Organização automática

Dentro da pasta indicada por `GOOGLE_DRIVE_FOLDER_ID`, o sistema cria:

```text
01 - AUTORIZACOES DE ADMINISTRACAO
02 - CONTRATOS DE LOCACAO
   ├── IMOVEIS ADMINISTRADOS
   └── LOCACOES AVULSAS
03 - CONTRATOS DE VENDA
04 - LAUDOS DE VISTORIA
05 - NOTAS FISCAIS
06 - PAPEL TIMBRADO
```

As subpastas de ano, mês, proprietário, imóvel e número do contrato são criadas quando o primeiro arquivo daquela classificação é enviado. A pasta-raiz pode ser renomeada ou movida no Google Drive sem alterar a configuração, pois o ID permanece o mesmo.

## Configuração única

1. No Google Cloud Console, crie ou selecione um projeto e habilite a **Google Drive API**.
2. Configure a tela de consentimento OAuth e crie credenciais do tipo **OAuth client ID**.
3. Autorize uma conta Google que tenha acesso à pasta usando o escopo `https://www.googleapis.com/auth/drive.file` e obtenha um refresh token.
4. Copie o ID da pasta de destino (o trecho após `/folders/` na URL do Drive).
5. Cadastre os quatro secrets da Edge Function:

   ```powershell
   npx supabase secrets set GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." GOOGLE_REFRESH_TOKEN="..." GOOGLE_DRIVE_FOLDER_ID="..."
   ```

6. Publique a função:

   ```powershell
   npx supabase functions deploy google-drive
   ```

Nunca coloque client secret ou refresh token no `.env` do frontend. A pasta também não precisa ser pública: uploads, downloads e exclusões passam pela Edge Function autenticada. O limite de cada arquivo no sistema é 15 MB.

Se for usar uma service account, a pasta deve estar em um **Shared Drive**; contas de serviço não possuem cota própria para serem donas de arquivos em “Meu Drive”. Para uma conta Google comum, use o fluxo OAuth descrito acima.
