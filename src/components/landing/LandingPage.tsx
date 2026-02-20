'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Merge, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import bannerLight from '../../../assets/banner_trans_light.png';
import bannerDark from '../../../assets/banner_trans_dark.png';
import { colors, typography } from '@/lib/design-tokens';
import { usePreferencesStore } from '@/stores/preferences-store';
import { HeroCanvas } from './HeroCanvas';
import { NewsletterSignup } from '@/components/NewsletterSignup';

// =============================================================================
// TYPES
// =============================================================================

interface LandingPageProps {
  /** Called when the user clicks any CTA to enter the canvas */
  onEnter: () => void;
}

// =============================================================================
// FEATURE SECTIONS DATA
// =============================================================================

const features = [
  {
    icon: GitBranch,
    headline: 'Branch freely',
    subtext: 'One conversation, infinite directions. Explore every "what if" without losing your original thread.',
  },
  {
    icon: ArrowRight,
    headline: 'Never lose a thread',
    subtext: 'Every path you take is preserved on the canvas. Pick up any conversation right where you left off.',
  },
  {
    icon: Merge,
    headline: 'Merge the best ideas',
    subtext: 'Combine insights from different branches into a single conclusion. Your best thinking, unified.',
  },
];

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: 'easeOut' as const },
};

// =============================================================================
// LANDING PAGE COMPONENT
// =============================================================================

