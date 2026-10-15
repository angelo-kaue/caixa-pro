import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { signIn } from '@/features/auth/authService';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const requested = (location.state as { from?: string } | null)?.from;
  // Só aceita destinos internos da área logada.
  const destination = requested && requested.startsWith('/app') ? requested : '/app';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await signIn(values.email, values.password);
    if (error) setServerError(error);
    else navigate(destination, { replace: true });
  });

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse o seu CaixaPro."
      footer={
        <p>
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-brand hover:underline">
            Começar grátis
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input label="E-mail" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Senha" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="text-right">
          <Link to="/esqueci-senha" className="text-sm text-mute hover:text-fg">
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
