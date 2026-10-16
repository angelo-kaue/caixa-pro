import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { verifyEmailToken } from '@/features/auth/authService';
import { readOtpParams } from '@/features/auth/otp';

/** Destino do link de confirmação de e-mail. */
export function AuthCallbackPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const otp = useMemo(() => readOtpParams(window.location.search, ['email', 'signup']), []);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-mute" role="status" aria-label="Confirmando">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (session) return <Navigate to="/app" replace />;

  // Link novo: o token só é gasto quando a pessoa clica no botão (leitores de e-mail não clicam).
  if (otp) {
    return (
      <AuthLayout title="Confirmar e-mail" subtitle="Falta só um passo para ativar a sua conta." footer={error ? <Link to="/entrar" className="font-semibold text-brand hover:underline">Ir para o login</Link> : undefined}>
        <div className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Button
            size="lg"
            className="w-full"
            loading={verifying}
            onClick={async () => {
              setVerifying(true);
              setError(null);
              const res = await verifyEmailToken(otp.tokenHash, otp.type);
              setVerifying(false);
              if (res.error) setError(res.error);
              else navigate('/app', { replace: true });
            }}
          >
            Confirmar meu e-mail
          </Button>
        </div>
      </AuthLayout>
    );
  }

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
        <Alert tone="success">Se você confirmou seu e-mail, sua conta está ativa. Entre com seu e-mail e sua senha para continuar.</Alert>
      )}
    </AuthLayout>
  );
}
