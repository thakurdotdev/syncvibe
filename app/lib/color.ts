/**
 * A theme colour (`#RRGGBB`) at some opacity, as `rgba()`. Gradients get their stops this way:
 * Android's gradient view doesn't take `#RRGGBBAA` reliably, and a stop it drops leaves the
 * gradient undrawn (a hard edge where a fade should be). Other colour strings pass through.
 */
export const alpha = (color: string, opacity: number) => {
  const hex = /^#([0-9a-f]{6})/i.exec(color)?.[1];
  if (!hex) return color;
  const n = parseInt(hex, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${opacity})`;
};
