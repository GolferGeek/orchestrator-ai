import { DatabaseService } from '../database/database.service';
import type { Theme, ThemeSearchQuery, ApiResponse } from '../types';
export declare class ThemesService {
    private readonly databaseService;
    private readonly logger;
    constructor(databaseService: DatabaseService);
    private generateId;
    private validateTheme;
    private isValidColor;
    private sanitizeTheme;
    createTheme(themeData: any): Promise<ApiResponse<Theme>>;
    updateThemeById(id: string, updates: any): Promise<ApiResponse<Theme>>;
    getThemeById(id: string): Promise<ApiResponse<Theme>>;
    searchThemes(query: ThemeSearchQuery): Promise<ApiResponse<Theme[]>>;
    deleteThemeById(id: string, authorId?: string): Promise<ApiResponse<void>>;
    exportThemeById(id: string): Promise<ApiResponse<any>>;
    importTheme(importData: any, authorId?: string): Promise<ApiResponse<Theme>>;
    getThemeStats(): Promise<ApiResponse<any>>;
}
