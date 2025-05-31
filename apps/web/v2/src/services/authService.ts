import apiClient, { BackendErrorDetail, apiManager } from './apiService';
import { AxiosError } from 'axios';

interface UserCredentials {
  email: string;
  password: string;
}

interface SignupData extends UserCredentials {
  display_name?: string;
  // Add any other signup-specific fields here
}

export interface AuthResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  // You might also want to include basic user info here if your API returns it
  // user?: { id: string; email: string; display_name?: string };
}

const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const authService = {
  async login(credentials: UserCredentials): Promise<AuthResponse> {
    console.log("authService: login called for", credentials.email);
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      console.log("authService: login API response received", response.data);
      if (response.data.access_token) {
        localStorage.setItem(AUTH_TOKEN_KEY, response.data.access_token);
        if (response.data.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh_token);
        }
        
        // Set auth token on backward-compatible client
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
        
        // Set auth token on all API manager clients
        apiManager.setAuthToken(response.data.access_token);
        
        console.log("authService: Token stored and headers set on all clients.");
      } else {
        console.error('authService: Login successful response but no access_token received:', response.data);
        throw new Error('Login completed but no token was provided by the server.');
      }
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      let errorMessage = 'Login failed';
      if (axiosError.response && axiosError.response.data && axiosError.response.data.detail) {
        errorMessage = axiosError.response.data.detail;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      console.error('authService: Login error:', errorMessage, 'Full Axios error:', axiosError);
      throw new Error(errorMessage);
    }
  },

  async signup(data: SignupData): Promise<AuthResponse> {
    console.log("authService: signup called for", data.email);
    try {
      const response = await apiClient.post<AuthResponse>('/auth/signup', data);
      console.log("authService: signup API response received", response.data);
      if (response.data.access_token) {
        localStorage.setItem(AUTH_TOKEN_KEY, response.data.access_token);
        if (response.data.refresh_token) {
            localStorage.setItem(REFRESH_TOKEN_KEY, response.data.refresh_token);
        }
        
        // Set auth token on backward-compatible client
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
        
        // Set auth token on all API manager clients
        apiManager.setAuthToken(response.data.access_token);
        
        console.log("authService: Token stored (after signup) and headers set on all clients.");
      } else {
        console.error('authService: Signup successful response but no access_token received:', response.data);
        throw new Error('Signup completed but no token was provided by the server.');
      }
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      let errorMessage = 'Signup failed';
      if (axiosError.response && axiosError.response.status === 202 && axiosError.response.data && axiosError.response.data.detail) {
        errorMessage = axiosError.response.data.detail; 
        console.warn('authService: Signup requires email confirmation:', errorMessage);
        // Still throw so the store can catch it and inform the user specifically
        throw new Error(errorMessage); 
      }
      else if (axiosError.response && axiosError.response.data && axiosError.response.data.detail) {
        errorMessage = axiosError.response.data.detail;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      console.error('authService: Signup error:', errorMessage, 'Full Axios error:', axiosError);
      throw new Error(errorMessage);
    }
  },

  logout(): void {
    console.log("authService: logout called. Clearing local tokens and auth headers.");
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    
    // Clear auth from backward-compatible client
    delete apiClient.defaults.headers.common['Authorization'];
    
    // Clear auth from all API manager clients
    apiManager.clearAuth();
    
    // Optional: Call backend /auth/logout endpoint. If so, make this async.
    // apiClient.post('/auth/logout').catch(err => console.error("authService: Backend logout call failed", err));
  },

  getToken(): string | null {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    // console.log("authService: getToken called, returning:", token ? token.substring(0,10)+"..." : null);
    return token;
  },

  initializeAuthHeader(): void {
    const token = this.getToken();
    if (token) {
      // Set on backward-compatible client
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Set on all API manager clients
      apiManager.setAuthToken(token);
      
      console.log("authService: Auth headers initialized from stored token on all clients.");
    } else {
      console.log("authService: No stored token found for auth header initialization.");
    }
  }
};

authService.initializeAuthHeader(); 