export function LandingPage({ onEnter }: LandingPageProps) {
  // Ensure the user's stored theme (dark/light/system) is applied to the
  // document root — identical to what the canvas does via the preferences store.
  const theme = usePreferencesStore((s) => s.preferences.ui.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // globals.css sets body { overflow: hidden } for the canvas — override it
  // while the landing page is mounted so the page can scroll normally.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Lazy initializer reads matchMedia once on first render (client only)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div style={styles.page}>
      {/* ─── NAV ─── */}
      <nav style={styles.nav}>
        <div style={{
          ...styles.navInner,
          ...(isMobile && { padding: '12px 16px' }),
        }}>
          <Image
            src={theme === 'light' ? bannerLight : bannerDark}
            alt="ProjectLoom"
            style={styles.wordmark}
            priority
          />
          <button
            onClick={onEnter}
            style={styles.navCTA}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            Open Canvas
          </button>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section style={{
        ...styles.hero,
        ...(isMobile && { flexDirection: 'column', height: 'auto', paddingBottom: 40 }),
      }}>
        {/* Left: headline + CTA */}
        <div style={{
          ...styles.heroLeft,
          ...(isMobile && { width: '100%', padding: '48px 24px 40px' }),
        }}>
          <motion.h1
            style={styles.heroTitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            Think in branches,
            <br />
            <span style={{ color: colors.accent.primary }}>not timelines.</span>
          </motion.h1>
          <motion.p
            style={styles.heroSubtitle}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Branch your AI conversations like a Choose Your Own Adventure —
            and never lose a thread.
          </motion.p>
          <motion.button
            onClick={onEnter}
            style={{
              ...styles.heroCTA,
              ...(isMobile && { alignSelf: 'stretch', justifyContent: 'center' }),
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            Open the canvas
            <ArrowRight size={18} style={{ marginLeft: 8 }} />
          </motion.button>
        </div>

        {/* Right: animated canvas — full panel on desktop, banner strip on mobile */}
        <div style={{
          ...styles.heroRight,
          ...(isMobile && {
            width: '100%',
            // Use aspect ratio so the animation strip scales with screen width
            // on phones of all sizes (e.g. 390px wide → ~500px tall)
            aspectRatio: '640 / 760',
            height: 'auto',
            flex: 'none',
            borderLeft: 'none',
            borderTop: `1px solid var(--border-default)`,
          }),
        }}>
          <HeroCanvas vertical={isMobile} />
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{
        ...styles.features,
        ...(isMobile && { padding: '48px 16px', gap: '20px' }),
      }}>
        {features.map((feat, i) => (
          <motion.div
            key={i}
            style={styles.featureCard}
            {...fadeInUp}
            transition={{ ...fadeInUp.transition, delay: i * 0.12 } as const}
          >
            <div style={styles.featureIcon}>
              <feat.icon size={28} strokeWidth={1.5} />
            </div>
            <h3 style={styles.featureHeadline}>{feat.headline}</h3>
            <p style={styles.featureSubtext}>{feat.subtext}</p>
          </motion.div>
        ))}
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{
        ...styles.finalCTA,
        ...(isMobile && { padding: '60px 24px 80px' }),
      }}>
        <motion.div {...fadeInUp} style={{ textAlign: 'center' }}>
          <h2 style={styles.ctaTitle}>Your ideas deserve more than a single thread</h2>
          <p style={styles.ctaSubtext}>
            Open the canvas, start a conversation, and branch wherever your thinking takes you.
          </p>
          <motion.button
            onClick={onEnter}
            style={{
              ...styles.heroCTA,
              ...(isMobile && { width: '100%', justifyContent: 'center' }),
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            Open your canvas
            <ArrowRight size={18} style={{ marginLeft: 8 }} />
          </motion.button>
        </motion.div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={styles.footer}>
        <div style={{ marginBottom: 24 }}>
          <NewsletterSignup />
        </div>
        <span style={styles.footerText}>
          ProjectLoom — BYOK, open canvas, your data stays local.
        </span>
      </footer>
    </div>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles: Record<string, React.CSSProperties> = {
  /* ── Page ── */
  page: {
    width: '100%',
    minHeight: '100vh',
    backgroundColor: colors.bg.primary,
    color: colors.fg.primary,
    fontFamily: typography.fonts.body,
    overflowX: 'hidden',
    overflowY: 'auto',
  },

  /* ── Nav ── */
  nav: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    backgroundColor: 'color-mix(in srgb, var(--bg-primary) 80%, transparent)',
    borderBottom: `1px solid ${colors.border.default}`,
  },

  navInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  wordmark: {
    height: 28,
    width: 'auto',
    display: 'block',
    objectFit: 'contain' as const,
  },

  navCTA: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    fontFamily: typography.fonts.body,
    color: colors.accent.contrast,
    backgroundColor: colors.accent.primary,
    border: 'none',
    borderRadius: '8px',
    padding: '8px 18px',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
  },

  /* ── Hero ── */
  hero: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 60, // nav height
    overflow: 'hidden',
  },

  heroLeft: {
    width: '42%',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 48px 60px 64px',
  },

  heroRight: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderLeft: `1px solid var(--border-default)`,
  },

  heroTitle: {
    fontSize: 'clamp(2rem, 5vw, 3.5rem)',
    fontWeight: typography.weights.bold,
    fontFamily: typography.fonts.heading,
    lineHeight: 1.15,
    margin: 0,
    letterSpacing: '-0.03em',
    color: colors.fg.primary,
  },

  heroSubtitle: {
    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
    color: colors.fg.secondary,
    lineHeight: 1.6,
    marginTop: 20,
    marginBottom: 0,
  },

  heroCTA: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: 32,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    color: colors.accent.contrast,
    backgroundColor: colors.accent.primary,
    border: 'none',
    borderRadius: '10px',
    padding: '14px 28px',
    cursor: 'pointer',
    transition: 'background-color 150ms ease',
    boxShadow: `0 4px 20px var(--accent-muted)`,
  },

  /* ── Features ── */
  features: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '80px 24px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '40px',
  },

  featureCard: {
    padding: '32px',
    borderRadius: '16px',
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
  },

  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: '12px',
    backgroundColor: colors.bg.tertiary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.accent.primary,
    marginBottom: 20,
  },

  featureHeadline: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.heading,
    margin: '0 0 12px',
    color: colors.fg.primary,
  },

  featureSubtext: {
    fontSize: typography.sizes.base,
    color: colors.fg.secondary,
    lineHeight: 1.6,
    margin: 0,
  },

  /* ── Final CTA ── */
  finalCTA: {
    padding: '80px 24px 100px',
    maxWidth: 700,
    margin: '0 auto',
  },

  ctaTitle: {
    fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
    fontWeight: typography.weights.bold,
    fontFamily: typography.fonts.heading,
    lineHeight: 1.2,
    margin: 0,
    letterSpacing: '-0.02em',
    color: colors.fg.primary,
  },

  ctaSubtext: {
    fontSize: typography.sizes.lg,
    color: colors.fg.secondary,
    lineHeight: 1.6,
    marginTop: 16,
    marginBottom: 0,
  },

  /* ── Footer ── */
  footer: {
    borderTop: `1px solid ${colors.border.default}`,
    padding: '24px 32px',
    textAlign: 'center',
  },

  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.fg.tertiary,
  },
};
