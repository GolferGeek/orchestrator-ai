import { Directive, DirectiveBinding } from 'vue';
import { useAuthStore, UserRole } from '@/stores/authStore';

export interface RoleGuardBinding {
  /** Roles required for access (user needs ANY of these roles) */
  roles?: UserRole[];
  /** Roles required for access (user needs ALL of these roles) */  
  allRoles?: UserRole[];
  /** Hide element instead of removing it from DOM */
  hide?: boolean;
  /** Disable element instead of hiding/removing */
  disable?: boolean;
  /** Custom class to add when access is denied */
  deniedClass?: string;
}

/**
 * Vue directive for role-based element protection
 * 
 * Usage examples:
 * v-role-guard="{ roles: ['admin'] }"
 * v-role-guard="{ roles: ['admin', 'developer'], hide: true }"
 * v-role-guard="{ allRoles: ['admin', 'developer'], disable: true }"
 */
export const roleGuard: Directive<HTMLElement, RoleGuardBinding> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<RoleGuardBinding>) {
    updateElementAccess(el, binding);
  },
  
  updated(el: HTMLElement, binding: DirectiveBinding<RoleGuardBinding>) {
    updateElementAccess(el, binding);
  }
};

function updateElementAccess(el: HTMLElement, binding: DirectiveBinding<RoleGuardBinding>) {
  const auth = useAuthStore();
  const options = binding.value || {};
  
  const {
    roles = [],
    allRoles = [],
    hide = false,
    disable = false,
    deniedClass = 'role-guard-denied'
  } = options;

  // Check if user has required access
  let hasAccess = true;
  
  if (roles.length > 0) {
    hasAccess = hasAccess && auth.hasAnyRole(roles);
  }
  
  if (allRoles.length > 0) {
    hasAccess = hasAccess && auth.hasAllRoles(allRoles);
  }

  // Store original display and disabled state if not already stored
  if (!el.dataset.originalDisplay) {
    el.dataset.originalDisplay = el.style.display || '';
  }
  if (!el.dataset.originalDisabled) {
    el.dataset.originalDisabled = (el as HTMLInputElement).disabled ? 'true' : 'false';
  }

  if (hasAccess) {
    // Grant access - restore original state
    if (hide) {
      el.style.display = el.dataset.originalDisplay;
    } else if (!hide && !disable) {
      // Remove from DOM protection - show element
      el.style.display = el.dataset.originalDisplay;
    }
    
    if (disable) {
      (el as HTMLInputElement).disabled = el.dataset.originalDisabled === 'true';
    }
    
    el.classList.remove(deniedClass);
    
    // Remove aria-hidden if it was set by this directive
    if (el.dataset.roleGuardHidden === 'true') {
      el.removeAttribute('aria-hidden');
      delete el.dataset.roleGuardHidden;
    }
  } else {
    // Deny access
    if (hide) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.dataset.roleGuardHidden = 'true';
    } else if (disable) {
      (el as HTMLInputElement).disabled = true;
      el.classList.add(deniedClass);
    } else {
      // Remove from DOM (default behavior)
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.dataset.roleGuardHidden = 'true';
    }
  }
}

// Helper function to register the directive
export function registerRoleGuardDirective(app: { directive: (name: string, directive: Directive) => void }) {
  app.directive('role-guard', roleGuard);
}
