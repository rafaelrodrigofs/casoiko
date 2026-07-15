/**
 * Tokens de cor — referência soft blue (Pinterest / health UI).
 */
export const colors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryMid: '#60A5FA',
  primarySoft: 'rgba(59,130,246,0.15)',
  primarySoftBg: 'rgba(59,130,246,0.10)',
  background: '#EEF5FC',
  surface: '#FFFFFF',
  surfaceMuted: '#F0F2F5',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E5E7EB',
  danger: '#C0392B',
  headerGradient:
    'linear-gradient(135deg, #2563EB 0%, #3B82F6 48%, #60A5FA 100%)',
};

/** Substituições legado Casoiko navy → paleta soft blue. */
export const COLOR_REPLACEMENTS = [
  [
    'linear-gradient(135deg, #0F1F35 0%, #1B355A 48%, #2A4A7A 100%)',
    colors.headerGradient,
  ],
  ['#0F1F35', colors.primaryDark],
  ['#1B355A', colors.primary],
  ['#2A4A7A', colors.primaryMid],
  ['#F6F7F9', colors.background],
  ['#1A1D21', colors.text],
  ['rgba(27,53,90,0.15)', colors.primarySoft],
  ['rgba(27,53,90,0.12)', 'rgba(59,130,246,0.12)'],
  ['rgba(27,53,90,0.1)', colors.primarySoftBg],
  ['rgba(27,53,90,0.10)', colors.primarySoftBg],
  ['rgba(27,53,90,0.08)', 'rgba(59,130,246,0.08)'],
  ['rgba(27,53,90,0.2)', 'rgba(59,130,246,0.20)'],
  ['rgba(27,53,90,0.20)', 'rgba(59,130,246,0.20)'],
  ['rgba(27,53,90,0.35)', 'rgba(59,130,246,0.35)'],
  ['rgba(27,53,90,0.7)', 'rgba(59,130,246,0.70)'],
  ['rgba(27,53,90,0.70)', 'rgba(59,130,246,0.70)'],
  ['rgba(15,31,53,0.45)', 'rgba(37,99,235,0.40)'],
];
