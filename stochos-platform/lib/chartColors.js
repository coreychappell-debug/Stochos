/**
 * Colorblind-Safe Color Palette (Okabe-Ito Palette)
 * Optimized for users with Deuteranopia, Protanopia, and Tritanopia.
 * 
 * References:
 * - Okabe, M. and Ito, K. (2002) "Color Universal Design (CUD) - How to make
 *   figures and presentations that are friendly to Colorblind people."
 */
export const OkabeItoPalette = {
  orange: '#E69F00',
  skyBlue: '#56B4E9',
  bluishGreen: '#009E73',
  yellow: '#F0E442',
  blue: '#0072B2',
  vermillion: '#D55E00',
  reddishPurple: '#CC79A7',
  black: '#000000',
};

// Recommended sequence for multi-series line, bar, and pie charts
export const ChartSeriesColors = [
  OkabeItoPalette.blue,
  OkabeItoPalette.orange,
  OkabeItoPalette.bluishGreen,
  OkabeItoPalette.skyBlue,
  OkabeItoPalette.vermillion,
  OkabeItoPalette.reddishPurple,
  OkabeItoPalette.yellow,
];

// Dark theme configurations for charts (maps and dashboard canvas lines)
export const DarkThemeChartColors = {
  background: '#1b2838',      // matching var(--card-bg)
  border: '#2d3a4a',          // matching var(--card-border)
  gridLines: 'rgba(255, 255, 255, 0.05)',
  text: '#e0e6ed',            // matching var(--text)
  textSecondary: '#8899aa',   // matching var(--text-secondary)
};

// Light theme configurations for charts
export const LightThemeChartColors = {
  background: '#ffffff',
  border: '#cbd5e1',
  gridLines: 'rgba(0, 0, 0, 0.05)',
  text: '#1e293b',
  textSecondary: '#475569',
};
