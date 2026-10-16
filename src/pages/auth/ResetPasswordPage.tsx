import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { updatePassword, verifyEmailToken } from '@/features/auth/authService';
import { readOtpParams } from '@/features/auth/otp';
import { resetSchema, type ResetValues } from '@/features/auth/schemas';

const requestNew = (
  <Link to="/esqueci-senha" className="font-semibold text-brand hover:underline">
    Solicitar novo link
  </Link>
);

export function ResetPasswordPage() {
  const { session, loading, recovery } = useAuth();
  const navigate = useNavigate();
  // Link novo: ?token_hash=...  O token só é gasto quando a pessoa clica em "Continuar".
  const otp = useMemo(() => readOtpParams(window.location.search, ['recovery']), []);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({ resolver: zodResolver(resetSchema), defaultValues: { password: '', confirmPassword: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await updatePassword(values.password);
    if (error) setServerError(error);
    else navigate('/app', { replace: true });
  });

  async function onContinue() {
    if (!otp) return;
    setVerifying(true);
    setVerifyError(null);
    const { error } = await verifyEmailToken(otp.tokenHash, otp.type);
    setVerifying(false);
    if (error) {
      setVerifyError(error);
      return;
    }
    window.history.replaceState(null, '', '/redefinir-senha'); // tira o token do endereço
    setVerified(true);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-mute" role="status" aria-label="Carregando">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (otp && !verified) {
    return (
      <AuthLayout title="Criar nova senha" subtitle="Clique em continuar para confirmar o pedido e escolher a sua nova senha." footer={verifyError ? requestNew : undefined}>
        <div className="space-y-4">
          {verifyError && <Alert tone="error">{verifyError}</Alert>}
          <Button size="lg" className="w-full" loading={verifying} onClick={() => void onContinue()}>
            Continuar
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Só permite redefinir quando o usuário chegou por um link de recuperação válido.
  if (!verified && !(session && recovery)) {
    return (
      <AuthLayout title="Link inválido ou expirado" footer={requestNew}>
        <Alert tone="error">Este link de recuperação não é mais válido. Solicite um novo para continuar.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha nova para a sua conta.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <PasswordInput label="Nova senha" autoComplete="new-password" hint="Mínimo de 8 caracteres, com letras e números." error={errors.password?.message} {...register('password')} />
        <PasswordInput label="Confirme a nova senha" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Salvar senha
        </Button>
      </form>
    </AuthLayout>
  );
}
