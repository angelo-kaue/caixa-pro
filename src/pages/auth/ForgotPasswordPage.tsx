import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { requestPasswordReset } from '@/features/auth/authService';
import { forgotSchema, type ForgotValues } from '@/features/auth/schemas';

export function ForgotPasswordPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await requestPasswordReset(values.email);
    if (error) setServerError(error);
    else setDone(true);
  });

  const back = (
    <Link to="/entrar" className="font-semibold text-brand hover:underline">
      Voltar ao login
    </Link>
  );

  if (done) {
    return (
      <AuthLayout title="Confira seu e-mail" footer={back}>
        <Alert tone="success">
          Se existir uma conta com esse e-mail, enviamos um link para você criar uma nova senha. O link tem validade
          limitada.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Recuperar senha" subtitle="Informe seu e-mail e enviaremos um link para redefinir a senha." footer={back}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input label="E-mail" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Enviar link
        </Button>
      </form>
    </AuthLayout>
  );
}
