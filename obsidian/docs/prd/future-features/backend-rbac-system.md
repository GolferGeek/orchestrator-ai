# Backend Role-Based Access Control (RBAC) System Implementation

**Date**: September 5, 2025  
**Status**: Future Feature  
**Priority**: Medium  
**Complexity**: High  

## 🎯 **Problem Statement**

We currently have a sophisticated frontend RBAC system with 6 roles and 18 granular permissions hardcoded in TypeScript, but **zero backend infrastructure** to support it. This creates several issues:

### **Current State Issues:**
- **Frontend-only permissions** - easily bypassed by API calls
- **No centralized permission management** - all logic hardcoded in frontend
- **No user management API** - can't create users with specific roles programmatically
- **No audit trail** - no tracking of who has what permissions or when they changed
- **No role inheritance** - can't create hierarchical role structures
- **Security vulnerability** - permissions are enforced client-side only

### **The "Conglomeration of Coolness" Gap:**
The frontend has this beautiful permission system:
```typescript
enum UserRole {
  USER, ADMIN, DEVELOPER, EVALUATION_MONITOR, BETA_TESTER, SUPPORT
}

enum Permission {
  CREATE_USERS, READ_USERS, UPDATE_USERS, DELETE_USERS, MANAGE_USER_ROLES,
  CREATE_PII_PATTERNS, READ_PII_PATTERNS, UPDATE_PII_PATTERNS, DELETE_PII_PATTERNS,
  // ... 18 total permissions
}

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  // Elaborate mapping system
}
```

But the backend just has: `users.roles = '["admin"]'::jsonb` 🤷‍♂️

## 🚀 **Proposed Solution**

Build a comprehensive backend RBAC system that matches and extends the frontend capabilities.

## 📋 **Functional Requirements**

### **Core RBAC Database Schema**

#### **1. Permissions Table**
```sql
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'create_users'
    display_name VARCHAR(255), -- e.g., 'Create Users'
    description TEXT,
    category VARCHAR(50), -- e.g., 'user_management', 'pii_management'
    is_system BOOLEAN DEFAULT false, -- System permissions can't be deleted
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### **2. Roles Table**
```sql
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'admin'
    display_name VARCHAR(255), -- e.g., 'Administrator'
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- System roles can't be deleted
    parent_role_id UUID REFERENCES public.roles(id), -- Role hierarchy
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

#### **3. Role-Permission Junction Table**
```sql
CREATE TABLE public.role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES public.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);
```

#### **4. User-Role Junction Table**
```sql
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES public.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional role expiration
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id)
);
```

#### **5. Direct User Permissions (Override Table)**
```sql
CREATE TABLE public.user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT true, -- true = grant, false = deny (override)
    granted_by UUID REFERENCES public.users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    UNIQUE(user_id, permission_id)
);
```

