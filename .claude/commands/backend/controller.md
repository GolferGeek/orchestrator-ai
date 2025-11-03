---
description: "Create a new NestJS controller for HTTP endpoints following Orchestrator AI patterns"
argument-hint: "[controller-name] [description]"
---

# Create Backend Controller

Create a new NestJS controller for HTTP endpoints following Orchestrator AI's strict patterns. Controllers handle HTTP requests and delegate to services.

**Usage:** `/backend:controller [controller-name] [description]`

**Examples:**
- `/backend:controller user "Controller for user HTTP endpoints"`
- `/backend:controller` (interactive creation with agent)

## Process

### 1. Invoke Back-End Coding Agent

Invoke `@back-end-coding-agent` to guide the creation process:

```
@back-end-coding-agent

Create Controller Request:
- Controller Name: [controller-name]
- Description: [description]
- Endpoints: [what HTTP endpoints are needed]

Create NestJS controller for HTTP endpoints.
```

**The agent will:**
- Ask for controller details (name, endpoints, routes)
- Create controller file with proper structure
- Ensure controller delegates to service (thin layer)
- Ensure kebab-case file naming

### 2. Provide Controller Information

When prompted by the agent, provide:

**Controller Details:**
- Controller name (kebab-case, e.g., `user-management`)
- Description (what HTTP endpoints this controller handles)
- Routes needed (what paths and methods)
- Dependencies (what services are needed)

**HTTP Endpoints:**
- What routes are needed? (e.g., `/api/users`, `/api/users/:id`)
- What HTTP methods? (GET, POST, PUT, DELETE)
- What request/response types?
- What DTOs are needed?

### 3. Agent Creates Controller File

The agent will create:
- `apps/api/src/{controller-name}/{controller-name}.controller.ts` (or in appropriate module directory)

**Controller structure:**
```typescript
import { Controller, Get, Post, Body, Param, Logger } from '@nestjs/common';
import { {ServiceName}Service } from './{service-name}.service';
import { Create{Dto}Dto } from './dto/create-{dto}.dto';

@Controller('api/{route}')
export class {ControllerName}Controller {
  private readonly logger = new Logger({ControllerName}Controller.name);

  constructor(
    private readonly {serviceName}Service: {ServiceName}Service,
  ) {}

  @Get()
  async findAll(): Promise<{ResponseType}[]> {
    this.logger.log('Finding all');
    return this.{serviceName}Service.findAll();
  }

  @Post()
  async create(@Body() createDto: Create{Dto}Dto): Promise<{ResponseType}> {
    this.logger.log('Creating');
    return this.{serviceName}Service.create(createDto);
  }
}
```

### 4. Architecture Validation

**The agent ensures:**
- File uses kebab-case naming
- Controller is thin (delegates to service)
- Proper route decorators (`@Get`, `@Post`, etc.)
- Proper DTOs for request/response validation
- Logger for logging

### 5. Output Summary

```
✅ Backend Controller Created Successfully

📦 Controller: user-management.controller.ts
📄 Location: apps/api/src/user-management/user-management.controller.ts

📋 HTTP Endpoints:
   ✅ GET /api/users - Get all users
   ✅ GET /api/users/:id - Get user by ID
   ✅ POST /api/users - Create user
   ✅ PUT /api/users/:id - Update user
   ✅ DELETE /api/users/:id - Delete user

📋 Architecture Compliance:
   ✅ Kebab-case file naming
   ✅ Thin controller (delegates to service)
   ✅ Proper route decorators
   ✅ DTOs for validation
   ✅ Logger configured

📋 Service Integration:
   ✅ Uses UserManagementService
   ✅ Delegates business logic to service

📤 Next Steps:
   1. Create DTOs if needed
   2. Register in module: /backend:module user-management
   3. Test endpoints
   4. Run quality gates: /quality:all
```

## Important Notes

- **CRITICAL**: Files must use kebab-case naming (e.g., `user-management.controller.ts`)
- Controllers are thin (delegate to services, no business logic)
- Controllers handle HTTP routing and request/response
- Use DTOs for request/response validation
- Use Logger for logging HTTP requests

## Controller Pattern

**✅ CORRECT:**
- Kebab-case file names
- Thin controller (delegates to service)
- Proper route decorators
- DTOs for validation
- Logger for logging

**❌ WRONG:**
- PascalCase or camelCase file names
- Business logic in controller
- Missing route decorators
- Direct database access (use service)

## Related Commands

- `/backend:module` - Create module for controller
- `/backend:service` - Create service that controller uses
- `/quality:all` - Run quality gates before committing

## Agent Reference

- `@back-end-coding-agent` - Specialized agent for backend controller creation

## Skill Reference

This command leverages the `back-end-structure-skill` for context. See `.claude/skills/back-end-structure-skill/SKILL.md` for detailed NestJS patterns and examples.

