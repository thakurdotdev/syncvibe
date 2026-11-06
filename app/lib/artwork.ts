const SAAVN_SIZE = /-\d+x\d+\.(jpe?g|png|webp)/i;

/**
 * Source for a blurred artwork backdrop. Android blurs on the CPU, pixel by pixel, so blurring a
 * 500px cover is slow and pointless: the 150px one looks the same with the radius scaled down.
 * Covers that don't come in sizes keep the radius they were given.
 */
export const blurredArt = (uri: string | undefined, blurRadius: number) => {
  if (!uri || !SAAVN_SIZE.test(uri)) return { source: { uri }, blurRadius, fadeDuration: 0 };
  return {
    source: { uri: uri.replace(SAAVN_SIZE, '-150x150.$1') },
    blurRadius: Math.round(blurRadius * 0.3),
    fadeDuration: 0,
  };
};
