import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { ApiEndpoint, ApiVersion, ApiTechnology } from '../types/api';
import { apiManager } from '../services/apiManager';

interface UserPreferences {
  // API Preferences
  preferredApiVersion: ApiVersion;
  preferredTechnology: ApiTechnology;
  autoSwitchToHealthyEndpoint: boolean;
  rememberApiSelection: boolean;
  
  // UI Preferences
  theme: 'light' | 'dark' | 'auto';
  language: string;
  showAdvancedOptions: boolean;
  enableDebugMode: boolean;
  
  // Chat Preferences
  enableAutoScroll: boolean;
  showTimestamps: boolean;
  enableSoundNotifications: boolean;
  messageHistory: number; // Number of messages to keep in history
  
  // Performance Preferences
  enableCaching: boolean;
  cacheDuration: number; // In minutes
  enableOfflineMode: boolean;
  
  // Developer Preferences
  showApiMetadata: boolean;
  enableRequestLogging: boolean;
  showHealthStatus: boolean;
  
  // Accessibility Preferences
  enableHighContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  enableScreenReader: boolean;
  
  // Session Management
  persistSessions: boolean;
  autoSaveInterval: number; // In seconds
  maxSessions: number;
}

interface UserProfile {
  id: string;
  name: string;
  email?: string;
  role: 'user' | 'admin' | 'developer';
  preferences: UserPreferences;
  createdAt: Date;
  lastActive: Date;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  // API Preferences
  preferredApiVersion: 'v1',
  preferredTechnology: 'python-fastapi',
  autoSwitchToHealthyEndpoint: true,
  rememberApiSelection: true,
  
  // UI Preferences
  theme: 'auto',
  language: 'en',
  showAdvancedOptions: false,
  enableDebugMode: false,
  
  // Chat Preferences
  enableAutoScroll: true,
  showTimestamps: true,
  enableSoundNotifications: false,
  messageHistory: 100,
  
  // Performance Preferences
  enableCaching: true,
  cacheDuration: 30,
  enableOfflineMode: false,
  
  // Developer Preferences
  showApiMetadata: false,
  enableRequestLogging: false,
  showHealthStatus: true,
  
  // Accessibility Preferences
  enableHighContrast: false,
  fontSize: 'medium',
  enableScreenReader: false,
  
  // Session Management
  persistSessions: true,
  autoSaveInterval: 30,
  maxSessions: 10,
};

