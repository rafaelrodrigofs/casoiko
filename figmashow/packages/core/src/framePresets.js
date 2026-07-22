/**
 * Presets de Quadro (Frame) estilo Figma.
 * @typedef {{ id: string, name: string, width: number, height: number }} FramePreset
 * @typedef {{ id: string, label: string, presets: FramePreset[] }} FramePresetCategory
 */

/** @type {FramePresetCategory[]} */
export const FRAME_PRESET_CATEGORIES = [
  {
    id: 'phone',
    label: 'Telefone',
    presets: [
      { id: 'iphone-14', name: 'iPhone 14 / 15', width: 393, height: 852 },
      { id: 'iphone-se', name: 'iPhone SE', width: 375, height: 667 },
      { id: 'android', name: 'Android', width: 360, height: 800 },
      { id: 'phone-default', name: 'Mobile', width: 390, height: 844 },
    ],
  },
  {
    id: 'tablet',
    label: 'Tablet',
    presets: [
      { id: 'ipad', name: 'iPad', width: 820, height: 1180 },
      { id: 'ipad-pro-11', name: 'iPad Pro 11"', width: 834, height: 1194 },
      { id: 'ipad-pro-129', name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
    ],
  },
  {
    id: 'desktop',
    label: 'Computador',
    presets: [
      { id: 'desktop', name: 'Desktop', width: 1440, height: 1024 },
      { id: 'macbook', name: 'MacBook', width: 1512, height: 982 },
      { id: 'hd', name: 'HD', width: 1920, height: 1080 },
    ],
  },
  {
    id: 'presentation',
    label: 'Apresentação',
    presets: [
      { id: 'slide-16-9', name: 'Apresentação 16:9', width: 1920, height: 1080 },
      { id: 'slide-4-3', name: 'Apresentação 4:3', width: 1024, height: 768 },
    ],
  },
  {
    id: 'watch',
    label: 'Relógio',
    presets: [
      { id: 'apple-watch', name: 'Apple Watch', width: 184, height: 224 },
    ],
  },
  {
    id: 'paper',
    label: 'Paper',
    presets: [
      { id: 'a4', name: 'A4', width: 794, height: 1123 },
      { id: 'letter', name: 'Letter', width: 816, height: 1056 },
    ],
  },
  {
    id: 'social',
    label: 'Redes sociais',
    presets: [
      { id: 'ig-story', name: 'Story Instagram', width: 1080, height: 1920 },
      { id: 'ig-post', name: 'Post Instagram', width: 1080, height: 1080 },
      { id: 'x-post', name: 'Post X', width: 1200, height: 675 },
    ],
  },
];

/**
 * @param {string} presetId
 * @returns {FramePreset | null}
 */
export function findFramePreset(presetId) {
  if (!presetId) return null;
  for (const cat of FRAME_PRESET_CATEGORIES) {
    const found = cat.presets.find((p) => p.id === presetId);
    if (found) return found;
  }
  return null;
}

/**
 * Lista plana de todos os presets.
 * @returns {FramePreset[]}
 */
export function listFramePresets() {
  return FRAME_PRESET_CATEGORIES.flatMap((c) => c.presets);
}
