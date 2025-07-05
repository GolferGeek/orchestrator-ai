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
    console.log("authService: login called for", credentials.email);
    try {
      const responseData = await apiService.login(credentials);
      console.log("authService: login API response received", responseData);
      if (responseData.accessToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, responseData.accessToken);
        if (responseData.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, responseData.refreshToken);
        }
        
        // Set auth token on API service
        apiService.setAuthToken(responseData.accessToken);
        
        console.log("authService: Token stored and headers set on API service.");
      } else {
        console.error('authService: Login successful response but no accessToken received:', responseData);
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
      console.error('authService: Login error:', errorMessage, 'Full Axios error:', axiosError);
      throw new Error(errorMessage);
    }
  },

  async signup(data: SignupData): Promise<AuthResponse> {
    console.log("authService: signup called for", data.email);
    try {
      const responseData = await apiService.signup(data);
      console.log("authService: signup API response received", responseData);
      if (responseData.accessToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, responseData.accessToken);
        if (responseData.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, responseData.refreshToken);
        }
        
        // Set auth token on API service
        apiService.setAuthToken(responseData.accessToken);
        
        console.log("authService: Token stored (after signup) and headers set on API service.");
      } else {
        console.error('authService: Signup successful response but no accessToken received:', responseData);
        throw new Error('Signup completed but no token was provided by the server.');
      }
      return responseData;
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
    
    // Clear auth from API service
    apiService.clearAuth();
    
    // Optional: Call backend /auth/logout endpoint. If so, make this async.
    // apiService.post('/auth/logout').catch(err => console.error("authService: Backend logout call failed", err));
  },

  getToken(): string | null {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    // console.log("authService: getToken called, returning:", token ? token.substring(0,10)+"..." : null);
    return token;
  },

  initializeAuthHeader(): void {
    const token = this.getToken();
    if (token) {
      // Set on API service
      apiService.setAuthToken(token);
      
      console.log("authService: Auth headers initialized from stored token on API service.");
    } else {
      console.log("authService: No stored token found for auth header initialization.");
    }
  }
};

authService.initializeAuthHeader(); 