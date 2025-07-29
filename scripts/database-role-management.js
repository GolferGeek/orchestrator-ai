#!/usr/bin/env node

/**
 * Database Role Management Script
 * 
 * This script provides utilities for managing user roles in the users table.
 * It supports adding, removing, and bulk updating user roles for admin evaluation access.
 * 
 * Usage:
 *   node scripts/database-role-management.js --help
 *   node scripts/database-role-management.js assign-role --email user@example.com --role admin
 *   node scripts/database-role-management.js bulk-assign --emails users.txt --role evaluation-monitor
 *   node scripts/database-role-management.js list-admins
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Valid roles that can be assigned
const VALID_ROLES = [
  'user',
  'admin', 
  'developer',
  'evaluation-monitor',
  'beta-tester',
  'support'
];

/**
 * Display help information
 */
function showHelp() {
  console.log(`
🔐 Database Role Management Utility

Available Commands:
  assign-role     Assign a role to a user by email
  remove-role     Remove a role from a user by email  
  set-roles       Set exact roles for a user (replaces existing)
  bulk-assign     Assign role to multiple users from file
  bulk-remove     Remove role from multiple users from file
  list-users      List all users with their roles
  list-admins     List all admin users
  list-monitors   List all evaluation monitor users
  audit-log       Show recent role change audit log
  help           Show this help message

Options:
  --email <email>     User email address
  --role <role>       Role to assign/remove (${VALID_ROLES.join(', ')})
  --roles <roles>     Comma-separated list of roles
  --emails <file>     File containing email addresses (one per line)
  --limit <number>    Limit number of results (default: 50)
  --admin <email>     Admin user making the change (for audit log)
  --reason <text>     Reason for role change (for audit log)

Examples:
  node scripts/database-role-management.js assign-role --email john@example.com --role admin
  node scripts/database-role-management.js set-roles --email jane@example.com --roles "user,evaluation-monitor"
  node scripts/database-role-management.js bulk-assign --emails admins.txt --role admin
  node scripts/database-role-management.js list-users --limit 10
  node scripts/database-role-management.js audit-log --limit 20
`);
}

/**
 * Validate that a role is in the allowed list
 */
function validateRole(role) {
  if (!VALID_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}. Valid roles are: ${VALID_ROLES.join(', ')}`);
  }
}

/**
 * Get user by email
 */
async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name, roles, created_at')
    .eq('email', email)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`User not found: ${email}`);
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

/**
 * Assign a role to a user
 */
async function assignRole(email, role, adminEmail = null, reason = null) {
  validateRole(role);
  
  const user = await getUserByEmail(email);
  const currentRoles = user.roles || ['user'];
  
  if (currentRoles.includes(role)) {
    console.log(`✅ User ${email} already has role: ${role}`);
    return;
  }

  const newRoles = [...currentRoles, role];
  
  const { error } = await supabase
    .from('users')
    .update({ roles: newRoles })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to assign role: ${error.message}`);
  }

  // Log the change if admin info provided
  if (adminEmail || reason) {
    const adminUser = adminEmail ? await getUserByEmail(adminEmail) : null;
    await logRoleChange(user.id, adminUser?.id, 'add_role', currentRoles, newRoles, role, reason);
  }

  console.log(`✅ Assigned role "${role}" to user: ${email}`);
  console.log(`   Previous roles: [${currentRoles.join(', ')}]`);
  console.log(`   New roles: [${newRoles.join(', ')}]`);
}

/**
 * Remove a role from a user
 */
