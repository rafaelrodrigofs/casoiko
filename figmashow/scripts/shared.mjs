/**
 * Helpers compartilhados para rebuild das telas (ícones Material).
 */

import { colors } from './tokens.mjs';

export { colors };

export const W = 390;
export const H = 844;
export const STATUS = 44;
export const BAR = 44;
export const HEADER_H = STATUS + BAR;

/** Nav flutuante (mesmas cores; só solta das bordas). */
export const NAV_MARGIN_X = 16;
export const NAV_MARGIN_BOTTOM = 16;
export const NAV_BAR_H = 64;
/** Topo da barra flutuante. */
export const NAV_Y = H - NAV_MARGIN_BOTTOM - NAV_BAR_H;
/** Espaço total reservado no rodapé. */
export const NAV_H = NAV_MARGIN_BOTTOM + NAV_BAR_H;

/** Nó de texto Material Icons. */
export function matIcon({
  id,
  name,
  icon,
  x,
  y,
  w = 28,
  h = 28,
  size = 22,
  color = '#FFFFFF',
}) {
  return {
    id,
    type: 'text',
    name: name || icon,
    x,
    y,
    w,
    h,
    text: icon,
    icon: true,
    fontSize: size,
    fontWeight: 400,
    color,
    align: 'center',
  };
}

/**
 * Bottom nav flutuante: 5 abas (branco + primary soft blue).
 */
export function bottomNav(active) {
  const tabs = [
    { id: 'casa', label: 'Casa', icon: 'home' },
    { id: 'mercado', label: 'Mercado', icon: 'shopping_cart' },
    { id: 'contas', label: 'Contas', icon: 'receipt_long' },
    { id: 'chat', label: 'Chat', icon: 'chat_bubble' },
    { id: 'perfil', label: 'Perfil', icon: 'person' },
  ];

  const barX = NAV_MARGIN_X;
  const barW = W - NAV_MARGIN_X * 2;
  const barY = NAV_Y;
  const slotW = barW / tabs.length;

  const pillR = NAV_BAR_H / 2;

  const kids = [
    {
      id: 'nav_shadow',
      type: 'rect',
      name: 'Sombra',
      x: barX + 2,
      y: barY + 4,
      w: barW,
      h: NAV_BAR_H,
      fill: 'rgba(37,99,235,0.12)',
      cornerRadius: pillR,
      opacity: 1,
    },
    {
      id: 'nav_bg',
      type: 'rect',
      name: 'Nav fundo',
      x: barX,
      y: barY,
      w: barW,
      h: NAV_BAR_H,
      fill: colors.surface,
      cornerRadius: pillR,
      opacity: 1,
      stroke: 'rgba(59,130,246,0.12)',
      strokeWidth: 1,
    },
  ];

  tabs.forEach((tab, i) => {
    const selected = tab.id === active;
    const x = barX + i * slotW;
    const indicatorW = Math.min(64, slotW - 4);
    const indicatorH = NAV_BAR_H - 10;
    const indicatorX = x + (slotW - indicatorW) / 2;
    const indicatorY = barY + 5;

    if (selected) {
      kids.push({
        id: `nav_${tab.id}_pill`,
        type: 'rect',
        name: `Indicador ${tab.label}`,
        x: indicatorX,
        y: indicatorY,
        w: indicatorW,
        h: indicatorH,
        fill: colors.primarySoft,
        cornerRadius: indicatorH / 2,
        opacity: 1,
      });
    }

    kids.push(
      matIcon({
        id: `nav_${tab.id}_icon`,
        name: `Ícone ${tab.label}`,
        icon: tab.icon,
        x,
        y: barY + 10,
        w: slotW,
        h: 24,
        size: 20,
        color: selected ? colors.primary : colors.textSecondary,
      }),
      {
        id: `nav_${tab.id}_label`,
        type: 'text',
        name: tab.label,
        x,
        y: barY + 36,
        w: slotW,
        h: 18,
        text: tab.label,
        fontSize: 9,
        fontWeight: selected ? 700 : 500,
        color: selected ? colors.primary : colors.textSecondary,
        align: 'center',
      },
    );
  });

  return {
    id: `grp_nav_${active}`,
    type: 'group',
    name: 'Bottom nav',
    children: kids,
  };
}
