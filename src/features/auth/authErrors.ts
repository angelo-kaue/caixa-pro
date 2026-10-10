/** Traduz erros do Supabase Auth para mensagens claras e seguras (sem revelar se um e-mail existe). */
export function mapAuthError(error: unknown): string {
  const e = (error ?? {}) as { code?: string; message?: string; name?: string };
  const message = (e.message ?? '').toLowerCase();

  switch (e.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha incorretos.';
    case 'email_not_confirmed':
      return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Não foi possível criar a conta com esses dados.';
    case 'weak_password':
      return 'Escolha uma senha mais forte: mínimo de 8 caracteres, com letras e números.';
    case 'same_password':
      return 'A nova senha precisa ser diferente da atual.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'signup_disabled':
      return 'Novos cadastros estão temporariamente indisponíveis.';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'session_not_found':
      return 'O link expirou ou já foi usado. Solicite um novo.';
    default:
      break;
  }

  if (e.name === 'AuthRetryableFetchError' || message.includes('failed to fetch') || message.includes('network')) {
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }
  if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.';
  if (message.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

  return 'Algo deu errado. Tente novamente em instantes.';
}