async function removeRole(email, role, adminEmail = null, reason = null) {
  validateRole(role);
  
  const user = await getUserByEmail(email);
  const currentRoles = user.roles || ['user'];
  
  if (!currentRoles.includes(role)) {
    console.log(`ℹ️  User ${email} doesn't have role: ${role}`);
    return;
  }

  let newRoles = currentRoles.filter(r => r !== role);
  
  // Ensure user always has at least 'user' role
  if (newRoles.length === 0 || !newRoles.includes('user')) {
    newRoles = ['user'];
  }
  
  const { error } = await supabase
    .from('users')
    .update({ roles: newRoles })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to remove role: ${error.message}`);
  }

  // Log the change if admin info provided
  if (adminEmail || reason) {
    const adminUser = adminEmail ? await getUserByEmail(adminEmail) : null;
    await logRoleChange(user.id, adminUser?.id, 'remove_role', currentRoles, newRoles, role, reason);
  }

  console.log(`✅ Removed role "${role}" from user: ${email}`);
  console.log(`   Previous roles: [${currentRoles.join(', ')}]`);
  console.log(`   New roles: [${newRoles.join(', ')}]`);
}

/**
 * Set exact roles for a user (replaces existing roles)
 */
async function setRoles(email, roles, adminEmail = null, reason = null) {
  const roleArray = roles.split(',').map(r => r.trim());
  roleArray.forEach(validateRole);
  
  // Ensure 'user' role is always included
  if (!roleArray.includes('user')) {
    roleArray.unshift('user');
  }
  
  const user = await getUserByEmail(email);
  const currentRoles = user.roles || ['user'];
  
  const { error } = await supabase
    .from('users')
    .update({ roles: roleArray })
    .eq('id', user.id);

  if (error) {
    throw new Error(`Failed to set roles: ${error.message}`);
  }

  // Log the change if admin info provided
  if (adminEmail || reason) {
    const adminUser = adminEmail ? await getUserByEmail(adminEmail) : null;
    await logRoleChange(user.id, adminUser?.id, 'set_roles', currentRoles, roleArray, null, reason);
  }

  console.log(`✅ Set roles for user: ${email}`);
  console.log(`   Previous roles: [${currentRoles.join(', ')}]`);
  console.log(`   New roles: [${roleArray.join(', ')}]`);
}

/**
 * Bulk assign role to multiple users from file
 */
async function bulkAssignRole(emailsFile, role, adminEmail = null, reason = null) {
  validateRole(role);
  
  if (!fs.existsSync(emailsFile)) {
    throw new Error(`File not found: ${emailsFile}`);
  }

  const emails = fs.readFileSync(emailsFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.includes('@'));

  console.log(`📂 Processing ${emails.length} email addresses from ${emailsFile}`);
  console.log(`🎯 Assigning role: ${role}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const email of emails) {
    try {
      await assignRole(email, role, adminEmail, reason);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to assign role to ${email}: ${error.message}`);
      errorCount++;
    }
    console.log(''); // Add spacing between operations
  }

  console.log(`\n📊 Bulk Assignment Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📧 Total: ${emails.length}`);
}

/**
 * Bulk remove role from multiple users from file
 */
async function bulkRemoveRole(emailsFile, role, adminEmail = null, reason = null) {
  validateRole(role);
  
  if (!fs.existsSync(emailsFile)) {
    throw new Error(`File not found: ${emailsFile}`);
  }

  const emails = fs.readFileSync(emailsFile, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.includes('@'));

  console.log(`📂 Processing ${emails.length} email addresses from ${emailsFile}`);
  console.log(`🎯 Removing role: ${role}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const email of emails) {
    try {
      await removeRole(email, role, adminEmail, reason);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to remove role from ${email}: ${error.message}`);
      errorCount++;
    }
    console.log(''); // Add spacing between operations
  }

  console.log(`\n📊 Bulk Removal Summary:`);
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${errorCount}`);
  console.log(`   📧 Total: ${emails.length}`);
}

/**
 * List all users with their roles
 */
async function listUsers(limit = 50) {
  const { data, error } = await supabase
    .from('users')
    .select('email, display_name, roles, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  console.log(`👥 Users (showing first ${Math.min(limit, data.length)} of ${data.length}):\n`);
  
  data.forEach(user => {
    const roles = (user.roles || ['user']).join(', ');
    const name = user.display_name || 'No name';
    const date = new Date(user.created_at).toLocaleDateString();
    
    console.log(`📧 ${user.email}`);
    console.log(`   👤 Name: ${name}`);
    console.log(`   🎭 Roles: [${roles}]`);
    console.log(`   📅 Created: ${date}\n`);
  });
}

/**
 * List admin users
 */
async function listAdmins(limit = 50) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('email, display_name, roles, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch admin users: ${error.message}`);
  }

  console.log(`👑 Admin Users (${data.length} found):\n`);
  
  data.forEach(user => {
    const roles = (user.roles || ['user']).join(', ');
    const name = user.display_name || 'No name';
    const date = new Date(user.created_at).toLocaleDateString();
    
    console.log(`📧 ${user.email}`);
    console.log(`   👤 Name: ${name}`);
    console.log(`   🎭 Roles: [${roles}]`);
    console.log(`   📅 Created: ${date}\n`);
  });
}

/**
 * List evaluation monitor users
 */
async function listMonitors(limit = 50) {
  const { data, error } = await supabase
    .from('evaluation_monitor_users')
    .select('email, display_name, roles, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch evaluation monitor users: ${error.message}`);
  }

  console.log(`📊 Evaluation Monitor Users (${data.length} found):\n`);
  
  data.forEach(user => {
    const roles = (user.roles || ['user']).join(', ');
    const name = user.display_name || 'No name';
    const date = new Date(user.created_at).toLocaleDateString();
    
    console.log(`📧 ${user.email}`);
    console.log(`   👤 Name: ${name}`);
    console.log(`   🎭 Roles: [${roles}]`);
    console.log(`   📅 Created: ${date}\n`);
  });
}

/**
 * Log a role change in the audit log
 */
async function logRoleChange(userId, adminUserId, action, oldRoles, newRoles, roleChanged = null, reason = null) {
  const { error } = await supabase
    .from('role_audit_log')
    .insert({
      user_id: userId,
      admin_user_id: adminUserId || userId,
      action: action,
      old_roles: oldRoles,
      new_roles: newRoles,
      role_changed: roleChanged,
      reason: reason
    });

  if (error) {
    console.warn(`⚠️  Failed to log role change: ${error.message}`);
  }
}

/**
 * Show role change audit log
 */
async function showAuditLog(limit = 20) {
  const { data, error } = await supabase
    .from('role_audit_log')
    .select(`
      *,
      user:profiles!role_audit_log_user_id_fkey(email, display_name),
      admin:profiles!role_audit_log_admin_user_id_fkey(email, display_name)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch audit log: ${error.message}`);
  }

  console.log(`📋 Role Change Audit Log (showing last ${Math.min(limit, data.length)} entries):\n`);
  
  data.forEach(entry => {
    const date = new Date(entry.created_at).toLocaleString();
    const userEmail = entry.user?.email || 'Unknown';
    const adminEmail = entry.admin?.email || 'System';
    const oldRoles = (entry.old_roles || []).join(', ');
    const newRoles = (entry.new_roles || []).join(', ');
    const actionIcon = entry.action === 'add_role' ? '➕' : entry.action === 'remove_role' ? '➖' : '🔄';
    
    console.log(`${actionIcon} ${entry.action.toUpperCase()}`);
    console.log(`   👤 User: ${userEmail}`);
    console.log(`   👑 Admin: ${adminEmail}`);
    console.log(`   🎭 Old roles: [${oldRoles}]`);
    console.log(`   🎭 New roles: [${newRoles}]`);
    if (entry.role_changed) {
      console.log(`   🔄 Changed role: ${entry.role_changed}`);
    }
    if (entry.reason) {
      console.log(`   📝 Reason: ${entry.reason}`);
    }
    console.log(`   📅 Date: ${date}\n`);
  });
}