#### **6. Enhanced Audit Logging**
```sql
CREATE TABLE public.rbac_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    target_user_id UUID REFERENCES public.users(id), -- User being modified
    action VARCHAR(100) NOT NULL, -- 'grant_role', 'revoke_permission', etc.
    resource_type VARCHAR(50), -- 'role', 'permission', 'user'
    resource_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### **API Endpoints**

#### **Permission Management**
- `GET /api/permissions` - List all permissions
- `POST /api/permissions` - Create new permission (admin only)
- `PUT /api/permissions/:id` - Update permission (admin only)
- `DELETE /api/permissions/:id` - Delete permission (admin only, non-system)

#### **Role Management**
- `GET /api/roles` - List all roles
- `POST /api/roles` - Create new role
- `PUT /api/roles/:id` - Update role
- `DELETE /api/roles/:id` - Delete role (non-system)
- `POST /api/roles/:id/permissions` - Assign permissions to role
- `DELETE /api/roles/:id/permissions/:permissionId` - Remove permission from role

#### **User Management (Enhanced)**
- `GET /api/users` - List users with roles/permissions
- `POST /api/users` - Create user with roles
- `PUT /api/users/:id/roles` - Assign/remove roles
- `PUT /api/users/:id/permissions` - Grant/revoke direct permissions
- `GET /api/users/:id/effective-permissions` - Get all user permissions (roles + direct)

#### **Permission Checking**
- `POST /api/auth/check-permission` - Check if user has specific permission
- `POST /api/auth/check-permissions` - Bulk permission checking
- `GET /api/auth/my-permissions` - Get current user's permissions

### **Backend Services**

#### **1. PermissionService**
```typescript
@Injectable()
export class PermissionService {
  async hasPermission(userId: string, permission: string): Promise<boolean>
  async getUserPermissions(userId: string): Promise<string[]>
  async getUserRoles(userId: string): Promise<Role[]>
  async getEffectivePermissions(userId: string): Promise<Permission[]>
  async checkMultiplePermissions(userId: string, permissions: string[]): Promise<Record<string, boolean>>
}
```

#### **2. RoleService**
```typescript
@Injectable()
export class RoleService {
  async createRole(roleData: CreateRoleDto): Promise<Role>
  async assignRoleToUser(userId: string, roleId: string, assignedBy: string): Promise<void>
  async removeRoleFromUser(userId: string, roleId: string): Promise<void>
  async getRoleHierarchy(): Promise<Role[]>
  async getInheritedPermissions(roleId: string): Promise<Permission[]>
}
```

#### **3. RBACMiddleware**
```typescript
@Injectable()
export class RBACGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean>
  // Integrates with existing @Roles() decorator
}
```

### **Migration Strategy**

#### **Phase 1: Database Schema**
- Create all RBAC tables
- Migrate existing `users.roles` data to new structure
- Seed system roles and permissions

#### **Phase 2: Backend Services**
- Implement core RBAC services
- Add permission checking middleware
- Update existing endpoints with permission checks

#### **Phase 3: Frontend Integration**
- Replace hardcoded permission mappings with API calls
- Add user management UI for admins
- Implement role assignment interfaces

#### **Phase 4: Advanced Features**
- Role hierarchy and inheritance
- Temporary permission grants
- Bulk permission operations

## 🔧 **Technical Requirements**

### **Performance Considerations**
- **Permission Caching**: Redis cache for user permissions (5-minute TTL)
- **Database Indexes**: Optimize permission checking queries
- **Bulk Operations**: Efficient role/permission assignment APIs

### **Security Requirements**
- **Audit Everything**: All permission changes logged with full context
- **Principle of Least Privilege**: Default deny, explicit grants
- **Session Invalidation**: Force re-auth when permissions change
- **API Rate Limiting**: Prevent permission enumeration attacks

### **Backward Compatibility**
- **Maintain `users.roles`**: Keep for simple role checks
- **Gradual Migration**: Both systems work during transition
- **Frontend Fallback**: Graceful degradation if RBAC API unavailable

## 📊 **Success Metrics**

### **Security Metrics**
- Zero permission bypass incidents
- 100% audit trail coverage for permission changes
- < 2% false permission denials

### **Performance Metrics**
- Permission checks < 50ms (99th percentile)
- User permission loading < 100ms
- Cache hit rate > 95%

### **Usability Metrics**
- Admin user management tasks < 3 clicks
- Role creation/modification < 2 minutes
- Permission troubleshooting < 5 minutes

## 🎯 **Business Value**

### **Security Improvements**
- **Real permission enforcement** (not just frontend)
- **Comprehensive audit trails** for compliance
- **Fine-grained access control** for enterprise customers

### **Operational Benefits**
- **Centralized user management** for admins
- **Role-based onboarding** for new team members
- **Temporary access grants** for contractors/consultants

### **Scalability**
- **Enterprise-ready RBAC** for larger organizations
- **API-driven permissions** for integrations
- **Hierarchical roles** for complex org structures

## 🚧 **Implementation Phases**

### **Phase 1: Foundation (2-3 weeks)**
- Database schema and migrations
- Core RBAC services
- Basic API endpoints

### **Phase 2: Integration (2-3 weeks)**
- Middleware integration
- Existing endpoint updates
- Permission caching

### **Phase 3: Management UI (2-3 weeks)**
- Admin interfaces for role/permission management
- User management enhancements
- Audit log viewing

### **Phase 4: Advanced Features (2-3 weeks)**
- Role hierarchy
- Temporary permissions
- Bulk operations
- Performance optimizations

## 🤔 **Open Questions**

1. **Role Hierarchy Depth**: How many levels of role inheritance do we need?
2. **Permission Granularity**: Are 18 permissions enough, or do we need more specific ones?
3. **Caching Strategy**: Redis vs in-memory vs database-only for permission checks?
4. **Migration Timing**: Big bang vs gradual rollout of new RBAC system?
5. **External Integration**: Do we need SAML/OAuth role mapping for enterprise customers?

## 💭 **Alternative Approaches**

### **Option A: Extend Current System**
- Keep `users.roles` as primary storage
- Add permission checking service that maps roles to permissions
- Simpler but less flexible

### **Option B: Use External RBAC Service**
- Integrate with Auth0, AWS Cognito, or similar
- Faster implementation but vendor lock-in

### **Option C: Hybrid Approach**
- Core roles in database, detailed permissions in config
- Balance between flexibility and simplicity

## 🎉 **Conclusion**

This PRD addresses the "conglomeration of coolness" gap by providing a comprehensive backend RBAC system that matches and extends our sophisticated frontend permission system. 

The implementation will transform our hardcoded TypeScript enums into a full-featured, database-backed, API-driven permission system suitable for enterprise use.

**Estimated Effort**: 8-12 weeks  
**Team Size**: 2-3 developers  
**Risk Level**: Medium (complexity in permission logic and migration)

---

*"From frontend fantasy to backend reality - let's make those permissions actually mean something!"* 🚀
