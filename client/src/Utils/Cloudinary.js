export const getProfileCloudinaryUrl = (originalUrl) => {
  if (!originalUrl?.includes('cloudinary.com')) return originalUrl;

  // Split the URL at 'upload/'
  const [baseUrl, imageParams] = originalUrl.split('upload/');
  if (!baseUrl || !imageParams) return originalUrl;

  // Add optimization parameters
  const optimizationParams = 'c_thumb,h_200,w_200/r_max/f_auto/';

  return `${baseUrl}upload/${optimizationParams}${imageParams}`;
};

// Helper function to transform Cloudinary URLs
export const getOptimizedImageUrl = (originalUrl, options) => {
  // Check if it's a Cloudinary URL
  if (!originalUrl?.includes('cloudinary.com')) return originalUrl;

  // Split the URL at 'upload/'
  const [baseUrl, imageParams] = originalUrl.split('upload/');
  if (!baseUrl || !imageParams) return originalUrl;

  // Build optimization parameters
  const optimizationParams = [];

  // Always add quality and format auto
  optimizationParams.push('q_auto', 'f_auto');

  if (options?.thumbnail) {
    if (options.width && options.height) {
      // Use fit mode to maintain aspect ratio within bounds
      optimizationParams.push('c_fit', `w_${options.width}`, `h_${options.height}`);
    } else if (options.width) {
      // Scale by width only
      optimizationParams.push('c_scale', `w_${options.width}`);
    } else if (options.height) {
      // Scale by height only
      optimizationParams.push('c_scale', `h_${options.height}`);
    } else {
      // Default width if no dimensions provided
      optimizationParams.push('c_scale', 'w_600');
    }
  }

  // Join parameters with commas
  const transformations = optimizationParams.join(',');

  // Construct the final URL
  return `${baseUrl}upload/${transformations}/${imageParams}`;
};