/**
 * Main CLI handler
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse command line arguments
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      options[key] = value;
    }
  }

  try {
    switch (command) {
      case 'assign-role':
        if (!options.email || !options.role) {
          throw new Error('--email and --role are required');
        }
        await assignRole(options.email, options.role, options.admin, options.reason);
        break;

      case 'remove-role':
        if (!options.email || !options.role) {
          throw new Error('--email and --role are required');
        }
        await removeRole(options.email, options.role, options.admin, options.reason);
        break;

      case 'set-roles':
        if (!options.email || !options.roles) {
          throw new Error('--email and --roles are required');
        }
        await setRoles(options.email, options.roles, options.admin, options.reason);
        break;

      case 'bulk-assign':
        if (!options.emails || !options.role) {
          throw new Error('--emails and --role are required');
        }
        await bulkAssignRole(options.emails, options.role, options.admin, options.reason);
        break;

      case 'bulk-remove':
        if (!options.emails || !options.role) {
          throw new Error('--emails and --role are required');
        }
        await bulkRemoveRole(options.emails, options.role, options.admin, options.reason);
        break;

      case 'list-users':
        await listUsers(parseInt(options.limit) || 50);
        break;

      case 'list-admins':
        await listAdmins(parseInt(options.limit) || 50);
        break;

      case 'list-monitors':
        await listMonitors(parseInt(options.limit) || 50);
        break;

      case 'audit-log':
        await showAuditLog(parseInt(options.limit) || 20);
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error('❌ Unknown command:', command);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the CLI
if (require.main === module) {
  main();
}

module.exports = {
  assignRole,
  removeRole,
  setRoles,
  bulkAssignRole,
  bulkRemoveRole,
  listUsers,
  listAdmins,
  listMonitors,
  showAuditLog
};