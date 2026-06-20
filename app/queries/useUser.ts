'use client';

import { getProfile, login } from '@/api/user';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useUserStore } from '@/stores/userStore';
import { useEffect } from 'react';

export const useProfile = () => {
  const setUser = useUserStore((state) => state.setUser);
  const logout = useUserStore((state) => state.logout);

  const query = useQuery({
    queryKey: ['profile'],
    queryFn: () => getProfile(), // Call without token, api will use stored token
    enabled: typeof window !== 'undefined' && !!localStorage.getItem('token'), // Only fetch if token exists
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Handle success and error with useEffect
  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  useEffect(() => {
    if (query.error) {
      const error: any = query.error;
      // Clear user on auth errors
      if (error?.status === 401 || error?.status === 403) {
        logout();
        localStorage.removeItem('token');
      }
    }
  }, [query.error, logout]);

  return query;
};

export const useLogin = () => {
  const setUser = useUserStore((state) => state.setUser);

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: async (data) => {
      localStorage.setItem('token', data.token);

      try {
        const userProfile = await getProfile();
        setUser(userProfile);
      } catch (error) {
        console.error('Failed to fetch profile after login:', error);
      }
    },
  });
};
