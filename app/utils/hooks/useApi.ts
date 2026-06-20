import { useEffect, useMemo } from 'react';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/constants';

const useApi = (): AxiosInstance => {
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: API_URL,
      timeout: 15000, // 15 seconds timeout
    });

    instance.interceptors.request.use(
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

    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await handleLogout();
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, []);

  useEffect(() => {
    return () => {
      api.interceptors.request.clear();
      api.interceptors.response.clear();
    };
  }, [api]);

  return api;
};

const handleLogout = async () => {
  await AsyncStorage.clear();
};

export default useApi;
