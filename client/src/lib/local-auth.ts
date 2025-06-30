import axios from 'axios';
import { queryClient } from '@/lib/queryClient';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends LoginCredentials {
  name?: string;
}

export interface AuthResponse {
  id: number;
  email: string;
  name?: string;
}

/**
 * Local authentication service for handling non-Firebase authentication
 */
export const localAuth = {
  /**
   * Register a new user with the local authentication system
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post('/api/register', credentials);
      
      // Update auth state in React Query to trigger UI updates
      queryClient.setQueryData(["/api/firebase/user"], response.data);
      
      return response.data;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  },

  /**
   * Login with local authentication
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await axios.post('/api/login', credentials);
      
      // Update auth state in React Query to trigger UI updates
      queryClient.setQueryData(["/api/firebase/user"], response.data);
      
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.error || 'Invalid credentials');
    }
  },

  /**
   * Logout from the local authentication system
   */
  async logout(): Promise<void> {
    try {
      await axios.post('/api/logout');
      
      // Clear auth state in React Query
      queryClient.setQueryData(["/api/user"], null);
      
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  },

  /**
   * Check if the user is already authenticated
   */
  async checkAuth(): Promise<AuthResponse | null> {
    try {
      const response = await axios.get('/api/user');
      
      // If successful, update the auth state
      if (response.data) {
        queryClient.setQueryData(["/api/user"], response.data);
      }
      
      return response.data;
    } catch (error) {
      return null;
    }
  }
};