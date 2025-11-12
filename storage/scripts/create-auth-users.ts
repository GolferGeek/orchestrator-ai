import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.join(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:7010';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const users = [
  {
    id: 'b29a590e-b07f-49df-a25b-574c956b5035',
    email: 'demo.user@orchestratorai.io',
    password: 'DemoUser123!',
    display_name: 'Demo User',
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    email: 'admin@orchestratorai.io',
    password: 'Admin123!',
    display_name: 'Admin User',
  },
  {
    id: 'c4d5e6f7-8901-2345-6789-abcdef012345',
    email: 'golfergeek@orchestratorai.io',
    password: 'GolferGeek123!',
    display_name: 'GolferGeek',
  },
];

async function createAuthUsers() {
  console.log('🔐 Creating auth users...\n');

  for (const user of users) {
    try {
      // Check if user already exists
      const { data: existing } = await supabase.auth.admin.getUserById(user.id);
      
      if (existing.user) {
        console.log(`⚠️  User ${user.email} already exists in auth.users, skipping...`);
        continue;
      }

      // Create user with admin API
      const { data: authUser, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          display_name: user.display_name,
        },
      });

      if (error) {
        console.error(`❌ Failed to create ${user.email}: ${error.message}`);
        continue;
      }

      // Update the ID to match public.users if it doesn't match
      if (authUser.user.id !== user.id) {
        console.log(`⚠️  ID mismatch for ${user.email}. Created ID: ${authUser.user.id}, Expected: ${user.id}`);
        // Note: Supabase doesn't allow changing auth.users.id directly
        // We'll need to delete and recreate, or update public.users to match
        console.log(`   You may need to update public.users.id to ${authUser.user.id}`);
      } else {
        console.log(`✅ Created auth user: ${user.email} (${user.id})`);
      }
    } catch (err) {
      console.error(`❌ Error creating ${user.email}:`, err);
    }
  }

  console.log('\n✅ Auth users creation complete!');
}

createAuthUsers().catch(console.error);
