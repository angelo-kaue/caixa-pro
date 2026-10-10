import { Link, Navigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Spinner } from '@/components/ui/Spinner';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useAuth } from '@/features/auth/AuthProvider';

/** Destino do link de confirmação de e-mail. */
export function AuthCallbackPage() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-mute" role="status" aria-label="Confirmando">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (session) return <Navigate to="/app" replace />;

  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const failed = Boolean(query.get('error') || hash.get('error'));

  return (
    <AuthLayout
      title={failed ? 'Link inválido ou expirado' : 'E-mail confirmado'}
      footer={<Link to="/entrar" className="font-semibold text-brand hover:underline">Ir para o login</Link>}
    >
      {failed ? (
        <Alert tone="error">O link expirou ou já foi usado. Entre com sua senha ou solicite um novo link de acesso.</Alert>
      ) : (
        <Alert tone="success">
          Se você confirmou seu e-mail, sua conta está ativa. Entre com seu e-mail e sua senha para continuar.
        </Alert>
      )}
    </AuthLayout>
  );
}
