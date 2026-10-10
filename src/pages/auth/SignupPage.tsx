import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { signUp } from '@/features/auth/authService';
import { signupSchema, type SignupValues } from '@/features/auth/schemas';

export function SignupPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await signUp(values.email, values.password);
    if (result.error) setServerError(result.error);
    else if (result.needsConfirmation) setSentTo(values.email);
    // Sem confirmação exigida: a sessão é criada e GuestOnly redireciona para /app.
  });

  if (sentTo) {
    return (
      <AuthLayout title="Confira seu e-mail" footer={<Link to="/entrar" className="font-semibold text-brand hover:underline">Ir para o login</Link>}>
        <Alert tone="success">
          Se o endereço <strong>{sentTo}</strong> puder ser cadastrado, enviamos um link de confirmação para ele. Abra a
          mensagem e clique no link para ativar sua conta. Verifique também a caixa de spam.
        </Alert>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Comece grátis. Não pedimos cartão de crédito."
      footer={
        <p>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-semibold text-brand hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <Input label="E-mail" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Senha"
          type="password"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password?.message}
          {...register('password')}
        />
        <Input label="Confirme a senha" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Criar conta
        </Button>
        <p className="text-xs text-faint">
          Ao criar a conta, você concorda com os{' '}
          <Link to="/termos" className="underline hover:text-fg">Termos de uso</Link> e a{' '}
          <Link to="/privacidade" className="underline hover:text-fg">Política de privacidade</Link>.
        </p>
      </form>
    </AuthLayout>
  );
}
