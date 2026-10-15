import { Audiences, Features, HowItWorks, MobileApp, SmartEntry } from '@/features/landing/Sections';
import { Faq } from '@/features/landing/Faq';
import { FinalCta } from '@/features/landing/FinalCta';
import { Footer } from '@/features/landing/Footer';
import { Header } from '@/features/landing/Header';
import { Hero } from '@/features/landing/Hero';
import { Pricing } from '@/features/landing/Pricing';

export function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <MobileApp />
        <Audiences />
        <SmartEntry />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
