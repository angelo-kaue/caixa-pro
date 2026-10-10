import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth/guards';
import { InstallHint } from '@/features/pwa/InstallHint';
import { AppHomePage } from '@/pages/AppHomePage';
import { LandingPage } from '@/pages/LandingPage';
import { LegalPage } from '@/pages/LegalPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { SignupPage } from '@/pages/auth/SignupPage';

const DesignSystemPage = import.meta.env.DEV ? lazy(() => import('@/pages/DesignSystemPage')) : null;

export function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/entrar" element={<GuestOnly><LoginPage /></GuestOnly>} />
        <Route path="/cadastro" element={<GuestOnly><SignupPage /></GuestOnly>} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/app" element={<RequireAuth><AppHomePage /></RequireAuth>} />
        {DesignSystemPage && (
          <Route
            path="/sistema-de-design"
            element={
              <Suspense fallback={null}>
                <DesignSystemPage />
              </Suspense>
            }
          />
        )}
        <Route path="/termos" element={<LegalPage title="Termos de uso" />} />
        <Route path="/privacidade" element={<LegalPage title="Política de privacidade" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <InstallHint />
    </>
  );
}
