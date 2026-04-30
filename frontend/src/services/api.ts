import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Superadmin: inject selected org context for data scoping
  const selectedOrgId = localStorage.getItem('selectedOrgId');
  if (selectedOrgId) config.headers['X-Org-Id'] = selectedOrgId;

  return config;
});
