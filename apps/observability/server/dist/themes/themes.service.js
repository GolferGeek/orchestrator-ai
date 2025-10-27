"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ThemesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemesService = void 0;
const common_1 = require("@nestjs/common");
const database_service_1 = require("../database/database.service");
let ThemesService = ThemesService_1 = class ThemesService {
    constructor(databaseService) {
        this.databaseService = databaseService;
        this.logger = new common_1.Logger(ThemesService_1.name);
    }
    generateId() {
        return Math.random().toString(36).substr(2, 16);
    }
    validateTheme(theme) {
        const errors = [];
        if (!theme.name) {
            errors.push({
                field: 'name',
                message: 'Theme name is required',
                code: 'REQUIRED',
            });
        }
        else if (!/^[a-z0-9-_]+$/.test(theme.name)) {
            errors.push({
                field: 'name',
                message: 'Theme name must contain only lowercase letters, numbers, hyphens, and underscores',
                code: 'INVALID_FORMAT',
            });
        }
        if (!theme.displayName) {
            errors.push({
                field: 'displayName',
                message: 'Display name is required',
                code: 'REQUIRED',
            });
        }
        if (!theme.colors) {
            errors.push({
                field: 'colors',
                message: 'Theme colors are required',
                code: 'REQUIRED',
            });
        }
        else {
            const requiredColors = [
                'primary',
                'primaryHover',
                'primaryLight',
                'primaryDark',
                'bgPrimary',
                'bgSecondary',
                'bgTertiary',
                'bgQuaternary',
                'textPrimary',
                'textSecondary',
                'textTertiary',
                'textQuaternary',
                'borderPrimary',
                'borderSecondary',
                'borderTertiary',
                'accentSuccess',
                'accentWarning',
                'accentError',
                'accentInfo',
                'shadow',
                'shadowLg',
                'hoverBg',
                'activeBg',
                'focusRing',
            ];
            for (const colorKey of requiredColors) {
                const color = theme.colors[colorKey];
                if (!color) {
                    errors.push({
                        field: `colors.${colorKey}`,
                        message: `Color ${colorKey} is required`,
                        code: 'REQUIRED',
                    });
                }
                else if (!this.isValidColor(color)) {
                    errors.push({
                        field: `colors.${colorKey}`,
                        message: `Invalid color format for ${colorKey}`,
                        code: 'INVALID_COLOR',
                    });
                }
            }
        }
        if (theme.tags && Array.isArray(theme.tags)) {
            for (const tag of theme.tags) {
                if (typeof tag !== 'string' || tag.length === 0) {
                    errors.push({
                        field: 'tags',
                        message: 'All tags must be non-empty strings',
                        code: 'INVALID_FORMAT',
                    });
                    break;
                }
            }
        }
        return errors;
    }
    isValidColor(color) {
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
            return true;
        }
        if (/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d?(?:\.\d+)?))?\)$/.test(color)) {
            return true;
        }
        const namedColors = [
            'transparent',
            'black',
            'white',
            'red',
            'green',
            'blue',
            'yellow',
            'cyan',
            'magenta',
            'gray',
            'grey',
        ];
        return namedColors.includes(color.toLowerCase());
    }
    sanitizeTheme(theme) {
        return {
            name: theme.name
                ?.toString()
                .toLowerCase()
                .replace(/[^a-z0-9-_]/g, '') || '',
            displayName: theme.displayName?.toString().trim() || '',
            description: theme.description?.toString().trim() || '',
            colors: theme.colors || {},
            isPublic: Boolean(theme.isPublic),
            tags: Array.isArray(theme.tags)
                ? theme.tags.filter((tag) => typeof tag === 'string' && tag.trim())
                : [],
            authorId: theme.authorId?.toString() || undefined,
            authorName: theme.authorName?.toString() || undefined,
        };
    }
    async createTheme(themeData) {
        try {
            const sanitized = this.sanitizeTheme(themeData);
            const errors = this.validateTheme(sanitized);
            if (errors.length > 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    validationErrors: errors,
                };
            }
            const existingThemes = await this.databaseService.getThemes({
                query: sanitized.name,
            });
            if (existingThemes.some((t) => t.name === sanitized.name)) {
                return {
                    success: false,
                    error: 'Theme name already exists',
                    validationErrors: [
                        {
                            field: 'name',
                            message: 'A theme with this name already exists',
                            code: 'DUPLICATE',
                        },
                    ],
                };
            }
            const theme = {
                id: this.generateId(),
                name: sanitized.name,
                displayName: sanitized.displayName,
                description: sanitized.description,
                colors: sanitized.colors,
                isPublic: sanitized.isPublic,
                authorId: sanitized.authorId,
                authorName: sanitized.authorName,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                tags: sanitized.tags || [],
                downloadCount: 0,
                rating: 0,
                ratingCount: 0,
            };
            const savedTheme = await this.databaseService.insertTheme(theme);
            return {
                success: true,
                data: savedTheme,
                message: 'Theme created successfully',
            };
        }
        catch (error) {
            this.logger.error('Error creating theme:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
    async updateThemeById(id, updates) {
        try {
            const existingTheme = await this.databaseService.getTheme(id);
            if (!existingTheme) {
                return {
                    success: false,
                    error: 'Theme not found',
                };
            }
            const sanitized = this.sanitizeTheme(updates);
            delete sanitized.name;
            const errors = this.validateTheme({ ...existingTheme, ...sanitized });
            if (errors.length > 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    validationErrors: errors,
                };
            }
            const updateData = {
                ...sanitized,
                updatedAt: Date.now(),
            };
            const success = await this.databaseService.updateTheme(id, updateData);
            if (!success) {
                return {
                    success: false,
                    error: 'Failed to update theme',
                };
            }
            const updatedTheme = await this.databaseService.getTheme(id);
            return {
                success: true,
                data: updatedTheme,
                message: 'Theme updated successfully',
            };
        }
        catch (error) {
            this.logger.error('Error updating theme:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
    async getThemeById(id) {
        try {
            const theme = await this.databaseService.getTheme(id);
            if (!theme) {
                return {
                    success: false,
                    error: 'Theme not found',
                };
            }
            if (theme.isPublic) {
                await this.databaseService.incrementThemeDownloadCount(id);
            }
            return {
                success: true,
                data: theme,
            };
        }
        catch (error) {
            this.logger.error('Error getting theme:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
    async searchThemes(query) {
        try {
            const searchQuery = {
                ...query,
                isPublic: query.authorId ? undefined : true,
            };
            const themes = await this.databaseService.getThemes(searchQuery);
            return {
                success: true,
                data: themes,
            };
        }
        catch (error) {
            this.logger.error('Error searching themes:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
    async deleteThemeById(id, authorId) {
        try {
            const theme = await this.databaseService.getTheme(id);
            if (!theme) {
                return {
                    success: false,
                    error: 'Theme not found',
                };
            }
            if (authorId && theme.authorId !== authorId) {
                return {
                    success: false,
                    error: 'Unauthorized - you can only delete your own themes',
                };
            }
            const success = await this.databaseService.deleteTheme(id);
            if (!success) {
                return {
                    success: false,
                    error: 'Failed to delete theme',
                };
            }
            return {
                success: true,
                message: 'Theme deleted successfully',
            };
        }
        catch (error) {
            this.logger.error('Error deleting theme:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
    async exportThemeById(id) {
        try {
            const theme = await this.databaseService.getTheme(id);
            if (!theme) {
                return {
                    success: false,
                    error: 'Theme not found',
                };
            }
            const exportData = {
                version: '1.0.0',
                theme: {
                    ...theme,
                    id: undefined,
                    authorId: undefined,
                    downloadCount: undefined,
                    rating: undefined,
                    ratingCount: undefined,
                    createdAt: undefined,
                    updatedAt: undefined,
                },
                exportedAt: new Date().toISOString(),
                exportedBy: 'observability-system',
            };
            return {
                success: true,
                data: exportData,
            };
        }
        catch (error) {
            this.logger.error('Error exporting theme:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
    async importTheme(importData, authorId) {
        try {
            if (!importData.theme) {
                return {
                    success: false,
                    error: 'Invalid import data - missing theme',
                };
            }
            const themeData = {
                ...importData.theme,
                authorId,
                authorName: importData.theme.authorName || 'Imported',
                isPublic: false,
            };
            return await this.createTheme(themeData);
        }
        catch (error) {
            this.logger.error('Error importing theme:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
    async getThemeStats() {
        try {
            const allThemes = await this.databaseService.getThemes();
            const publicThemes = await this.databaseService.getThemes({
                isPublic: true,
            });
            const stats = {
                totalThemes: allThemes.length,
                publicThemes: publicThemes.length,
                privateThemes: allThemes.length - publicThemes.length,
                totalDownloads: allThemes.reduce((sum, theme) => sum + (theme.downloadCount || 0), 0),
                averageRating: allThemes.length > 0
                    ? allThemes.reduce((sum, theme) => sum + (theme.rating || 0), 0) /
                        allThemes.length
                    : 0,
            };
            return {
                success: true,
                data: stats,
            };
        }
        catch (error) {
            this.logger.error('Error getting theme stats:', error);
            return {
                success: false,
                error: 'Internal server error',
            };
        }
    }
};
exports.ThemesService = ThemesService;
exports.ThemesService = ThemesService = ThemesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], ThemesService);
//# sourceMappingURL=themes.service.js.map