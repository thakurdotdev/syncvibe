import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants';
import { getAuthHeaders } from '@/lib/auth-client';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15 seconds timeout
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    config.headers.set(await getAuthHeaders());

    // Only set Content-Type to JSON if it's not FormData
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('@user_profile');
    }
    return Promise.reject(error);
  }
);

const useApi = (): AxiosInstance => {
  return api;
};

export default useApi;
