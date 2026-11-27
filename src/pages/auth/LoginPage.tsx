import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { signIn } from '@/features/auth/authService';
import { captchaEnabled } from '@/features/auth/captcha';
import { loginSchema, type LoginValues } from '@/features/auth/schemas';
import { loadThrottle, registerFailure, saveThrottle } from '@/features/auth/throttle';
import { Turnstile } from '@/features/auth/Turnstile';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [throttle, setThrottle] = useState(() => loadThrottle());
  const [now, setNow] = useState(() => Date.now());
  const waitLeft = Math.max(0, Math.ceil((throttle.until - now) / 1000));
  const requested = (location.state as { from?: string } | null)?.from;
  // Só aceita destinos internos da área logada.
  const destination = requested && requested.startsWith('/app') ? requested : '/app';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  // Contagem regressiva do bloqueio temporário depois de vários erros seguidos.
  useEffect(() => {
    if (throttle.until <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [throttle.until]);

  const onSubmit = handleSubmit(async (values) => {
    if (waitLeft > 0) return;
    setServerError(null);
    const { error } = await signIn(values.email, values.password, captchaToken ?? undefined);
    setResetSignal((n) => n + 1); // o código da verificação vale para um único envio
    if (error) {
      const next = registerFailure(throttle);
      saveThrottle(next);
      setThrottle(next);
      setNow(Date.now());
      setServerError(error);
    } else {
      saveThrottle({ failures: 0, until: 0 });
      navigate(destination, { replace: true });
    }
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
        {waitLeft > 0 && <Alert tone="error">Muitas tentativas seguidas. Aguarde {waitLeft}s para tentar de novo.</Alert>}
        {serverError && waitLeft === 0 && <Alert tone="error">{serverError}</Alert>}
        <Input label="E-mail" type="email" autoComplete="email" inputMode="email" error={errors.email?.message} {...register('email')} />
        <PasswordInput label="Senha" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
        <div className="text-right">
          <Link to="/esqueci-senha" className="text-sm text-mute hover:text-fg">
            Esqueci minha senha
          </Link>
        </div>
        <Turnstile onToken={setCaptchaToken} resetSignal={resetSignal} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={waitLeft > 0 || (captchaEnabled && !captchaToken)}>
          {waitLeft > 0 ? `Aguarde ${waitLeft}s` : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  );
}
