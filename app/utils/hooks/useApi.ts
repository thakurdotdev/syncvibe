import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants';

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15 seconds timeout
});

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

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
      await AsyncStorage.multiRemove(['token', '@user_profile']);
    }
    return Promise.reject(error);
  }
);

const useApi = (): AxiosInstance => {
  return api;
};

export default useApi;
