import axios, { AxiosInstance } from 'axios';

export const getProfileCloudinaryUrl = (originalUrl: string | undefined): string => {
  if (!originalUrl?.includes('cloudinary.com')) return originalUrl || '';

  const [baseUrl, imageParams] = originalUrl.split('upload/');
  if (!baseUrl || !imageParams) return originalUrl;

  const optimizationParams = 'c_thumb,h_200,w_200/r_max/f_auto/';

  return `${baseUrl}upload/${optimizationParams}${imageParams}`;
};

interface OptimizationOptions {
  thumbnail?: boolean;
  width?: number;
  height?: number;
}

export const getOptimizedImageUrl = (
  originalUrl: string | undefined,
  options?: OptimizationOptions
): string => {
  if (!originalUrl?.includes('cloudinary.com')) return originalUrl || '';

  const [baseUrl, imageParams] = originalUrl.split('upload/');
  if (!baseUrl || !imageParams) return originalUrl;

  const optimizationParams: string[] = [];

  optimizationParams.push('q_auto', 'f_auto');

  if (options?.thumbnail) {
    if (options.width && options.height) {
      optimizationParams.push('c_fit', `w_${options.width}`, `h_${options.height}`);
    } else if (options.width) {
      optimizationParams.push('c_scale', `w_${options.width}`);
    } else if (options.height) {
      optimizationParams.push('c_scale', `h_${options.height}`);
    } else {
      optimizationParams.push('c_scale', 'w_600');
    }
  }

  const transformations = optimizationParams.join(',');

  return `${baseUrl}upload/${transformations}/${imageParams}`;
};

export const uploadToCloudinary = async (
  api: AxiosInstance,
  fileUri: string,
  fileName: string = 'image.jpg',
  mimeType: string = 'image/jpeg',
  intent: string = 'profile'
): Promise<string> => {
  const sigResponse = await api.get('/api/upload/signature', {
    params: { intent, resourceType: 'image' },
  });
  const signatureData = sigResponse.data;

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: mimeType,
    name: fileName,
  } as any);
  formData.append('api_key', signatureData.apiKey);
  formData.append('timestamp', signatureData.timestamp.toString());
  formData.append('signature', signatureData.signature);
  formData.append('folder', signatureData.folder);
  formData.append('public_id', signatureData.publicId);
  formData.append('allowed_formats', signatureData.allowedFormats.join(','));
  formData.append('overwrite', 'false');

  const uploadUrl = `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`;
  const response = await axios.post(uploadUrl, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data.secure_url;
};
