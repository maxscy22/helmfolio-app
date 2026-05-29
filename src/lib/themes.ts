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
  {
    id: 'command',
    name: 'Command Center',
    description: 'Current cyan and slate trading desk theme.',
    className: 'text-slate-100 font-sans text-base',
    previewClassName: 'from-cyan-500 via-slate-900 to-indigo-950',
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
    id: 'emerald',
    name: 'Emerald Vault',
    description: 'Upgraded private-banking green with jade glow and capital-protection calm.',
    className: 'text-emerald-50 font-serif text-[17px]',
    previewClassName: 'from-lime-200 via-emerald-950 to-slate-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#bef264,transparent 20%),radial-gradient(circle at top right,#10b981,transparent 28%),radial-gradient(circle at bottom right,#064e3b,transparent 32%),linear-gradient(135deg,#01130d,#064e3b 50%,#020617)',
      '--dashboard-panel': 'rgba(2, 44, 34, 0.82)',
      '--dashboard-card': 'rgba(190, 242, 100, 0.10)',
      '--dashboard-section': 'rgba(6, 78, 59, 0.66)',
      '--dashboard-muted': '#bbf7d0',
      '--dashboard-accent': '#bef264',
    } as CSSProperties,
  },
  {
    id: 'royal',
    name: 'Royal Indigo',
    description: 'Upgraded royal-violet trading salon with velvet depth and macro-review polish.',
    className: 'text-indigo-50 font-sans text-[17px]',
    previewClassName: 'from-violet-300 via-indigo-950 to-fuchsia-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#c4b5fd,transparent 18%),radial-gradient(circle at top right,#8b5cf6,transparent 28%),radial-gradient(circle at bottom left,#4f46e5,transparent 30%),linear-gradient(135deg,#111033,#312e81 50%,#1e1b4b)',
      '--dashboard-panel': 'rgba(30, 27, 75, 0.82)',
      '--dashboard-card': 'rgba(196, 181, 253, 0.11)',
      '--dashboard-section': 'rgba(49, 46, 129, 0.66)',
      '--dashboard-muted': '#ddd6fe',
      '--dashboard-accent': '#c4b5fd',
    } as CSSProperties,
  },
  {
    id: 'graphite',
    name: 'Graphite Pro',
    description: 'Upgraded carbon-fiber institutional terminal with platinum highlights.',
    className: 'text-zinc-100 font-mono text-[15px]',
    previewClassName: 'from-zinc-200 via-neutral-950 to-black',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#d4d4d8,transparent 16%),radial-gradient(circle at bottom right,#3f3f46,transparent 28%),linear-gradient(135deg,#030303,#18181b 48%,#000000)',
      '--dashboard-panel': 'rgba(9, 9, 11, 0.86)',
      '--dashboard-card': 'rgba(228, 228, 231, 0.09)',
      '--dashboard-section': 'rgba(24, 24, 27, 0.70)',
      '--dashboard-muted': '#d4d4d8',
      '--dashboard-accent': '#f4f4f5',
    } as CSSProperties,
  },
  {
    id: 'sunrise',
    name: 'Sunrise Gold',
    description: 'Upgraded champagne sunrise with warm gold, copper, and morning-review optimism.',
    className: 'text-amber-50 font-serif text-[17px] [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]',
    previewClassName: 'from-yellow-200 via-orange-800 to-rose-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,rgba(253,230,138,0.55),transparent 32%),radial-gradient(circle at top right,rgba(251,146,60,0.5),transparent 36%),radial-gradient(circle at bottom right,rgba(190,18,60,0.45),transparent 36%),linear-gradient(135deg,#160c04,#3a1808 48%,#020617)',
      '--dashboard-panel': 'rgba(28, 14, 4, 0.94)',
      '--dashboard-card': 'rgba(120, 53, 15, 0.32)',
      '--dashboard-section': 'rgba(58, 24, 8, 0.86)',
      '--dashboard-muted': '#fde68a',
      '--dashboard-accent': '#fde68a',
    } as CSSProperties,
  },
  {
    id: 'rose',
    name: 'Rose Risk',
    description: 'Upgraded ruby command room for decisive risk reviews and high-alert sessions.',
    className: 'text-rose-50 font-sans text-[17px]',
    previewClassName: 'from-pink-300 via-rose-950 to-red-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#f9a8d4,transparent 18%),radial-gradient(circle at top right,#e11d48,transparent 28%),radial-gradient(circle at bottom right,#7f1d1d,transparent 30%),linear-gradient(135deg,#1f0710,#881337 48%,#020617)',
      '--dashboard-panel': 'rgba(76, 5, 25, 0.82)',
      '--dashboard-card': 'rgba(249, 168, 212, 0.11)',
      '--dashboard-section': 'rgba(136, 19, 55, 0.66)',
      '--dashboard-muted': '#fbcfe8',
      '--dashboard-accent': '#f9a8d4',
    } as CSSProperties,
  },
  {
    id: 'ocean',
    name: 'Ocean Glass',
    description: 'Upgraded sapphire glass cockpit with ocean depth and crisp modern clarity.',
    className: 'text-sky-50 font-sans text-[18px]',
    previewClassName: 'from-cyan-200 via-blue-950 to-slate-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#a5f3fc,transparent 18%),radial-gradient(circle at top right,#0ea5e9,transparent 28%),radial-gradient(circle at bottom right,#155e75,transparent 30%),linear-gradient(135deg,#02111f,#075985 50%,#020617)',
      '--dashboard-panel': 'rgba(8, 47, 73, 0.78)',
      '--dashboard-card': 'rgba(165, 243, 252, 0.11)',
      '--dashboard-section': 'rgba(12, 74, 110, 0.64)',
      '--dashboard-muted': '#cffafe',
      '--dashboard-accent': '#67e8f9',
    } as CSSProperties,
  },
  {
    id: 'noir-luxe',
    name: 'Noir Luxe',
    description: 'Limited edition black-gold executive lounge with cinematic contrast.',
    className: 'text-stone-50 font-serif text-[17px]',
    previewClassName: 'from-yellow-200 via-stone-950 to-black',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,#facc15,transparent 18%),radial-gradient(circle at bottom right,#713f12,transparent 28%),linear-gradient(135deg,#050403,#1c1917 48%,#000000)',
      '--dashboard-panel': 'rgba(12, 10, 9, 0.84)',
      '--dashboard-card': 'rgba(250, 204, 21, 0.09)',
      '--dashboard-section': 'rgba(28, 25, 23, 0.68)',
      '--dashboard-muted': '#d6d3d1',
      '--dashboard-accent': '#facc15',
    } as CSSProperties,
  },
  {
    id: 'miami-neon',
    name: 'Miami Neon',
    description: 'Limited edition cyber sunset with magenta, aqua, and nightclub energy.',
    className: 'text-fuchsia-50 font-sans text-[17px] [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]',
    previewClassName: 'from-fuchsia-400 via-purple-950 to-cyan-950',
    style: {
      '--dashboard-bg': 'radial-gradient(circle at top left,rgba(236,72,153,0.55),transparent 38%),radial-gradient(circle at top right,rgba(34,211,238,0.5),transparent 36%),radial-gradient(circle at bottom right,rgba(126,34,206,0.55),transparent 38%),linear-gradient(135deg,#0c0014,#1a1638 50%,#02080f)',
      '--dashboard-panel': 'rgba(15, 10, 38, 0.94)',
      '--dashboard-card': 'rgba(67, 33, 95, 0.42)',
      '--dashboard-section': 'rgba(40, 18, 70, 0.86)',
      '--dashboard-muted': '#f5d0fe',
      '--dashboard-accent': '#22d3ee',
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
];
