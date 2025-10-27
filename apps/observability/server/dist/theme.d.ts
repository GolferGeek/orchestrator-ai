import type { Theme, ThemeSearchQuery, ApiResponse } from './types.js';
export declare function createTheme(themeData: any): Promise<ApiResponse<Theme>>;
export declare function updateThemeById(id: string, updates: any): Promise<ApiResponse<Theme>>;
export declare function getThemeById(id: string): Promise<ApiResponse<Theme>>;
export declare function searchThemes(query: ThemeSearchQuery): Promise<ApiResponse<Theme[]>>;
export declare function deleteThemeById(id: string, authorId?: string): Promise<ApiResponse<void>>;
export declare function exportThemeById(id: string): Promise<ApiResponse<any>>;
export declare function importTheme(importData: any, authorId?: string): Promise<ApiResponse<Theme>>;
export declare function getThemeStats(): Promise<ApiResponse<any>>;
