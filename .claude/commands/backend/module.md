---
description: "Create a new NestJS module following Orchestrator AI patterns"
argument-hint: "[module-name] [description]"
---

# Create Backend Module

Create a new NestJS module following Orchestrator AI's strict patterns. Modules organize dependencies, controllers, and providers.

**Usage:** `/backend:module [module-name] [description]`

**Examples:**
- `/backend:module user "Module for user management"`
- `/backend:module` (interactive creation with agent)

## Process

### 1. Invoke Back-End Coding Agent

Invoke `@back-end-coding-agent` to guide the creation process:

```
@back-end-coding-agent

Create Module Request:
- Module Name: [module-name]
- Description: [description]
- Dependencies: [what other modules/services are needed]

Create NestJS module following Orchestrator AI patterns.
```

**The agent will:**
- Ask for module details (name, purpose, dependencies)
- Create module file with proper structure
- Identify needed controllers and services
- Ensure kebab-case file naming

### 2. Provide Module Information

When prompted by the agent, provide:

**Module Details:**
- Module name (kebab-case, e.g., `user-management`)
- Description (what this module handles)
- Dependencies (what other modules are needed)
- Controllers needed (what HTTP endpoints)
- Services needed (what business logic)

**Module Structure:**
- What controllers are needed?
- What services are needed?
- What other modules should be imported?
- What should be exported?

### 3. Agent Creates Module File

The agent will create:
- `apps/api/src/{module-name}/{module-name}.module.ts`

**Module structure:**
```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { {ModuleName}Controller } from './{module-name}.controller';
import { {ModuleName}Service } from './{module-name}.service';

@Module({
  imports: [
    HttpModule,
    ConfigModule.forRoot(),
    // Other modules
  ],
  controllers: [{ModuleName}Controller],
  providers: [{ModuleName}Service],
  exports: [{ModuleName}Service], // If other modules need this
})
export class {ModuleName}Module {}
```

### 4. Architecture Validation

**The agent ensures:**
- File uses kebab-case naming
- Module follows NestJS patterns
- Proper imports/controllers/providers/exports
- Module registered in app.module.ts (if root-level)

### 5. Output Summary

```
✅ Backend Module Created Successfully

📦 Module: user-management.module.ts
📄 Location: apps/api/src/user-management/user-management.module.ts

📋 Module Structure:
   ✅ Imports: HttpModule, ConfigModule
   ✅ Controllers: UserManagementController
   ✅ Providers: UserManagementService
   ✅ Exports: UserManagementService

📋 Architecture Compliance:
   ✅ Kebab-case file naming
   ✅ Proper NestJS structure
   ✅ Dependency injection configured

📤 Next Steps:
   1. Create service: /backend:service user-management
   2. Create controller: /backend:controller user-management
   3. Register in app.module.ts if root-level
   4. Run quality gates: /quality:all
```

## Important Notes

- **CRITICAL**: Files must use kebab-case naming (e.g., `user-management.module.ts`)
- Modules organize dependencies, controllers, and providers
- Controllers handle HTTP (thin layer)
- Services contain business logic (thick layer)
- Module must be registered in app.module.ts if root-level

## Module Pattern

**✅ CORRECT:**
- Kebab-case file names
- Proper imports/controllers/providers/exports
- Dependency injection configured

**❌ WRONG:**
- PascalCase or camelCase file names
- Missing imports or providers
- Business logic in controllers

## Related Commands

- `/backend:service` - Create service for module
- `/backend:controller` - Create controller for module
- `/quality:all` - Run quality gates before committing

## Agent Reference

- `@back-end-coding-agent` - Specialized agent for backend module creation

## Skill Reference

This command leverages the `back-end-structure-skill` for context. See `.claude/skills/back-end-structure-skill/SKILL.md` for detailed NestJS patterns and examples.

