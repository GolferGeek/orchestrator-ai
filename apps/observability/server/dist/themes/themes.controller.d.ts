import { Response } from 'express';
import { ThemesService } from './themes.service';
export declare class ThemesController {
    private readonly themesService;
    constructor(themesService: ThemesService);
    createTheme(themeData: any, res: Response): Promise<Response<any, Record<string, any>>>;
    searchThemes(query?: string, isPublic?: string, authorId?: string, sortBy?: any, sortOrder?: any, limit?: string, offset?: string): Promise<import("../types").ApiResponse<import("../types").Theme[]>>;
    getStats(): Promise<import("../types").ApiResponse<any>>;
    getTheme(id: string, res: Response): Promise<Response<any, Record<string, any>>>;
    updateTheme(id: string, updates: any, res: Response): Promise<Response<any, Record<string, any>>>;
    deleteTheme(id: string, res: Response, authorId?: string): Promise<Response<any, Record<string, any>>>;
    exportTheme(id: string, res: Response): Promise<Response<any, Record<string, any>>>;
    importTheme(importData: any, res: Response, authorId?: string): Promise<Response<any, Record<string, any>>>;
}
