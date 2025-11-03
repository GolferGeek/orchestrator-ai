---
description: "Create a new NestJS service with business logic following Orchestrator AI patterns"
argument-hint: "[service-name] [description]"
---

# Create Backend Service

Create a new NestJS service containing business logic following Orchestrator AI's strict patterns. Services contain business logic, not HTTP handling.

**Usage:** `/backend:service [service-name] [description]`

**Examples:**
- `/backend:service user "Service for user business logic"`
- `/backend:service` (interactive creation with agent)

## Process

### 1. Invoke Back-End Coding Agent

Invoke `@back-end-coding-agent` to guide the creation process:

```
@back-end-coding-agent

Create Service Request:
- Service Name: [service-name]
- Description: [description]
- Business Logic: [what logic to implement]

Create NestJS service with business logic.
```

**The agent will:**
- Ask for service details (name, business logic, dependencies)
- Create service file with proper structure
- Ensure service follows Injectable pattern
- Ensure kebab-case file naming

### 2. Provide Service Information

When prompted by the agent, provide:

**Service Details:**
- Service name (kebab-case, e.g., `user-management`)
- Description (what business logic this service handles)
- Methods needed (what operations to perform)
- Dependencies (what other services/repositories are needed)

**Business Logic:**
- What operations are needed?
- What data processing is required?
- What external services are called?
- What error handling is needed?

### 3. Agent Creates Service File

The agent will create:
- `apps/api/src/{service-name}/{service-name}.service.ts` (or in appropriate module directory)

**Service structure:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { {Dependency}Service } from '../{dependency}/{dependency}.service';

@Injectable()
export class {ServiceName}Service {
  private readonly logger = new Logger({ServiceName}Service.name);

  constructor(
    private readonly {dependency}Service: {Dependency}Service,
  ) {}

  async doSomething(data: string): Promise<string> {
    this.logger.log(`Doing something with: ${data}`);
    // Business logic here
    return `Processed: ${data}`;
  }
}
```

### 4. Architecture Validation

**The agent ensures:**
- File uses kebab-case naming
- Service uses `@Injectable()` decorator
- Service contains business logic (not HTTP handling)
- Proper dependency injection
- Logger for logging

### 5. Output Summary

```
✅ Backend Service Created Successfully

📦 Service: user-management.service.ts
📄 Location: apps/api/src/user-management/user-management.service.ts

📋 Service Methods:
   ✅ createUser(data: CreateUserDto) - Creates user
   ✅ getUserById(id: string) - Gets user by ID
   ✅ updateUser(id: string, data: UpdateUserDto) - Updates user
   ✅ deleteUser(id: string) - Deletes user

📋 Architecture Compliance:
   ✅ Kebab-case file naming
   ✅ @Injectable() decorator
   ✅ Business logic only (no HTTP)
   ✅ Proper dependency injection
   ✅ Logger configured

📋 Dependencies:
   ✅ Injected: UserRepository, SupabaseService

📤 Next Steps:
   1. Use service in controller: /backend:controller user-management
   2. Register in module: /backend:module user-management
   3. Run quality gates: /quality:all
```

## Important Notes

- **CRITICAL**: Files must use kebab-case naming (e.g., `user-management.service.ts`)
- Services contain business logic (not HTTP handling)
- Services use `@Injectable()` decorator
- Services inject dependencies via constructor
- Use Logger for logging operations

## Service Pattern

**✅ CORRECT:**
- Kebab-case file names
- `@Injectable()` decorator
- Business logic only
- Dependency injection
- Logger for logging

**❌ WRONG:**
- PascalCase or camelCase file names
- HTTP handling in service
- Missing `@Injectable()` decorator
- Direct HTTP calls (use HttpModule)

## Related Commands

- `/backend:module` - Create module for service
- `/backend:controller` - Create controller that uses service
- `/quality:all` - Run quality gates before committing

## Agent Reference

- `@back-end-coding-agent` - Specialized agent for backend service creation

## Skill Reference

This command leverages the `back-end-structure-skill` for context. See `.claude/skills/back-end-structure-skill/SKILL.md` for detailed NestJS patterns and examples.