export const useUserPreferencesStore = defineStore('userPreferences', () => {
  // Reactive state
  const currentUser = ref<UserProfile | null>(null);
  const preferences = ref<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const isLoading = ref(false);
  const lastSaved = ref<Date | null>(null);

  // Computed properties
  const effectiveTheme = computed(() => {
    if (preferences.value.theme === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return preferences.value.theme;
  });

  const preferredEndpoint = computed(() => {
    const available = apiManager.availableEndpoints;
    return available.find(ep => 
      ep.version === preferences.value.preferredApiVersion && 
      ep.technology === preferences.value.preferredTechnology
    ) || available[0];
  });

  const isAdvancedUser = computed(() => {
    return currentUser.value?.role === 'developer' || 
           currentUser.value?.role === 'admin' ||
           preferences.value.showAdvancedOptions;
  });

  // Watchers for automatic preference application
  watch(
    () => preferences.value.preferredApiVersion,
    async (newVersion) => {
      if (preferences.value.rememberApiSelection && newVersion) {
        try {
          await apiManager.switchToVersion(
            newVersion, 
            preferences.value.preferredTechnology
          );
          console.log(`Automatically switched to preferred API version: ${newVersion}`);
        } catch (error) {
          console.warn('Failed to switch to preferred API version:', error);
        }
      }
    }
  );

  watch(
    () => preferences.value.theme,
    (newTheme) => {
      applyTheme(newTheme);
    }
  );

  // Actions
  const initializePreferences = async () => {
    isLoading.value = true;
    
    try {
      await loadUserProfile();
      await loadPreferences();
      applyPreferences();
      setupAutoSave();
      
      console.log('User preferences initialized');
    } catch (error) {
      console.error('Failed to initialize preferences:', error);
    } finally {
      isLoading.value = false;
    }
  };

  const loadUserProfile = async () => {
    try {
      const saved = localStorage.getItem('userProfile');
      if (saved) {
        const profile = JSON.parse(saved);
        profile.createdAt = new Date(profile.createdAt);
        profile.lastActive = new Date(profile.lastActive);
        currentUser.value = profile;
      } else {
        // Create default user profile
        currentUser.value = {
          id: crypto.randomUUID(),
          name: 'Anonymous User',
          role: 'user',
          preferences: { ...DEFAULT_PREFERENCES },
          createdAt: new Date(),
          lastActive: new Date(),
        };
        saveUserProfile();
      }
    } catch (error) {
      console.warn('Failed to load user profile:', error);
      // Create fallback profile
      currentUser.value = {
        id: 'fallback',
        name: 'Anonymous User',
        role: 'user',
        preferences: { ...DEFAULT_PREFERENCES },
        createdAt: new Date(),
        lastActive: new Date(),
      };
    }
  };

  const loadPreferences = async () => {
    try {
      const saved = localStorage.getItem('userPreferences');
      if (saved) {
        const loadedPrefs = JSON.parse(saved);
        // Merge with defaults to handle new preference fields
        preferences.value = { ...DEFAULT_PREFERENCES, ...loadedPrefs };
      }
    } catch (error) {
      console.warn('Failed to load preferences:', error);
      preferences.value = { ...DEFAULT_PREFERENCES };
    }
  };

  const savePreferences = () => {
    try {
      localStorage.setItem('userPreferences', JSON.stringify(preferences.value));
      lastSaved.value = new Date();
      
      // Update user profile with current preferences
      if (currentUser.value) {
        currentUser.value.preferences = { ...preferences.value };
        currentUser.value.lastActive = new Date();
        saveUserProfile();
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const saveUserProfile = () => {
    try {
      if (currentUser.value) {
        localStorage.setItem('userProfile', JSON.stringify(currentUser.value));
      }
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  };

  const updatePreference = (
    key: keyof UserPreferences, 
    value: any
  ) => {
    (preferences.value as any)[key] = value;
    savePreferences();
  };

  const updateMultiplePreferences = (updates: Partial<UserPreferences>) => {
    Object.assign(preferences.value, updates);
    savePreferences();
  };

  const resetPreferences = () => {
    preferences.value = { ...DEFAULT_PREFERENCES };
    savePreferences();
  };

  const resetToDefaults = (category?: keyof UserPreferences) => {
    if (category) {
      preferences.value[category] = DEFAULT_PREFERENCES[category];
    } else {
      preferences.value = { ...DEFAULT_PREFERENCES };
    }
    savePreferences();
  };

  const applyPreferences = () => {
    applyTheme(preferences.value.theme);
    applyApiPreferences();
    applyAccessibilityPreferences();
    applyPerformancePreferences();
  };

  const applyTheme = (theme: 'light' | 'dark' | 'auto') => {
    const body = document.body;
    body.classList.remove('theme-light', 'theme-dark');
    
    let effectiveTheme = theme;
    if (theme === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    body.classList.add(`theme-${effectiveTheme}`);
    
    // Update meta theme-color for mobile browsers
    let themeColorMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    
    themeColorMeta.content = effectiveTheme === 'dark' ? '#1a1a1a' : '#ffffff';
  };

  const applyApiPreferences = async () => {
    if (preferences.value.rememberApiSelection && preferredEndpoint.value) {
      try {
        await apiManager.switchToEndpoint(preferredEndpoint.value);
      } catch (error) {
        console.warn('Failed to apply API preferences:', error);
      }
    }
  };

  const applyAccessibilityPreferences = () => {
    const body = document.body;
    
    // High contrast mode
    body.classList.toggle('high-contrast', preferences.value.enableHighContrast);
    
    // Font size
    body.classList.remove('font-small', 'font-medium', 'font-large');
    body.classList.add(`font-${preferences.value.fontSize}`);
    
    // Screen reader support
    if (preferences.value.enableScreenReader) {
      body.setAttribute('data-screen-reader', 'true');
    } else {
      body.removeAttribute('data-screen-reader');
    }
  };

  const applyPerformancePreferences = () => {
    // Configure caching behavior
    if (preferences.value.enableCaching) {
      // Could set cache headers or configure service worker
      console.log(`Caching enabled with ${preferences.value.cacheDuration}min duration`);
    }
    
    // Configure offline mode
    if (preferences.value.enableOfflineMode) {
      // Could register service worker for offline functionality
      console.log('Offline mode enabled');
    }
  };

  let autoSaveInterval: number | null = null;

  const setupAutoSave = () => {
    if (autoSaveInterval) {
      clearInterval(autoSaveInterval);
    }
    
    if (preferences.value.autoSaveInterval > 0) {
      autoSaveInterval = window.setInterval(() => {
        savePreferences();
      }, preferences.value.autoSaveInterval * 1000);
    }
  };

  const exportPreferences = () => {
    return {
      userProfile: currentUser.value,
      preferences: preferences.value,
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };
  };

  const importPreferences = (data: any) => {
    try {
      if (data.preferences) {
        preferences.value = { ...DEFAULT_PREFERENCES, ...data.preferences };
      }
      
      if (data.userProfile) {
        currentUser.value = {
          ...data.userProfile,
          createdAt: new Date(data.userProfile.createdAt),
          lastActive: new Date(),
        };
      }
      
      savePreferences();
      applyPreferences();
      
      console.log('Preferences imported successfully');
    } catch (error) {
      console.error('Failed to import preferences:', error);
      throw error;
    }
  };

  // Quick access methods for common preferences
  const setApiVersion = async (version: ApiVersion) => {
    updatePreference('preferredApiVersion', version);
    if (preferences.value.rememberApiSelection) {
      await applyApiPreferences();
    }
  };

  const setTheme = (theme: 'light' | 'dark' | 'auto') => {
    updatePreference('theme', theme);
  };

  const toggleAdvancedMode = () => {
    updatePreference('showAdvancedOptions', !preferences.value.showAdvancedOptions);
  };

  const toggleDebugMode = () => {
    updatePreference('enableDebugMode', !preferences.value.enableDebugMode);
  };

  // Listen for system theme changes
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (preferences.value.theme === 'auto') {
        applyTheme('auto');
      }
    });
  }

  return {
    // State
    currentUser,
    preferences,
    isLoading,
    lastSaved,
    
    // Computed
    effectiveTheme,
    preferredEndpoint,
    isAdvancedUser,
    
    // Actions
    initializePreferences,
    loadUserProfile,
    loadPreferences,
    savePreferences,
    updatePreference,
    updateMultiplePreferences,
    resetPreferences,
    resetToDefaults,
    applyPreferences,
    exportPreferences,
    importPreferences,
    
    // Quick access
    setApiVersion,
    setTheme,
    toggleAdvancedMode,
    toggleDebugMode,
  };
}); 