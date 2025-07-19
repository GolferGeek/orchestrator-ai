import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '@/services/authService'; // Removed AuthResponse import from here
import { apiService } from '@/services/apiService';
import { tokenManager } from '@/services/tokenManager';

// Interface for the token data expected from authService login/signup
interface TokenData {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
}

// Define a shape for the user object you want to store (fetched from /auth/me)
// This should align with what AuthenticatedUserResponse from backend auth/schemas.py provides
interface UserProfile {
  id: string; // UUID typically comes as string
  email?: string;
  displayName?: string;
  // Add other relevant user properties from your /auth/me endpoint
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('authToken'));
  const refreshToken = ref<string | null>(localStorage.getItem('refreshToken'));
  const user = ref<UserProfile | null>(null); // Store more detailed user info
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  // This function is primarily for internal state update after successful token acquisition
  function setTokenData(tokenData: TokenData) {
    token.value = tokenData.accessToken;
    localStorage.setItem('authToken', tokenData.accessToken);
    if (tokenData.refreshToken) {
      refreshToken.value = tokenData.refreshToken;
      localStorage.setItem('refreshToken', tokenData.refreshToken);
    }
    
    // Set auth token on API service
    apiService.setAuthToken(tokenData.accessToken);
    
    error.value = null; // Clear error on successful token set
  }

  function clearAuthData() {
    token.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    
    // Clear auth from API service
    apiService.clearAuth();
  }

  async function login(credentials: { email: string; password: string }) {
    isLoading.value = true;
    error.value = null;
    try {
      const tokenData = await authService.login(credentials);
      setTokenData(tokenData);
      await fetchCurrentUser();
      
      // Start token monitoring after successful login
      tokenManager.startMonitoring();
      
      isLoading.value = false;
      return true;
    } catch (e: any) {
      error.value = e.message || 'Login failed in store.';
      clearAuthData();
      isLoading.value = false;
      return false;
    }
  }

  async function signupAndLogin(signupData: any) {
    isLoading.value = true;
    error.value = null;
    try {
      const tokenData = await authService.signup(signupData);
      setTokenData(tokenData);
      await fetchCurrentUser();
      
      // Start token monitoring after successful signup
      tokenManager.startMonitoring();
      
      isLoading.value = false;
      return { success: true };
    } catch (e: any) {
      error.value = e.message || 'Signup failed in store.';
      if (e.message && e.message.includes("confirm your account")) {
        isLoading.value = false;
        return { success: false, emailConfirmationPending: true, message: e.message };
      }
      clearAuthData();
      isLoading.value = false;
      return { success: false, message: error.value };
    }
  }

  async function logout() {
    // isLoading.value = true; // Logout is usually quick, maybe not needed
    try {
      await authService.logout(); 
    } catch (e: any) {
    }
    
    // Stop token monitoring before clearing auth data
    tokenManager.stopMonitoring();
    
    clearAuthData(); 
    // isLoading.value = false;
  }

  async function refreshAuthToken(): Promise<boolean> {
    try {
      isLoading.value = true;
      error.value = null;
      
      const tokenData = await authService.refreshToken();
      setTokenData(tokenData);
      
      // Fetch updated user data
      await fetchCurrentUser();
      
      return true;
    } catch (e: any) {
      error.value = "Could not refresh authentication token.";
      clearAuthData();
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchCurrentUser() {
    if (!token.value) {
      user.value = null;
      return;
    }
    // isLoading.value = true; // This can be a separate loading state if desired, or rely on component
    try {
      const userData = await apiService.getCurrentUser(); 
      user.value = userData;
      error.value = null; // Clear previous errors if user fetch is successful
    } catch (e: any) {
      error.value = "Could not fetch user details.";
      if ((e as any).response && (e as any).response.status === 401) {
        clearAuthData(); 
      }
    }
    // finally {
    //   isLoading.value = false;
    // }
  }
  
  if (token.value) {
    authService.initializeAuthHeader();
    
    // Initialize auth token on NestJS API service
    apiService.setAuthToken(token.value);
    
    // Start token monitoring for existing sessions
    tokenManager.startMonitoring();
    
    fetchCurrentUser();
  }

  return {
    token,
    refreshToken, // Store value
    user,
    isLoading,
    error,
    isAuthenticated,
    login,
    signupAndLogin,
    logout,
    fetchCurrentUser,
    refreshAuthToken, // The function defined above
    clearAuthData
  };
}); 