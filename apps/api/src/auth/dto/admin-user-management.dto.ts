import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsEmail,
  MinLength,
} from 'class-validator';
import { UserRole } from '../decorators/roles.decorator';

export class UserListResponseDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'User display name', required: false })
  displayName?: string;

  @ApiProperty({
    description: 'Array of user roles',
    enum: UserRole,
    isArray: true,
    example: [UserRole.USER, UserRole.ADMIN],
  })
  roles!: UserRole[];

  @ApiProperty({ description: 'User creation timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'User status' })
  status!: string;
}

export class UpdateUserRolesDto {
  @ApiProperty({
    description: 'Array of roles to assign to the user',
    enum: UserRole,
    isArray: true,
    example: [UserRole.USER, UserRole.ADMIN],
  })
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles!: UserRole[];

  @ApiProperty({
    description: 'Optional reason for role change',
    required: false,
    example: 'Promoting user to admin for system maintenance',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AddUserRoleDto {
  @ApiProperty({
    description: 'Role to add to the user',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({
    description: 'Optional reason for adding role',
    required: false,
    example: 'Granting admin access for project management',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RemoveUserRoleDto {
  @ApiProperty({
    description: 'Role to remove from the user',
    enum: UserRole,
    example: UserRole.ADMIN,
  })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({
    description: 'Optional reason for removing role',
    required: false,
    example: 'User no longer needs admin access',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'newuser@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Temporary password (user should change on first login)',
    example: 'TempPass123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({
    description: 'User display name',
    required: false,
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({
    description: 'Initial roles to assign to the user',
    enum: UserRole,
    isArray: true,
    example: [UserRole.USER],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];

  @ApiProperty({
    description: 'Force user to change password on first login',
    example: true,
    required: false,
  })
  @IsOptional()
  emailConfirm?: boolean;

  @ApiProperty({
    description: 'Namespace access for the user',
    example: ['my-org'],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  namespaceAccess?: string[];
}

export class CreateUserResponseDto {
  @ApiProperty({ description: 'Created user ID' })
  id!: string;

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'User display name', required: false })
  displayName?: string;

  @ApiProperty({
    description: 'Assigned roles',
    enum: UserRole,
    isArray: true,
  })
  roles!: UserRole[];

  @ApiProperty({ description: 'Whether email confirmation is required' })
  emailConfirmationRequired!: boolean;

  @ApiProperty({ description: 'Success message' })
  message!: string;

  @ApiProperty({
    description: 'Namespace access for the user',
    example: ['my-org'],
    required: false,
    isArray: true,
  })
  namespaceAccess?: string[];
}
