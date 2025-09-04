import { apiService } from './apiService';
import { UserRole } from '../stores/authStore';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  roles: UserRole[];
  createdAt: string;
  status: string;
}

export interface UpdateUserRolesRequest {
  roles: UserRole[];
  reason?: string;
}

export interface AddUserRoleRequest {
  role: UserRole;
  reason?: string;
}

export interface RemoveUserRoleRequest {
  reason?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName?: string;
  roles?: UserRole[];
  emailConfirm?: boolean;
}

export interface CreateUserResponse {
  id: string;
  email: string;
  displayName?: string;
  roles: UserRole[];
  emailConfirmationRequired: boolean;
  message: string;
}

export interface UserManagementResponse {
  success: boolean;
  message: string;
}

class UserManagementService {
  /**
   * Create new user (admin only)
   */
  async createUser(request: CreateUserRequest): Promise<CreateUserResponse> {
    try {
      const response = await apiService.axiosInstance.post('/auth/admin/users', request);
      return response.data;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const response = await apiService.axiosInstance.get('/auth/admin/users');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID (admin only)
   */
  async getUserById(userId: string): Promise<User> {
    try {
      const response = await apiService.axiosInstance.get(`/auth/admin/users/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user:', error);
      throw error;
    }
  }

  /**
   * Set user roles (admin only)
   */
  async setUserRoles(userId: string, request: UpdateUserRolesRequest): Promise<UserManagementResponse> {
    try {
      const response = await apiService.axiosInstance.put(`/auth/admin/users/${userId}/roles`, request);
      return response.data;
    } catch (error) {
      console.error('Failed to set user roles:', error);
      throw error;
    }
  }

  /**
   * Add role to user (admin only)
   */
  async addUserRole(userId: string, request: AddUserRoleRequest): Promise<UserManagementResponse> {
    try {
      const response = await apiService.axiosInstance.post(`/auth/admin/users/${userId}/roles`, request);
      return response.data;
    } catch (error) {
      console.error('Failed to add user role:', error);
      throw error;
    }
  }

  /**
   * Remove role from user (admin only)
   */
  async removeUserRole(userId: string, role: UserRole, request: RemoveUserRoleRequest): Promise<UserManagementResponse> {
    try {
      const response = await apiService.axiosInstance.delete(`/auth/admin/users/${userId}/roles/${role}`, {
        data: request
      });
      return response.data;
    } catch (error) {
      console.error('Failed to remove user role:', error);
      throw error;
    }
  }
}

export const userManagementService = new UserManagementService();
