'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import bannerLight from '../../../assets/banner_trans_light.png';
import bannerDark from '../../../assets/banner_trans_dark.png';
import { colors, typography } from '@/lib/design-tokens';
import { usePreferencesStore } from '@/stores/preferences-store';
import { NewsletterSignup } from '@/components/NewsletterSignup';

// =============================================================================
// TYPES
// =============================================================================

interface LandingPageProps {
  /** Called when the user clicks any CTA to enter the canvas */
  onEnter: () => void;
}

// =============================================================================
// MEDIA URLS
// =============================================================================

const HERO_VIDEO_URL = '/hero-demo.mp4';
const HERO_VIDEO_POSTER_URL = '/hero-demo-poster.png';
const PODCAST_AUDIO_URL = process.env.NEXT_PUBLIC_PODCAST_AUDIO_URL ?? '/podcast.m4a';
const CANONICAL_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

// =============================================================================
// LANDING PAGE COMPONENT
// =============================================================================

export function LandingPage({ onEnter }: LandingPageProps) {
  // Theme
  const theme = usePreferencesStore((s) => s.preferences.ui.theme);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
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

  // Mobile breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Measure nav height and expose as --nav-height so the hero padding
  // is always exact regardless of zoom level or mobile/desktop nav size.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () =>
      document.documentElement.style.setProperty('--nav-height', `${nav.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // Structured data
  const mediaSchema = useMemo(() => {
    const resolveMediaUrl = (pathOrUrl: string) => {
      if (pathOrUrl.startsWith('http')) return pathOrUrl;
      if (CANONICAL_SITE_ORIGIN) return `${CANONICAL_SITE_ORIGIN}${pathOrUrl}`;
      return pathOrUrl;
    };

    const resolvedVideoUrl = resolveMediaUrl(HERO_VIDEO_URL);
    const resolvedVideoPoster = resolveMediaUrl(HERO_VIDEO_POSTER_URL);
    const resolvedAudioUrl = resolveMediaUrl(PODCAST_AUDIO_URL);

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'VideoObject',
          name: 'ProjectLoom product demo',
          description: 'See branching AI conversations, visual canvas navigation, and merge-based synthesis in ProjectLoom.',
          uploadDate: '2026-02-25',
          duration: 'PT1M11S',
          thumbnailUrl: resolvedVideoPoster,
          contentUrl: resolvedVideoUrl,
        },
        {
          '@type': 'PodcastEpisode',
          name: 'The story behind ProjectLoom',
          description: 'A 20-minute deep dive on why linear chat is limiting and how ProjectLoom enables branching and merging.',
          datePublished: '2026-02-23',
          timeRequired: 'PT20M',
          associatedMedia: {
            '@type': 'MediaObject',
            contentUrl: resolvedAudioUrl,
          },
        },
      ],
    };
  }, []);

  return (
    <div style={styles.page}>
      {mediaSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(mediaSchema) }}
        />
      )}

      {/* ─── NAV ─── */}
      <nav ref={navRef} style={styles.nav}>
        <div style={{
          ...styles.navInner,
          ...(isMobile && { padding: '12px 16px' }),
        }}>
          <Image
            src={mounted && theme === 'light' ? bannerLight : bannerDark}
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
            Try it free
          </button>
        </div>
      </nav>

      {/* ─── HERO: video + tagline + CTA ─── */}
      <section style={styles.hero}>
        {/* Video */}
        <div style={{
          ...styles.videoWrapper,
          ...(isMobile && { borderRadius: 0 }),
        }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={HERO_VIDEO_POSTER_URL}
            style={styles.videoEl}
          >
            <source src={HERO_VIDEO_URL} type="video/mp4" />
          </video>
        </div>

        {/* Tagline + CTA — padded so they breathe inside the full-bleed section */}
        <div style={{
          ...styles.heroTextBlock,
          ...(isMobile && { padding: '28px 16px 48px' }),
        }}>
          <h1 style={{
            ...styles.tagline,
            ...(isMobile && { fontSize: 'clamp(1.5rem, 6vw, 2rem)' }),
          }}>
            Explore every angle.{' '}
            <span style={{ color: colors.accent.primary }}>Lose nothing.</span>
          </h1>

          <button
            onClick={onEnter}
            style={{
              ...styles.heroCTA,
              ...(isMobile && { width: '100%', justifyContent: 'center' }),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            Try it on your real problem
            <ArrowRight size={18} style={{ marginLeft: 8 }} />
          </button>
        </div>
      </section>

      {/* ─── PODCAST ─── */}
      <div style={styles.sectionDivider}>
        <section
          id="podcast"
          style={{
            ...styles.podcastSection,
            ...(isMobile && { padding: '40px 16px 48px' }),
          }}
        >
          <p style={styles.podcastLabel}>NotebookLM Audio Overview · 20 min</p>
          <audio controls style={styles.podcastAudio} preload="metadata">
            <source src={PODCAST_AUDIO_URL} type="audio/mp4" />
          </audio>
        </section>
      </div>

      {/* ─── FINAL CTA ─── */}
      <div style={styles.sectionDivider}>
      <section style={{
        ...styles.finalCTA,
        ...(isMobile && { padding: '48px 20px 64px' }),
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={styles.ctaTitle}>Your conversations deserve more than a scroll bar</h2>
          <p style={styles.ctaSubtext}>
            Try the demo first — no setup, no account, nothing to install.
            Everything runs right here in your browser.
          </p>
          <button
            onClick={onEnter}
            style={{
              ...styles.heroCTA,
              ...(isMobile && { width: '100%', justifyContent: 'center' }),
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
            }}
          >
            Try the interactive demo
            <ArrowRight size={18} style={{ marginLeft: 8 }} />
          </button>
        </div>
      </section>
      </div>

      {/* ─── FOOTER ─── */}
      <footer style={styles.footer}>
        <div style={{ marginBottom: 24 }}>
          <NewsletterSignup />
        </div>
        <span style={styles.footerText}>
          ProjectLoom — Your data stays in your browser. Always.
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
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 'var(--nav-height, 57px)' as unknown as number,
    // No minHeight — content dictates height; no paddingBottom — heroTextBlock owns it
  },

  heroTextBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 24,
    padding: '40px 24px 64px',
    maxWidth: 680,
    width: '100%',
    margin: '0 auto',
  },

  videoWrapper: {
    width: '100%',
    maxHeight: '65vh',
    overflow: 'hidden',
  },

  videoEl: {
    width: '100%',
    height: '100%',
    maxHeight: '65vh',
    display: 'block',
    objectFit: 'cover' as const,
    objectPosition: 'center top',
  },

  tagline: {
    fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
    fontWeight: typography.weights.bold,
    fontFamily: typography.fonts.heading,
    lineHeight: 1.2,
    margin: 0,
    letterSpacing: '-0.03em',
    color: colors.fg.primary,
    textAlign: 'center',
  },

  heroCTA: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
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

  /* ── Section divider (full-width border-top) ── */
  sectionDivider: {
    width: '100%',
    borderTop: `1px solid ${colors.border.default}`,
  },

  /* ── Podcast ── */
  podcastSection: {
    maxWidth: 640,
    margin: '0 auto',
    padding: '48px 24px 56px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 16,
  },

  podcastLabel: {
    fontSize: typography.sizes.sm,
    color: colors.fg.tertiary,
    margin: 0,
    textAlign: 'center' as const,
    fontFamily: typography.fonts.body,
  },

  podcastAudio: {
    width: '100%',
    accentColor: 'var(--accent-primary)',
  },

  /* ── Final CTA ── */
  finalCTA: {
    padding: '64px 24px 80px',
    maxWidth: 680,
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
    marginBottom: 32,
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
