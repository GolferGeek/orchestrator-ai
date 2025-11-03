---
description: "Create a new service file for API calls and business logic (updates stores)"
argument-hint: "[service-name] [description]"
---

# Create Frontend Service

Create a new service file for API calls and business logic. Services handle all API calls and update stores with responses.

**Usage:** `/frontend:service [service-name] [description]`

**Examples:**
- `/frontend:service user "Service for user API calls and profile management"`
- `/frontend:service` (interactive creation with agent)

## Process

### 1. Invoke Front-End Coding Agent

Invoke `@front-end-coding-agent` to guide the creation process:

```
@front-end-coding-agent

Create Service Request:
- Service Name: [service-name]
- Description: [description]
- API Endpoints: [what endpoints to call]

Create service file for API calls and business logic.
```

**The agent will:**
- Ask for service details (name, API endpoints, business logic)
- Create service file with proper structure
- Ensure service updates stores (not components directly)

### 2. Provide Service Information

When prompted by the agent, provide:

**Service Details:**
- Service name (camelCase, e.g., `user`)
- Description (what API calls this service handles)
- API endpoints needed (what endpoints to call)
- Business logic needed (what processing to do)

**API Configuration:**
- What endpoints are needed?
- What request/response types?
- What transport types to use?
- What error handling is needed?

### 3. Agent Creates Service File

The agent will create:
- `apps/web/src/services/{serviceName}/{serviceName}.service.ts` (or `{serviceName}.api.ts`)

**Service structure:**
```typescript
import { apiClient } from '@/services/api-client';
import { use{StoreName}Store } from '@/stores/{storeName}Store';
import { build{RequestType}Request } from '@/services/{serviceName}/builders/build.builder';

export class {ServiceName}Service {
  async fetchData(params: FetchParams): Promise<void> {
    const store = use{StoreName}Store();
    
    try {
      store.setLoading(true);
      store.setError(null);
      
      const request = build{RequestType}Request(params);
      const response = await apiClient.post('/api/endpoint', request);
      
      store.setData(response.data);
    } catch (error) {
      store.setError(error.message);
    } finally {
      store.setLoading(false);
    }
  }
}

export const {serviceName}Service = new {ServiceName}Service();
```

### 4. Architecture Validation

**The agent ensures:**
- Service handles all API calls
- Service updates stores (not components directly)
- Service uses transport types for request building
- Service handles errors and updates store
- Service sets loading states in store

### 5. Output Summary

```
✅ Frontend Service Created Successfully

📦 Service: user.service.ts
📄 Location: apps/web/src/services/user/user.service.ts

📋 Service Methods:
   ✅ fetchUser(id: string) - Fetches user data
   ✅ updateUser(id: string, data: UserData) - Updates user
   ✅ deleteUser(id: string) - Deletes user

📋 Architecture Compliance:
   ✅ Makes API calls
   ✅ Updates store state
   ✅ Uses transport types
   ✅ Handles errors
   ✅ Sets loading states

📋 Store Integration:
   ✅ Updates userStore
   ✅ Sets loading/error states
   ✅ Updates data state

📤 Next Steps:
   1. Use service in components: /frontend:component
   2. Test service calls
   3. Run quality gates: /quality:all
```

## Important Notes

- **CRITICAL**: Services handle ALL API calls and business logic
- Services update stores (components don't update stores directly)
- Services use transport types for request building
- Services handle errors and loading states
- Components call service methods (not API directly)

## Service Pattern

**✅ CORRECT:**
- Async methods that make API calls
- Update stores with responses
- Use transport types for requests
- Handle errors and loading states

**❌ WRONG:**
- Store state directly in service
- Skip store updates
- Call API directly from components

## Related Commands

- `/frontend:store` - Create store that service updates
- `/frontend:component` - Create component that uses service
- `/quality:all` - Run quality gates before committing

## Agent Reference

- `@front-end-coding-agent` - Specialized agent for frontend service creation

## Skill Reference

This command leverages the `front-end-structure-skill` for context. See `.claude/skills/front-end-structure-skill/SKILL.md` for detailed service patterns and examples.

