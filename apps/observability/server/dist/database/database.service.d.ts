import { OnModuleInit } from '@nestjs/common';
import type { HookEvent, FilterOptions, Theme, ThemeSearchQuery } from '../types';
export declare class DatabaseService implements OnModuleInit {
    private readonly logger;
    private pool;
    onModuleInit(): void;
    insertEvent(event: HookEvent): Promise<HookEvent>;
    getFilterOptions(): Promise<FilterOptions>;
    getRecentEvents(limit?: number): Promise<HookEvent[]>;
    updateEventHITLResponse(id: number, response: any): Promise<HookEvent | null>;
    insertTheme(theme: Theme): Promise<Theme>;
    updateTheme(id: string, updates: Partial<Theme>): Promise<boolean>;
    getTheme(id: string): Promise<Theme | null>;
    getThemes(query?: ThemeSearchQuery): Promise<Theme[]>;
    deleteTheme(id: string): Promise<boolean>;
    incrementThemeDownloadCount(id: string): Promise<boolean>;
}
