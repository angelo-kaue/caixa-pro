# Setup do Supabase e deploy

> Os nomes dos menus do painel do Supabase e da Netlify podem mudar com o tempo. Os passos abaixo descrevem a intenção.

## 1. Supabase

1. **Banco:** no SQL Editor do projeto, execute na ordem os arquivos de `supabase/migrations/`:
   `0001_core_schema.sql` → `0002_functions_and_triggers.sql` → `0003_rls_policies.sql`.
   Não execute nada de `supabase/tests/` no projeto real (é só para testes locais).
2. **URLs de autenticação** (Authentication → URL Configuration):
   - *Site URL*: `http://localhost:5173` durante o desenvolvimento; troque pelo domínio de produção no lançamento.
   - *Redirect URLs*: `http://localhost:5173/**` e `https://SEU-DOMINIO/**`.
   - Os links de confirmação de e-mail e de recuperação de senha só funcionam para URLs listadas aqui.
3. **E-mail:** mantenha a confirmação de e-mail ativada. Defina o tamanho mínimo de senha como 8.
   A proteção contra senhas vazadas, quando disponível no seu plano do Supabase, vale ser ativada.
4. **SMTP próprio:** o envio padrão do Supabase tem limite baixo de e-mails por hora e serve só para testes. Configure um SMTP (por exemplo Resend, SendGrid ou Amazon SES) antes de abrir ao público.
5. **Chaves:** o front usa apenas a `anon key`. Nunca coloque a `service_role` no front, no `.env.example` ou no GitHub.

## 2. GitHub

```bash
git branch -M main
git remote add origin https://github.com/angelo-kaue/caixa-pro.git
git push -u origin main
```

`.env.local` está no `.gitignore` e não vai para o repositório.

## 3. Netlify (só quando for hospedar)

1. *Add new site → Import from Git* e selecione o repositório.
2. Build: `npm run build`, publicação: `dist` (já definidos em `netlify.toml`, assim como o redirecionamento de SPA, os cabeçalhos de segurança e o Node 22).
3. Em *Environment variables*, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Depois do primeiro deploy, copie a URL do site e adicione-a ao *Site URL* e aos *Redirect URLs* do Supabase.
5. **Domínio próprio e HTTPS:** em *Domain management*, adicione o domínio e siga as instruções de DNS. O certificado HTTPS é emitido automaticamente.

## 4. Verificação pós-deploy

- Abrir `/`, `/cadastro`, `/entrar`; criar conta e receber o e-mail de confirmação; entrar; sair.
- Pedir recuperação de senha e concluir a redefinição pelo link.
- Abrir `/app` sem login e confirmar o redirecionamento para `/entrar`.
- Abrir `/qualquer-rota` direto na barra de endereço (o redirecionamento de SPA deve servir o app).
- Conferir no DevTools que o Content-Security-Policy não bloqueia nada necessário.
