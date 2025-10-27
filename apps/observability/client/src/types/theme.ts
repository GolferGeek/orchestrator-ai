// Theme type definitions

export type ThemeName = 'light' | 'dark' | 'custom';

export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgQuaternary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  borderPrimary: string;
  borderSecondary: string;
  borderTertiary: string;
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
  accentInfo: string;
  shadow: string;
  shadowLg: string;
  hoverBg: string;
  activeBg: string;
  focusRing: string;
}

export interface PredefinedTheme {
  name: ThemeName;
  displayName: string;
  colors: ThemeColors;
}

export interface CustomTheme extends PredefinedTheme {
  id?: string;
  authorId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface ThemeState {
  currentTheme: ThemeName;
  customTheme: CustomTheme | null;
}

export interface ThemeManagerState {
  themes: Record<ThemeName, PredefinedTheme>;
  customThemes: CustomTheme[];
  currentTheme: ThemeName;
}

export interface CreateThemeFormData {
  name: string;
  displayName: string;
  baseTheme: ThemeName;
  colors: Partial<ThemeColors>;
}

export interface ThemeValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ThemeImportExport {
  version: string;
  theme: CustomTheme;
}

export interface ThemeApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Constants
export const PREDEFINED_THEME_NAMES: ThemeName[] = ['light', 'dark'];

export const COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
export const RGBA_REGEX = /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
