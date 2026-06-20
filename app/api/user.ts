import api from '@/lib/api';

export const login = async (email: string, password: string) => {
  const response = await api.post('/api/login', { email, password });
  return response.data;
};

export const getProfile = async (token?: string) => {
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;

  const response = await api.get(`/api/profile`, config);
  return response.data.user;
};
