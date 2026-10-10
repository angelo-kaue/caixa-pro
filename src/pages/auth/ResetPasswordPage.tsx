import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/features/auth/AuthProvider';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { updatePassword } from '@/features/auth/authService';
import { resetSchema, type ResetValues } from '@/features/auth/schemas';

export function ResetPasswordPage() {
  const { session, loading, recovery } = useAuth();
  const navigate = useNavigate();
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-mute" role="status" aria-label="Carregando">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // Só permite redefinir quando o usuário chegou por um link de recuperação válido.
  if (!session || !recovery) {
    return (
      <AuthLayout
        title="Link inválido ou expirado"
        footer={<Link to="/esqueci-senha" className="font-semibold text-brand hover:underline">Solicitar novo link</Link>}
      >
        <Alert tone="error">Este link de recuperação não é mais válido. Solicite um novo para continuar.</Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nova senha" subtitle="Escolha uma senha nova para a sua conta.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password?.message}
          {...register('password')}
        />
        <Input label="Confirme a nova senha" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Salvar senha
        </Button>
      </form>
    </AuthLayout>
  );
}
