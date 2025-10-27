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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemesController = void 0;
const common_1 = require("@nestjs/common");
const themes_service_1 = require("./themes.service");
let ThemesController = class ThemesController {
    constructor(themesService) {
        this.themesService = themesService;
    }
    async createTheme(themeData, res) {
        const result = await this.themesService.createTheme(themeData);
        const status = result.success ? common_1.HttpStatus.CREATED : common_1.HttpStatus.BAD_REQUEST;
        return res.status(status).json(result);
    }
    async searchThemes(query, isPublic, authorId, sortBy, sortOrder, limit, offset) {
        const searchQuery = {
            query: query || undefined,
            isPublic: isPublic ? isPublic === 'true' : undefined,
            authorId: authorId || undefined,
            sortBy: sortBy || undefined,
            sortOrder: sortOrder || undefined,
            limit: limit ? parseInt(limit) : undefined,
            offset: offset ? parseInt(offset) : undefined,
        };
        return this.themesService.searchThemes(searchQuery);
    }
    async getStats() {
        return this.themesService.getThemeStats();
    }
    async getTheme(id, res) {
        const result = await this.themesService.getThemeById(id);
        const status = result.success ? common_1.HttpStatus.OK : common_1.HttpStatus.NOT_FOUND;
        return res.status(status).json(result);
    }
    async updateTheme(id, updates, res) {
        const result = await this.themesService.updateThemeById(id, updates);
        const status = result.success ? common_1.HttpStatus.OK : common_1.HttpStatus.BAD_REQUEST;
        return res.status(status).json(result);
    }
    async deleteTheme(id, res, authorId) {
        const result = await this.themesService.deleteThemeById(id, authorId);
        const status = result.success
            ? common_1.HttpStatus.OK
            : result.error?.includes('not found')
                ? common_1.HttpStatus.NOT_FOUND
                : common_1.HttpStatus.FORBIDDEN;
        return res.status(status).json(result);
    }
    async exportTheme(id, res) {
        const result = await this.themesService.exportThemeById(id);
        if (!result.success) {
            const status = result.error?.includes('not found')
                ? common_1.HttpStatus.NOT_FOUND
                : common_1.HttpStatus.BAD_REQUEST;
            return res.status(status).json(result);
        }
        res.setHeader('Content-Disposition', `attachment; filename="${result.data.theme.name}.json"`);
        return res.json(result.data);
    }
    async importTheme(importData, res, authorId) {
        const result = await this.themesService.importTheme(importData, authorId);
        const status = result.success ? common_1.HttpStatus.CREATED : common_1.HttpStatus.BAD_REQUEST;
        return res.status(status).json(result);
    }
};
exports.ThemesController = ThemesController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "createTheme", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('query')),
    __param(1, (0, common_1.Query)('isPublic')),
    __param(2, (0, common_1.Query)('authorId')),
    __param(3, (0, common_1.Query)('sortBy')),
    __param(4, (0, common_1.Query)('sortOrder')),
    __param(5, (0, common_1.Query)('limit')),
    __param(6, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "searchThemes", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "getTheme", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "updateTheme", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('authorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, String]),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "deleteTheme", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "exportTheme", null);
__decorate([
    (0, common_1.Post)('import'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('authorId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ThemesController.prototype, "importTheme", null);
exports.ThemesController = ThemesController = __decorate([
    (0, common_1.Controller)('api/themes'),
    __metadata("design:paramtypes", [themes_service_1.ThemesService])
], ThemesController);
//# sourceMappingURL=themes.controller.js.map