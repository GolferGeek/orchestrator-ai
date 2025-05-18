import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authService } from '@/services/authService'; // Removed AuthResponse import from here
import apiClient from '@/services/apiService'; // To update axios headers

// Interface for the token data expected from authService login/signup
interface TokenData {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
}

// Define a shape for the user object you want to store (fetched from /auth/me)
// This should align with what AuthenticatedUserResponse from backend auth/schemas.py provides
interface UserProfile {
  id: string; // UUID typically comes as string
  email?: string;
  display_name?: string;
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
    console.log("authStore: Setting token data", tokenData);
    token.value = tokenData.access_token;
    localStorage.setItem('authToken', tokenData.access_token);
    if (tokenData.refresh_token) {
      refreshToken.value = tokenData.refresh_token;
      localStorage.setItem('refreshToken', tokenData.refresh_token);
    }
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${tokenData.access_token}`;
    error.value = null; // Clear error on successful token set
  }

  function clearAuthData() {
    console.log("authStore: Clearing auth data");
    token.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
    delete apiClient.defaults.headers.common['Authorization'];
  }

  async function login(credentials: { email: string; password: string }) {
    console.log("authStore: login action called with", credentials.email);
    isLoading.value = true;
    error.value = null;
    try {
      const tokenData = await authService.login(credentials);
      console.log("authStore: login service call successful, tokenData:", tokenData);
      setTokenData(tokenData);
      await fetchCurrentUser();
      console.log("authStore: fetchCurrentUser completed, user:", user.value);
      isLoading.value = false;
      return true;
    } catch (e: any) {
      console.error("authStore: login action failed:", e.message);
      error.value = e.message || 'Login failed in store.';
      clearAuthData();
      isLoading.value = false;
      return false;
    }
  }

  async function signupAndLogin(signupData: any) {
    console.log("authStore: signupAndLogin action called");
    isLoading.value = true;
    error.value = null;
    try {
      const tokenData = await authService.signup(signupData);
      console.log("authStore: signup service call successful, tokenData:", tokenData);
      setTokenData(tokenData);
      await fetchCurrentUser();
      console.log("authStore: fetchCurrentUser completed after signup, user:", user.value);
      isLoading.value = false;
      return { success: true };
    } catch (e: any) {
      console.error("authStore: signupAndLogin action failed:", e.message);
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
    console.log("authStore: logout action called");
    // isLoading.value = true; // Logout is usually quick, maybe not needed
    try {
      await authService.logout(); 
      console.log("authStore: authService.logout() completed");
    } catch (e: any) {
      console.error("authStore: Error during backend logout (if called from authService):", e.message);
    }
    clearAuthData(); 
    // isLoading.value = false;
  }

  async function fetchCurrentUser() {
    console.log("authStore: fetchCurrentUser called. Token:", token.value ? token.value.substring(0,10)+"..." : null);
    if (!token.value) {
      user.value = null;
      console.log("authStore: No token, user set to null.");
      return;
    }
    // isLoading.value = true; // This can be a separate loading state if desired, or rely on component
    try {
      const response = await apiClient.get<UserProfile>('/auth/me'); 
      user.value = response.data;
      error.value = null; // Clear previous errors if user fetch is successful
      console.log("authStore: User fetched successfully:", user.value);
    } catch (e: any) {
      console.error("authStore: Failed to fetch current user:", e.message);
      error.value = "Could not fetch user details.";
      if ((e as any).response && (e as any).response.status === 401) {
        console.log("authStore: Unauthorized (401) fetching user, clearing auth data.");
        clearAuthData(); 
      }
    }
    // finally {
    //   isLoading.value = false;
    // }
  }
  
  if (token.value) {
    console.log("authStore: Initializing with existing token.");
    authService.initializeAuthHeader();
    fetchCurrentUser();
  }

  return {
    token,
    refreshToken,
    user,
    isLoading,
    error,
    isAuthenticated,
    login,
    signupAndLogin,
    logout,
    fetchCurrentUser,
    clearAuthData
  };
}); 