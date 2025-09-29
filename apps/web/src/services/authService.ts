import { apiService } from './apiService';
// Define BackendErrorDetail interface here since it's no longer exported from apiService
interface BackendErrorDetail {
  message: string;
  detail?: string;
  field?: string;
}
import { AxiosError } from 'axios';
interface UserCredentials {
  email: string;
  password: string;
}
interface SignupData extends UserCredentials {
  displayName?: string;
  // Add any other signup-specific fields here
}
export interface AuthResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  // You might also want to include basic user info here if your API returns it
  // user?: { id: string; email: string; displayName?: string };
}
const AUTH_TOKEN_KEY = 'authToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
export const authService = {
  async login(credentials: UserCredentials): Promise<AuthResponse> {
    try {
      const responseData = await apiService.login(credentials);
      if (responseData.accessToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, responseData.accessToken);
        if (responseData.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, responseData.refreshToken);
        }
        // Set auth token on API service
        apiService.setAuthToken(responseData.accessToken);
      } else {
        throw new Error('Login completed but no token was provided by the server.');
      }
      return responseData;
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      let errorMessage = 'Login failed';
      if (axiosError.response && axiosError.response.data && axiosError.response.data.detail) {
        errorMessage = axiosError.response.data.detail;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      throw new Error(errorMessage);
    }
  },
  async signup(data: SignupData): Promise<AuthResponse> {
    try {
      const responseData = await apiService.signup(data);
      if (responseData.accessToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, responseData.accessToken);
        if (responseData.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, responseData.refreshToken);
        }
        // Set auth token on API service
        apiService.setAuthToken(responseData.accessToken);
      } else {
        throw new Error('Signup completed but no token was provided by the server.');
      }
      return responseData;
    } catch (error) {
      const axiosError = error as AxiosError<BackendErrorDetail>; 
      let errorMessage = 'Signup failed';
      if (axiosError.response && axiosError.response.status === 202 && axiosError.response.data && axiosError.response.data.detail) {
        errorMessage = axiosError.response.data.detail; 
        // Still throw so the store can catch it and inform the user specifically
        throw new Error(errorMessage); 
      }
      else if (axiosError.response && axiosError.response.data && axiosError.response.data.detail) {
        errorMessage = axiosError.response.data.detail;
      } else if (axiosError.message) {
        errorMessage = axiosError.message;
      }
      throw new Error(errorMessage);
    }
  },
  logout(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    // Clear auth from API service
    apiService.clearAuth();
    // Optional: Call backend /auth/logout endpoint. If so, make this async.
    // apiService.post('/auth/logout').catch(err => /* Backend logout call failed */);
  },
  getToken(): string | null {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token;
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  async refreshToken(): Promise<AuthResponse> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      const responseData = await apiService.refreshToken(refreshToken);
      if (responseData.accessToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, responseData.accessToken);
        if (responseData.refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, responseData.refreshToken);
        }
        // Set auth token on API service
        apiService.setAuthToken(responseData.accessToken);
        return responseData;
      } else {
        throw new Error('Token refresh completed but no new token was provided by the server.');
      }
    } catch (error) {
      // If refresh fails, clear auth data and force re-login
      this.logout();
      throw error;
    }
  },
  initializeAuthHeader(): void {
    const token = this.getToken();
    if (token) {
      // Set on API service
      apiService.setAuthToken(token);
    }
  }
};

// Initialize auth header after the object is fully defined
setTimeout(() => {
  authService.initializeAuthHeader();
}, 0); 