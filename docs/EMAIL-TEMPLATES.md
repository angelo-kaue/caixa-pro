# Modelos de e-mail do Supabase (à prova de leitores de e-mail)

Em **Authentication → Email Templates**. O link aponta para uma página do CaixaPro, e o token só é usado quando a
pessoa clica no botão da página. `{{ .SiteURL }}` é o *Site URL* configurado em *URL Configuration* (deve ser o endereço final do site).

## Reset password
Subject: `Redefinir sua senha do CaixaPro`
```html
<h2>Redefinir senha</h2>
<p>Recebemos um pedido para criar uma nova senha para a sua conta.</p>
<p><a href="{{ .SiteURL }}/redefinir-senha?token_hash={{ .TokenHash }}&type=recovery">Criar nova senha</a></p>
<p>Se você não pediu isso, ignore esta mensagem: a sua senha continua a mesma.</p>
```

## Confirm signup
Subject: `Confirme seu e-mail no CaixaPro`
```html
<h2>Bem-vindo ao CaixaPro</h2>
<p>Falta só um passo: confirme o seu e-mail para ativar a conta.</p>
<p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Confirmar meu e-mail</a></p>
<p>Se você não criou uma conta no CaixaPro, pode ignorar esta mensagem.</p>
```
