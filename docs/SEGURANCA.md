# Segurança do CaixaPro: vistoria de 26/11/2026

Esta vistoria foi feita lendo o código e rodando verificações automáticas no banco. Não substitui um teste de invasão profissional,
mas cobre o que está ao alcance do código e do banco.

## O que foi verificado e está bem
- **Banco:** as 11 tabelas têm RLS; visitantes (`anon`) não têm acesso a nenhuma tabela nem função; todas as funções `SECURITY DEFINER` têm `search_path` fixo; os limites do plano Free valem também em UPDATE; `workspace_id` e `created_by` não mudam; tabelas de cobrança e de lembretes só são acessíveis pelo servidor. Há 7 arquivos de teste SQL.
- **Funções do servidor:** JWT validado, perfil de administrador exigido, preço vem do banco (não do navegador), CORS restrito ao seu site, webhook do Mercado Pago com assinatura, freio de 5 cobranças por minuto, exclusão de conta exige digitar EXCLUIR e cancela o cartão antes.
- **Site:** CSP sem `unsafe-inline` em scripts; sem `dangerouslySetInnerHTML` nem `eval`; destino pós-login validado; só a chave pública (`anon`) vai para o navegador (conferido no build); exportação CSV neutraliza fórmulas (`=`, `+`, `-`, `@`).
- **Login:** mensagens genéricas (não revela se um e-mail existe), no cadastro e na recuperação de senha.

## O que foi melhorado (atualização 8)
- **Login contra tentativas em massa:** verificação anti-robô (Cloudflare Turnstile) em login, cadastro e recuperação de senha; espera crescente na tela depois de 5 erros seguidos (30s até 5 min); senha nova com 10+ caracteres, sem senhas comuns e sem o nome do e-mail.
- **Cabeçalhos do site:** `object-src 'none'`, `Cross-Origin-Opener-Policy`, `Permissions-Policy` ampliada.
- **Pagamento:** o app só redireciona para páginas do Mercado Pago (defesa extra contra redirecionamento falso).
- **Dependências:** `supabase-js` e `react-router` atualizados (vulnerabilidades corrigidas).

Importante: a espera na tela só atrapalha quem usa a página. Quem chama a API direto só é barrado pelo **CAPTCHA** e pelos **limites do Supabase**,
por isso os passos abaixo (fora do código) são necessários.

## Riscos aceitos (e por quê)
- `zod` (consumo de memória com listas enormes) e `react-router` (redirecionamento com barra invertida e hidratação de SSR): a correção exige trocar de versão principal (quebra o app) e o CaixaPro não valida listas vindas do usuário, não usa SSR e só navega para destinos fixos. Revisar quando houver tempo para migrar.
- `vitest`, `esbuild` e `tinypool` (só no computador de desenvolvimento): não vão para o site.

## Configurar fora do código (nesta ordem)
1. **Cloudflare Turnstile** (grátis): crie um widget para `appcaixapro.com.br` (modo Gerenciado). Guarde a *Site key* e a *Secret key*.
2. **Netlify:** variável `VITE_TURNSTILE_SITE_KEY` = Site key, depois Clear cache and deploy site. Confira que o login mostra a verificação.
3. **Supabase > Authentication > Attack Protection:** ative *Enable CAPTCHA protection*, provedor Turnstile, cole a Secret key. **Só faça depois do passo 2**, senão ninguém consegue entrar.
4. **Supabase > Authentication > Rate Limits:** reduza "sign-ups and sign-ins" (padrão 30 a cada 5 min por IP) para 10.
5. **Supabase > Authentication > Sign In / Providers > Email:** senha mínima 10 e exigir letras e números; *Confirm email* ligado; desligue provedores que você não usa.
6. **Supabase > Authentication > URL Configuration:** *Site URL* = `https://appcaixapro.com.br` e, em *Redirect URLs*, só os endereços exatos que o app usa (sem `*`).
7. **Contas:** ligue verificação em duas etapas no GitHub, Netlify, Supabase, Mercado Pago e Cloudflare. No GitHub, proteja a branch `main`.
8. **Segredos no histórico:** rode `git log --all --oneline -- .env.local .env`. Se aparecer algum commit, troque as chaves (a `anon` pode ficar, as demais não).
9. **Cópias de segurança:** confira em Supabase > Database > Backups o que o seu plano oferece; se não houver backup diário, exporte os dados com regularidade.

## Próximas melhorias sugeridas
- Pedir a senha de novo antes de excluir a conta.
- Verificação em duas etapas (TOTP) opcional para o usuário.
- Alertas de erro: olhar os logs do Supabase (Auth e Edge Functions) toda semana no começo.
