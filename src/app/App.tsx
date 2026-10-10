import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { LegalPage } from '@/pages/LegalPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const DesignSystemPage = import.meta.env.DEV ? lazy(() => import('@/pages/DesignSystemPage')) : null;

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
  );
}
