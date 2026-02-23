'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Merge, ArrowRight, Play, Sparkles, Headphones, X } from 'lucide-react';
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
    headline: 'Split any conversation',
    subtext: 'Take a different direction from any message. The original stays — explore both.',
  },
  {
    icon: Sparkles,
    headline: 'See everything at once',
    subtext: 'Every thread lives on a visual canvas. No scrolling, no lost messages.',
  },
  {
    icon: Merge,
    headline: 'Combine the best parts',
    subtext: 'Pull insights from multiple threads into one. The AI sees all of them.',
  },
];

const BANNER_HEIGHT = 44;
const DEMO_VIDEO_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? '/demo.mp4';
const DEMO_VIDEO_POSTER_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_POSTER_URL ?? '/demo-poster.png';
const DEMO_VIDEO_CAPTIONS_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_CAPTIONS_URL ?? '/demo-captions.vtt';
const DEMO_VIDEO_EXTERNAL_URL = process.env.NEXT_PUBLIC_DEMO_VIDEO_EXTERNAL_URL ?? '';
const PODCAST_AUDIO_URL = process.env.NEXT_PUBLIC_PODCAST_AUDIO_URL ?? '/podcast.m4a';
const PODCAST_EXTERNAL_URL = process.env.NEXT_PUBLIC_PODCAST_EXTERNAL_URL ?? '';
const CANONICAL_SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

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
  // mounted starts false so SSR and the initial client paint agree on the same
  // value. Zustand's persist middleware rehydrates synchronously from localStorage
  // on the client, so `theme` can differ between SSR and the first client render,
  // causing a hydration mismatch on the banner <Image>. We defer theme-dependent
  // rendering (the banner src) until after mount.
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

  // Start with false (matches SSR), then sync to real viewport after mount.
  // Using a lazy initializer that reads matchMedia on first client render causes
  // a hydration mismatch because SSR always returns false.
  const videoSectionRef = useRef<HTMLElement>(null);
  const [showBanner, setShowBanner] = useState(true);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const mediaSchema = useMemo(() => {
    const resolveMediaUrl = (pathOrUrl: string) => {
      if (pathOrUrl.startsWith('http')) return pathOrUrl;
      if (CANONICAL_SITE_ORIGIN) return `${CANONICAL_SITE_ORIGIN}${pathOrUrl}`;
      return pathOrUrl;
    };

    const resolvedVideoUrl = resolveMediaUrl(DEMO_VIDEO_URL);
    const resolvedVideoPoster = resolveMediaUrl(DEMO_VIDEO_POSTER_URL);
    const resolvedAudioUrl = resolveMediaUrl(PODCAST_AUDIO_URL);

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'VideoObject',
          name: 'ProjectLoom product demo',
          description: 'See branching AI conversations, visual canvas navigation, and merge-based synthesis in ProjectLoom.',
          uploadDate: '2026-02-23',
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

      {/* ─── ANNOUNCEMENT BAR ─── */}
      {showBanner && (
        <div style={styles.announcementBar}>
          <a
            href="#podcast"
            style={styles.announcementLink}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('podcast')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <Headphones size={14} style={{ marginRight: 8, flexShrink: 0 }} />
            <span>Listen: The full story behind ProjectLoom</span>
            <span style={styles.announcementPill}>20 min</span>
            <ArrowRight size={13} style={{ marginLeft: 6, flexShrink: 0 }} />
          </a>
          <button
            style={styles.announcementDismiss}
            onClick={() => setShowBanner(false)}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── NAV ─── */}
      <nav style={{ ...styles.nav, top: showBanner ? BANNER_HEIGHT : 0, transition: 'top 200ms ease' }}>
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

      {/* ─── HERO SECTION ─── */}
      <section style={{
        ...styles.hero,
        paddingTop: 60 + (showBanner ? BANNER_HEIGHT : 0),
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
            Explore every angle.
            <br />
            <span style={{ color: colors.accent.primary }}>Never start over.</span>
          </motion.h1>
          <motion.p
            style={styles.heroSubtitle}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            Split any AI conversation into different directions, explore them side by side,
            and combine the best parts — all on one visual canvas.
          </motion.p>
          <motion.div
            style={{
              ...styles.heroCTARow,
              ...(isMobile && { flexDirection: 'column', alignItems: 'stretch' }),
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
          >
            <motion.button
              onClick={onEnter}
              style={{
                ...styles.heroCTA,
                ...(isMobile && { justifyContent: 'center' }),
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
              Try it now
              <ArrowRight size={18} style={{ marginLeft: 8 }} />
            </motion.button>
            <motion.button
              onClick={() => videoSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              style={{
                ...styles.heroSecondaryCTA,
                ...(isMobile && { justifyContent: 'center' }),
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.color = 'var(--accent-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.color = 'var(--fg-primary)';
              }}
            >
              <Play size={16} style={{ marginRight: 8 }} />
              Watch the demo
            </motion.button>
          </motion.div>
        </div>

        {/* Right: animated canvas — full panel on desktop, banner strip on mobile */}
        <div style={{
          ...styles.heroRight,
          ...(isMobile && {
            width: '100%',
            // Use aspect ratio so the animation strip scales with screen width
            // on phones of all sizes (e.g. 390px wide → ~500px tall)
            aspectRatio: '640 / 600',
            height: 'auto',
            flex: 'none',
            borderLeft: 'none',
            borderTop: `1px solid var(--border-default)`,
          }),
        }}>
          <HeroCanvas vertical={isMobile} />
        </div>
      </section>

      {/* ─── VIDEO SECTION ─── */}
      <section
        ref={videoSectionRef}
        id="demo-video"
        style={{
          ...styles.videoSection,
          ...(isMobile && { padding: '48px 16px 56px' }),
        }}
      >
        <motion.div {...fadeInUp} style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={styles.videoEyebrow}>See it in action</p>
          <h2 style={styles.videoTitle}>From one question to a complete canvas</h2>
        </motion.div>
        <motion.div
          {...fadeInUp}
          transition={{ ...fadeInUp.transition, delay: 0.15 } as const}
          style={styles.videoWrapper}
        >
          <video
            controls
            playsInline
            preload="metadata"
            poster={DEMO_VIDEO_POSTER_URL}
            style={styles.videoEl}
          >
            <source src={DEMO_VIDEO_URL} type="video/mp4" />
            <track kind="captions" src={DEMO_VIDEO_CAPTIONS_URL} srcLang="en" label="English" />
            Your browser does not support HTML5 video.{' '}
            <a href={DEMO_VIDEO_URL} style={styles.inlineMediaLink}>Open the demo video</a>.
          </video>
        </motion.div>
        <p style={styles.mediaHelperText}>
          Prefer another player?{' '}
          <a
            href={DEMO_VIDEO_EXTERNAL_URL || DEMO_VIDEO_URL}
            style={styles.inlineMediaLink}
            target={DEMO_VIDEO_EXTERNAL_URL ? '_blank' : undefined}
            rel={DEMO_VIDEO_EXTERNAL_URL ? 'noopener noreferrer' : undefined}
          >
            Open video directly
          </a>
          .
        </p>
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

      {/* ─── PODCAST ─── */}
      <section
        id="podcast"
        style={{
          ...styles.podcastSection,
          ...(isMobile && { padding: '48px 16px 56px' }),
        }}
      >
        <motion.div
          {...fadeInUp}
          style={{
            ...styles.podcastCard,
            ...(isMobile && { flexDirection: 'column', gap: 24 }),
          }}
        >
          <div style={styles.podcastIconWrap}>
            <Headphones size={32} strokeWidth={1.5} color='var(--accent-primary)' />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={styles.podcastEyebrow}>AI-generated overview · 20 min</p>
            <h3 style={styles.podcastTitle}>The story behind ProjectLoom</h3>
            <p style={styles.podcastDesc}>
              Why linear chat is broken, how the canvas changes the way you think,
              and where this is going.
            </p>
            <audio controls style={styles.podcastAudio} preload="metadata">
              <source src={PODCAST_AUDIO_URL} type="audio/mp4" />
              Your browser does not support HTML5 audio.{' '}
              <a href={PODCAST_AUDIO_URL} style={styles.inlineMediaLink}>Open the podcast audio</a>.
            </audio>
            <p style={styles.mediaHelperText}>
              Prefer Spotify/YouTube style playback?{' '}
              <a
                href={PODCAST_EXTERNAL_URL || PODCAST_AUDIO_URL}
                style={styles.inlineMediaLink}
                target={PODCAST_EXTERNAL_URL ? '_blank' : undefined}
                rel={PODCAST_EXTERNAL_URL ? 'noopener noreferrer' : undefined}
              >
                Open podcast directly
              </a>
              .
            </p>
          </div>
        </motion.div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section style={{
        ...styles.finalCTA,
        ...(isMobile && { padding: '60px 24px 80px' }),
      }}>
        <motion.div {...fadeInUp} style={{ textAlign: 'center' }}>
          <h2 style={styles.ctaTitle}>Your conversations deserve more than a scroll bar</h2>
          <p style={styles.ctaSubtext}>
            Try the demo first — no setup, no account, nothing to install.
            Everything runs right here in your browser.
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
            Try the interactive demo
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

  heroCTARow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    marginTop: 32,
    alignItems: 'center',
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

  heroSecondaryCTA: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    fontFamily: typography.fonts.body,
    color: colors.fg.primary,
    backgroundColor: 'transparent',
    border: `1px solid var(--border-default)`,
    borderRadius: '10px',
    padding: '13px 24px',
    cursor: 'pointer',
    transition: 'border-color 150ms ease, color 150ms ease',
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
    marginBottom: 32,
  },

  /* ── Video ── */
  videoSection: {
    width: '100%',
    backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 60%, var(--bg-primary))',
    borderTop: `1px solid ${colors.border.default}`,
    borderBottom: `1px solid ${colors.border.default}`,
    padding: '80px 24px 96px',
  },

  videoEyebrow: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    color: colors.accent.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    margin: '0 0 12px',
  },

  videoTitle: {
    fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
    fontWeight: typography.weights.bold,
    fontFamily: typography.fonts.heading,
    lineHeight: 1.2,
    letterSpacing: '-0.02em',
    color: colors.fg.primary,
    margin: 0,
  },

  videoWrapper: {
    maxWidth: 1100,
    margin: '0 auto',
    borderRadius: '16px',
    overflow: 'hidden',
    border: `1px solid ${colors.border.default}`,
    backgroundColor: '#0a0a0a',
    boxShadow: '0 32px 100px rgba(0,0,0,0.4)',
  },

  videoEl: {
    width: '100%',
    height: 'auto',
    display: 'block',
  },

  /* ── Announcement bar ── */
  announcementBar: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    zIndex: 101,
    backgroundColor: 'var(--accent-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px',
    gap: 12,
  },

  announcementLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--accent-contrast)',
    textDecoration: 'none',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    fontFamily: typography.fonts.body,
    flex: 1,
    justifyContent: 'center' as const,
    minWidth: 0,
  },

  announcementPill: {
    fontSize: '0.65rem',
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'var(--accent-contrast)',
    borderRadius: 100,
    padding: '2px 8px',
    marginLeft: 4,
    flexShrink: 0,
  },

  announcementDismiss: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--accent-contrast)',
    opacity: 0.7,
    display: 'flex',
    alignItems: 'center',
    padding: 4,
    flexShrink: 0,
  },

  /* ── Podcast ── */
  podcastSection: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '64px 24px 80px',
  },

  podcastCard: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: 32,
    alignItems: 'flex-start',
    padding: '40px 48px',
    borderRadius: '16px',
    backgroundColor: colors.bg.secondary,
    border: `1px solid ${colors.border.default}`,
  },

  podcastIconWrap: {
    width: 72,
    height: 72,
    borderRadius: '16px',
    backgroundColor: 'var(--accent-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  podcastEyebrow: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    fontFamily: typography.fonts.body,
    color: colors.accent.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    margin: '0 0 8px',
  },

  podcastTitle: {
    fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
    fontWeight: typography.weights.bold,
    fontFamily: typography.fonts.heading,
    color: colors.fg.primary,
    margin: '0 0 10px',
    letterSpacing: '-0.015em',
  },

  podcastDesc: {
    fontSize: typography.sizes.base,
    color: colors.fg.secondary,
    lineHeight: 1.6,
    margin: '0 0 24px',
  },

  podcastAudio: {
    width: '100%',
    accentColor: 'var(--accent-primary)',
  },

  mediaHelperText: {
    fontSize: typography.sizes.sm,
    color: colors.fg.tertiary,
    lineHeight: 1.5,
    margin: '16px auto 0',
    maxWidth: 1100,
  },

  inlineMediaLink: {
    color: colors.accent.primary,
    textDecorationColor: colors.accent.primary,
    textUnderlineOffset: '2px',
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
