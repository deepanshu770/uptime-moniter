/**
 * Obsidian Telemetry Design System Palette
 * Centralized color tokens for Uptime & API Pulse Platform
 * 
 * Sourced directly from Google Stitch Design System (projects/609912680574013281)
 */
export const colors = {
  // Base Canvas & Dark Surfaces
  canvas: '#0B0F17',
  background: '#0F131C',
  surface: {
    DEFAULT: '#0F131C',
    dim: '#0B0F17',
    lowest: '#0A0E16',
    low: '#181C24',
    card: '#181C24',
    container: '#1C2028',
    high: '#262A33',
    highest: '#31353E',
    bright: '#353942',
    border: '#1F2937',
    borderSubdued: '#1F2937',
    borderProminent: '#374151',
  },

  // Primary Accent & Nominal/Healthy State
  primary: {
    DEFAULT: '#4EDEA3',
    light: '#6FFBBE',
    emerald: '#10B981',
    container: '#10B981',
    onPrimary: '#003824',
    onContainer: '#00422B',
    glow: 'rgba(78, 222, 163, 0.35)',
  },

  // Secondary Accent & Degraded/Warning State
  secondary: {
    DEFAULT: '#FFB95F',
    amber: '#F59E0B',
    container: '#EE9800',
    onSecondary: '#472A00',
    onContainer: '#5B3800',
    glow: 'rgba(255, 185, 95, 0.35)',
  },

  // Tertiary / Outage / Critical Error State
  tertiary: {
    DEFAULT: '#FF7A73',
    coral: '#EF4444',
    container: '#FF7A73',
    onTertiary: '#68000A',
    onContainer: '#79000E',
    glow: 'rgba(239, 68, 68, 0.35)',
  },

  // Neutral Text & Icons
  text: {
    primary: '#DFE2EE',
    secondary: '#BBCABF',
    muted: '#86948A',
    disabled: '#525B56',
    inverse: '#0F131C',
  },

  // Semantic Status Mappings
  status: {
    up: '#10B981',
    upGlow: 'rgba(16, 185, 129, 0.4)',
    upBg: 'rgba(16, 185, 129, 0.1)',
    degraded: '#F59E0B',
    degradedGlow: 'rgba(245, 158, 11, 0.4)',
    degradedBg: 'rgba(245, 158, 11, 0.1)',
    down: '#EF4444',
    downGlow: 'rgba(239, 68, 68, 0.4)',
    downBg: 'rgba(239, 68, 68, 0.1)',
    paused: '#86948A',
    pausedBg: 'rgba(134, 148, 138, 0.1)',
  },

  // Timing Breakdown Colors for Charts & Telemetry Chips
  timing: {
    dns: '#60A5FA',
    tcp: '#A78BFA',
    tls: '#F472B6',
    ttfb: '#10B981',
    download: '#FBBF24',
  }
} as const;

export type ColorPalette = typeof colors;
