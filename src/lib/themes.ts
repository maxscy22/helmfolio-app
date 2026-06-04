import type { CSSProperties } from 'react';

export type ThemePreset = {
  id: string;
  name: string;
  description: string;
  className: string;
  style: CSSProperties;
  previewClassName: string;
};

export const themePresets: ThemePreset[] = [
  // ---- DEEP: dramatic, low-light, focused ----
  {
    id: 'command',
    name: 'Command Center',
    description: 'Deep cyan-on-slate trading desk. Calm, focused, easy on the eyes for long sessions.',
    className: 'text-slate-100 font-sans text-base',
    previewClassName: 'from-cyan-400 via-slate-900 to-indigo-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#155e75,transparent 30%),radial-gradient(circle at top right,#1e1b4b,transparent 26%),linear-gradient(135deg,#020617,#0f172a 52%,#020617)',
      '--dashboard-panel': 'rgba(2, 6, 23, 0.75)',
      '--dashboard-card': 'rgba(255, 255, 255, 0.06)',
      '--dashboard-section': 'rgba(2, 6, 23, 0.60)',
      '--dashboard-muted': '#94a3b8',
      '--dashboard-accent': '#22d3ee',
    } as CSSProperties,
  },
  {
    id: 'royal',
    name: 'Royal Indigo',
    description: 'Institutional midnight navy with restrained indigo signal accents. Quietly premium.',
    className: 'text-indigo-50 font-sans text-base',
    previewClassName: 'from-indigo-400 via-slate-950 to-violet-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,rgba(129,140,248,0.28),transparent 26%),radial-gradient(circle at bottom right,rgba(76,29,149,0.24),transparent 32%),linear-gradient(135deg,#050816,#111827 48%,#1e1b4b)',
      '--dashboard-panel': 'rgba(15, 23, 42, 0.84)',
      '--dashboard-card': 'rgba(129, 140, 248, 0.08)',
      '--dashboard-section': 'rgba(30, 41, 59, 0.68)',
      '--dashboard-muted': '#c7d2fe',
      '--dashboard-accent': '#818cf8',
    } as CSSProperties,
  },
  {
    id: 'graphite',
    name: 'Graphite Pro',
    description: 'Pure monochrome carbon terminal with brushed-platinum highlights. No color cast — all signal.',
    className: 'text-zinc-100 font-sans text-base',
    previewClassName: 'from-zinc-300 via-neutral-900 to-black',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#71717a,transparent 20%),radial-gradient(circle at bottom right,#3f3f46,transparent 30%),linear-gradient(135deg,#050505,#171717 50%,#000000)',
      '--dashboard-panel': 'rgba(10, 10, 11, 0.86)',
      '--dashboard-card': 'rgba(244, 244, 245, 0.07)',
      '--dashboard-section': 'rgba(24, 24, 27, 0.70)',
      '--dashboard-muted': '#a1a1aa',
      '--dashboard-accent': '#e4e4e7',
    } as CSSProperties,
  },
  {
    id: 'crimson-reserve',
    name: 'Crimson Reserve',
    description: 'Deep oxblood wine-cellar dark warmed by a refined crimson glow. Dramatic, low-light, and bold.',
    className: 'text-rose-50 font-sans text-base',
    previewClassName: 'from-rose-400 via-rose-950 to-black',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top right,rgba(244,63,94,0.22),transparent 34%),radial-gradient(circle at bottom left,rgba(127,29,29,0.20),transparent 42%),linear-gradient(140deg,#080203,#28080f 55%,#0a0204)',
      '--dashboard-panel': 'rgba(22, 6, 10, 0.88)',
      '--dashboard-card': 'rgba(244, 63, 94, 0.07)',
      '--dashboard-section': 'rgba(45, 12, 19, 0.66)',
      '--dashboard-muted': '#fbc4cd',
      '--dashboard-accent': '#f43f5e',
    } as CSSProperties,
  },
  // ---- RICH: saturated mid-tone, characterful ----
  {
    id: 'emerald',
    name: 'Emerald Vault',
    description: 'Private-banking jade with a soft mint glow. Steady, capital-protection calm.',
    className: 'text-emerald-50 font-sans text-base',
    previewClassName: 'from-emerald-300 via-emerald-800 to-slate-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#6ee7b7,transparent 22%),radial-gradient(circle at top right,#10b981,transparent 28%),radial-gradient(circle at bottom right,#064e3b,transparent 32%),linear-gradient(135deg,#01130d,#064e3b 50%,#020617)',
      '--dashboard-panel': 'rgba(2, 44, 34, 0.82)',
      '--dashboard-card': 'rgba(110, 231, 183, 0.09)',
      '--dashboard-section': 'rgba(6, 78, 59, 0.66)',
      '--dashboard-muted': '#a7f3d0',
      '--dashboard-accent': '#34d399',
    } as CSSProperties,
  },
  {
    id: 'mocha',
    name: 'Mocha Mousse',
    description: 'Cozy warm-neutral desk in caramel and bronze over deep espresso. Inviting and tasteful.',
    className: 'text-stone-50 font-sans text-base',
    previewClassName: 'from-amber-200 via-stone-700 to-stone-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,rgba(214,170,120,0.30),transparent 34%),radial-gradient(circle at bottom right,rgba(130,100,78,0.24),transparent 38%),linear-gradient(135deg,#1a1310,#2c211a 52%,#15100c)',
      '--dashboard-panel': 'rgba(30, 22, 17, 0.82)',
      '--dashboard-card': 'rgba(214, 170, 120, 0.09)',
      '--dashboard-section': 'rgba(44, 33, 26, 0.66)',
      '--dashboard-muted': '#e7d3c0',
      '--dashboard-accent': '#d8a778',
    } as CSSProperties,
  },
  // ---- LUMINOUS: bright, airy, vivid glass ----
  {
    id: 'ocean',
    name: 'Ocean Glass',
    description: 'Bright sapphire glass cockpit with deep ocean blues and crisp, airy clarity.',
    className: 'text-sky-50 font-sans text-base',
    previewClassName: 'from-sky-300 via-blue-700 to-blue-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#7dd3fc,transparent 20%),radial-gradient(circle at top right,#3b82f6,transparent 28%),radial-gradient(circle at bottom right,#1e40af,transparent 32%),linear-gradient(135deg,#031634,#0c4a9e 50%,#04132e)',
      '--dashboard-panel': 'rgba(10, 38, 79, 0.74)',
      '--dashboard-card': 'rgba(147, 197, 253, 0.12)',
      '--dashboard-section': 'rgba(15, 56, 116, 0.62)',
      '--dashboard-muted': '#bfdbfe',
      '--dashboard-accent': '#60a5fa',
    } as CSSProperties,
  },
  {
    id: 'arctic-aurora',
    name: 'Arctic Aurora',
    description: 'Limited edition polar aurora glow with icy mint and violet depth.',
    className: 'text-teal-50 font-sans text-[18px]',
    previewClassName: 'from-teal-200 via-indigo-950 to-violet-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#5eead4,transparent 26%),radial-gradient(circle at top right,#a78bfa,transparent 24%),radial-gradient(circle at bottom left,#0f766e,transparent 26%),linear-gradient(135deg,#031617,#172554 52%,#1e1b4b)',
      '--dashboard-panel': 'rgba(15, 23, 42, 0.76)',
      '--dashboard-card': 'rgba(94, 234, 212, 0.11)',
      '--dashboard-section': 'rgba(30, 41, 59, 0.62)',
      '--dashboard-muted': '#99f6e4',
      '--dashboard-accent': '#5eead4',
    } as CSSProperties,
  },
  {
    id: 'orchid-bloom',
    name: 'Orchid Bloom',
    description: 'Vivid magenta-and-rose glass with a luminous, modern bloom. Bold but readable.',
    className: 'text-pink-50 font-sans text-base',
    previewClassName: 'from-fuchsia-300 via-pink-600 to-rose-900',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#f0abfc,transparent 20%),radial-gradient(circle at top right,#ec4899,transparent 28%),radial-gradient(circle at bottom right,#9d174d,transparent 32%),linear-gradient(135deg,#220318,#7a1145 50%,#2a0a24)',
      '--dashboard-panel': 'rgba(46, 8, 33, 0.80)',
      '--dashboard-card': 'rgba(244, 114, 182, 0.11)',
      '--dashboard-section': 'rgba(96, 18, 64, 0.60)',
      '--dashboard-muted': '#fbcfe8',
      '--dashboard-accent': '#f472b6',
    } as CSSProperties,
  },
  {
    id: 'solar-flare',
    name: 'Solar Flare',
    description: 'Warm sunrise glass in amber and tangerine over a glowing ember base. Bright and energizing.',
    className: 'text-orange-50 font-sans text-base',
    previewClassName: 'from-amber-300 via-orange-600 to-rose-900',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#fdba74,transparent 22%),radial-gradient(circle at top right,#f97316,transparent 28%),radial-gradient(circle at bottom right,#9a3412,transparent 32%),linear-gradient(135deg,#1c0d05,#7c2d12 50%,#170a06)',
      '--dashboard-panel': 'rgba(38, 18, 9, 0.80)',
      '--dashboard-card': 'rgba(251, 146, 60, 0.10)',
      '--dashboard-section': 'rgba(82, 35, 16, 0.64)',
      '--dashboard-muted': '#fed7aa',
      '--dashboard-accent': '#fb923c',
    } as CSSProperties,
  },
];
