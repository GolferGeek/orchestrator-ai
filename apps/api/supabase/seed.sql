-- Seed file to create demo users in auth system
-- This runs after migrations and ensures demo users exist for development

-- Create demo user in auth.users table
-- Note: This uses Supabase's internal auth functions
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    'authenticated',
    'authenticated',
    'demo.user@playground.com',
    extensions.crypt('demouser', extensions.gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Create corresponding identity record
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    '2f1ee5e9-cae2-4f66-a1e0-bd2c02a11321',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    '{"sub": "b29a590e-b07f-49df-a25b-574c956b5035", "email": "demo.user@playground.com", "email_verified": true, "phone_verified": false}'::jsonb,
    'email',
    'b29a590e-b07f-49df-a25b-574c956b5035',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create the demo user in public.users table
INSERT INTO public.users (id, email, display_name, roles)
VALUES ('b29a590e-b07f-49df-a25b-574c956b5035', 'demo.user@playground.com', 'Demo User', '["user", "admin"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    roles = EXCLUDED.roles;

-- Verify the setup and create sample data
DO $$
DECLARE
    demo_user_id UUID := 'b29a590e-b07f-49df-a25b-574c956b5035';
    conv_id UUID;
    deliverable_id UUID;
    task_id UUID;
    usage_id UUID;
    i INTEGER;
    j INTEGER;
    d INTEGER;
BEGIN
    -- Verify demo user exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo.user@playground.com') AND
       EXISTS (SELECT 1 FROM public.users WHERE email = 'demo.user@playground.com') THEN
        RAISE NOTICE 'Demo user successfully created in both auth.users and public.users';
    ELSE
        RAISE WARNING 'Demo user creation may have failed - check both tables';
        RETURN;
    END IF;

    -- Create comprehensive sample data
    RAISE NOTICE 'Creating sample conversations, deliverables, tasks, and LLM usage data...';

    -- Create 10 sample conversations with deliverables, tasks, and LLM usage
    FOR i IN 1..10 LOOP
        -- Generate conversation ID
        conv_id := gen_random_uuid();
        
        -- Create conversation
        INSERT INTO public.conversations (
            id,
            user_id,
            agent_name,
            agent_type,
            started_at,
            last_active_at,
            created_at,
            updated_at,
            metadata
        ) VALUES (
            conv_id,
            demo_user_id,
            CASE i
                WHEN 1 THEN 'Dashboard Builder Agent'
                WHEN 2 THEN 'Authentication Agent'
                WHEN 3 THEN 'Database Designer Agent'
                WHEN 4 THEN 'API Security Agent'
                WHEN 5 THEN 'Mobile UX Agent'
                WHEN 6 THEN 'Payment Integration Agent'
                WHEN 7 THEN 'Email Template Agent'
                WHEN 8 THEN 'Search Optimization Agent'
                WHEN 9 THEN 'Performance Agent'
                WHEN 10 THEN 'Security Audit Agent'
            END,
            'conversation_agent',
            NOW() - INTERVAL '1 day' * (10 - i),
            NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '2 hours',
            NOW() - INTERVAL '1 day' * (10 - i),
            NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '2 hours',
            jsonb_build_object(
                'title', CASE i
                    WHEN 1 THEN 'Build React Dashboard Component'
                    WHEN 2 THEN 'Implement User Authentication System'
                    WHEN 3 THEN 'Design Database Schema'
                    WHEN 4 THEN 'Create API Rate Limiting Strategy'
                    WHEN 5 THEN 'Develop Mobile App Navigation'
                    WHEN 6 THEN 'Setup Payment Integration'
                    WHEN 7 THEN 'Build Email Template System'
                    WHEN 8 THEN 'Implement Search Functionality'
                    WHEN 9 THEN 'Optimize Application Performance'
                    WHEN 10 THEN 'Conduct Security Audit'
                END,
                'project_type', CASE i % 3 WHEN 0 THEN 'web_app' WHEN 1 THEN 'mobile_app' ELSE 'api' END,
                'complexity', CASE i % 3 WHEN 0 THEN 'high' WHEN 1 THEN 'medium' ELSE 'low' END,
                'priority', CASE i % 3 WHEN 0 THEN 'urgent' WHEN 1 THEN 'normal' ELSE 'low' END
            )
        );

        -- Create 1 deliverable per conversation (due to unique constraint)
        FOR d IN 1..1 LOOP
            deliverable_id := gen_random_uuid();
            
            INSERT INTO public.deliverables (
                id,
                conversation_id,
                user_id,
                project_step_id,
                agent_name,
                title,
                type,
                created_at,
                updated_at
            ) VALUES (
                deliverable_id,
                conv_id,
                demo_user_id,
                NULL,
                CASE i
                    WHEN 1 THEN 'Dashboard Builder Agent'
                    WHEN 2 THEN 'Authentication Agent'
                    WHEN 3 THEN 'Database Designer Agent'
                    WHEN 4 THEN 'API Security Agent'
                    WHEN 5 THEN 'Mobile UX Agent'
                    WHEN 6 THEN 'Payment Integration Agent'
                    WHEN 7 THEN 'Email Template Agent'
                    WHEN 8 THEN 'Search Optimization Agent'
                    WHEN 9 THEN 'Performance Agent'
                    WHEN 10 THEN 'Security Audit Agent'
                END,
                CASE i
                    WHEN 1 THEN 'Dashboard Component Specification'
                    WHEN 2 THEN 'Authentication Implementation Guide'
                    WHEN 3 THEN 'Database Schema Documentation'
                    WHEN 4 THEN 'Rate Limiting Strategy Document'
                    WHEN 5 THEN 'Mobile Navigation Wireframes'
                    WHEN 6 THEN 'Payment Integration Setup Guide'
                    WHEN 7 THEN 'Email Template Design System'
                    WHEN 8 THEN 'Search Algorithm Documentation'
                    WHEN 9 THEN 'Performance Optimization Report'
                    WHEN 10 THEN 'Security Audit Checklist'
                END,
                CASE i
                    WHEN 1 THEN 'specification'
                    WHEN 2 THEN 'guide'
                    WHEN 3 THEN 'documentation'
                    WHEN 4 THEN 'strategy'
                    WHEN 5 THEN 'wireframes'
                    WHEN 6 THEN 'guide'
                    WHEN 7 THEN 'design_system'
                    WHEN 8 THEN 'documentation'
                    WHEN 9 THEN 'report'
                    WHEN 10 THEN 'checklist'
                END,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '30 minutes',
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '90 minutes'
            );

        END LOOP;

        -- Create 2-4 tasks per conversation
        FOR j IN 1..(2 + (i % 3)) LOOP
            task_id := gen_random_uuid();
            
            INSERT INTO public.tasks (
                id,
                user_id,
                conversation_id,
                method,
                prompt,
                response,
                status,
                started_at,
                completed_at,
                metadata,
                created_at,
                updated_at
            ) VALUES (
                task_id,
                demo_user_id,
                conv_id,
                CASE j
                    WHEN 1 THEN 'setup_project_structure'
                    WHEN 2 THEN 'implement_core_functionality'
                    WHEN 3 THEN 'add_testing_validation'
                    WHEN 4 THEN 'deploy_and_monitor'
                END,
                CASE j
                    WHEN 1 THEN 'Initialize project with proper folder structure, dependencies, and configuration files'
                    WHEN 2 THEN 'Develop the main features and business logic according to specifications'
                    WHEN 3 THEN 'Create comprehensive test suite and implement validation rules'
                    WHEN 4 THEN 'Deploy to production environment and set up monitoring systems'
                END,
                CASE j
                    WHEN 1 THEN 'Project structure initialized successfully with all required dependencies and configuration files.'
                    WHEN 2 THEN CASE i % 3 WHEN 0 THEN 'Core functionality implemented and tested.' WHEN 1 THEN 'Implementation in progress...' ELSE '' END
                    WHEN 3 THEN CASE i % 4 WHEN 0 THEN 'Testing suite completed with 95% coverage.' WHEN 1 THEN 'Writing tests...' ELSE '' END
                    WHEN 4 THEN ''
                END,
                CASE j
                    WHEN 1 THEN 'completed'
                    WHEN 2 THEN CASE i % 3 WHEN 0 THEN 'completed' WHEN 1 THEN 'in_progress' ELSE 'pending' END
                    WHEN 3 THEN CASE i % 4 WHEN 0 THEN 'completed' WHEN 1 THEN 'in_progress' ELSE 'pending' END
                    WHEN 4 THEN 'pending'
                END,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j,
                CASE j
                    WHEN 1 THEN NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '30 minutes'
                    WHEN 2 THEN CASE i % 3 WHEN 0 THEN NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '45 minutes' ELSE NULL END
                    WHEN 3 THEN CASE i % 4 WHEN 0 THEN NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '60 minutes' ELSE NULL END
                    WHEN 4 THEN NULL
                END,
                jsonb_build_object(
                    'title', CASE j
                        WHEN 1 THEN 'Setup project structure'
                        WHEN 2 THEN 'Implement core functionality'
                        WHEN 3 THEN 'Add testing and validation'
                        WHEN 4 THEN 'Deploy and monitor'
                    END,
                    'priority', CASE j
                        WHEN 1 THEN 'high'
                        WHEN 2 THEN 'high'
                        WHEN 3 THEN 'medium'
                        WHEN 4 THEN 'low'
                    END,
                    'estimated_hours', (j * 4) + (i % 3),
                    'complexity', CASE j WHEN 1 THEN 'low' WHEN 2 THEN 'high' ELSE 'medium' END,
                    'tags', ARRAY['development', CASE j WHEN 3 THEN 'testing' WHEN 4 THEN 'deployment' ELSE 'implementation' END]
                ),
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '5 minutes'
            );
        END LOOP;

        -- Create deliverable versions with blog post content
        FOR d IN 1..1 LOOP
            INSERT INTO public.deliverable_versions (
                id,
                deliverable_id,
                version_number,
                content,
                format,
                is_current_version,
                created_by_type,
                task_id,
                metadata,
                file_attachments,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                deliverable_id,
                1,
                CASE i
                    WHEN 1 THEN E'# Building a Modern React Dashboard Component\n\nCreating an effective dashboard component is crucial for any modern web application. In this comprehensive guide, we''ll explore the essential elements that make a dashboard both functional and visually appealing.\n\n## Key Design Principles\n\nWhen building a dashboard component, consider these fundamental principles:\n\n- **Clarity**: Information should be immediately understandable\n- **Hierarchy**: Most important metrics should be prominently displayed\n- **Responsiveness**: Works seamlessly across all device sizes\n- **Performance**: Loads quickly even with large datasets\n\n## Implementation Strategy\n\nStart with a clean component structure:\n\n```jsx\nconst Dashboard = () => {\n  const [metrics, setMetrics] = useState([]);\n  const [loading, setLoading] = useState(true);\n  \n  return (\n    <div className="dashboard-container">\n      {/* Your dashboard content */}\n    </div>\n  );\n};\n```\n\n## Best Practices\n\n1. Use React hooks for state management\n2. Implement proper error boundaries\n3. Add loading states for better UX\n4. Consider using a charting library like Chart.js or D3\n\nBy following these guidelines, you''ll create a dashboard that users love to interact with and that scales with your application''s growth.'
                    WHEN 2 THEN E'# Implementing Secure User Authentication: A Complete Guide\n\nUser authentication is the cornerstone of any secure web application. This guide walks you through implementing a robust authentication system that protects your users and your data.\n\n## Authentication Fundamentals\n\nModern authentication systems should include:\n\n- **Multi-factor authentication (MFA)**\n- **Secure password policies**\n- **Session management**\n- **Rate limiting**\n- **Account lockout protection**\n\n## JWT vs Session-Based Auth\n\n### JSON Web Tokens (JWT)\n\nJWTs offer stateless authentication with these advantages:\n- No server-side session storage required\n- Easy to scale across multiple servers\n- Built-in expiration handling\n\n### Session-Based Authentication\n\nTraditional sessions provide:\n- Immediate revocation capability\n- Server-side control over user sessions\n- Smaller client-side footprint\n\n## Implementation Steps\n\n1. **Choose your authentication strategy**\n2. **Set up secure password hashing** (use bcrypt or similar)\n3. **Implement login/logout endpoints**\n4. **Add middleware for route protection**\n5. **Create user registration flow**\n6. **Add password reset functionality**\n\n## Security Considerations\n\nAlways remember:\n- Hash passwords with salt\n- Use HTTPS in production\n- Implement proper CORS policies\n- Add request rate limiting\n- Log authentication attempts\n\nA well-implemented authentication system is invisible to legitimate users but impenetrable to attackers.'
                    WHEN 3 THEN E'# Database Schema Design: Building Scalable Data Architecture\n\nA well-designed database schema is the foundation of any successful application. This guide covers essential principles and practical strategies for creating databases that scale.\n\n## Schema Design Principles\n\n### Normalization vs Denormalization\n\n**Normalization** reduces data redundancy:\n- Eliminates duplicate data\n- Ensures data consistency\n- Reduces storage requirements\n- Simplifies data updates\n\n**Denormalization** optimizes for read performance:\n- Faster query execution\n- Reduced join complexity\n- Better suited for analytics\n- May increase storage needs\n\n## Essential Design Patterns\n\n### 1. Primary Keys\nAlways use meaningful primary keys:\n```sql\nCREATE TABLE users (\n    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n    email VARCHAR(255) UNIQUE NOT NULL,\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);\n```\n\n### 2. Foreign Key Relationships\nMaintain referential integrity:\n```sql\nCREATE TABLE orders (\n    id UUID PRIMARY KEY,\n    user_id UUID REFERENCES users(id),\n    total_amount DECIMAL(10,2)\n);\n```\n\n### 3. Indexing Strategy\nCreate indexes for frequently queried columns:\n```sql\nCREATE INDEX idx_users_email ON users(email);\nCREATE INDEX idx_orders_user_id ON orders(user_id);\n```\n\n## Performance Optimization\n\n- Use appropriate data types\n- Implement proper indexing\n- Consider partitioning for large tables\n- Monitor query performance regularly\n\nRemember: a good schema design today saves countless hours of refactoring tomorrow.'
                    WHEN 4 THEN E'# API Rate Limiting: Protecting Your Services from Abuse\n\nRate limiting is essential for maintaining API performance and preventing abuse. Learn how to implement effective rate limiting strategies that protect your infrastructure while providing a smooth experience for legitimate users.\n\n## Why Rate Limiting Matters\n\nWithout proper rate limiting, your API faces several risks:\n- **DDoS attacks** can overwhelm your servers\n- **Resource exhaustion** from excessive requests\n- **Cost escalation** in cloud environments\n- **Poor user experience** due to system slowdowns\n\n## Common Rate Limiting Algorithms\n\n### 1. Token Bucket\n\nThe token bucket algorithm allows bursts while maintaining average limits:\n\n```javascript\nclass TokenBucket {\n  constructor(capacity, refillRate) {\n    this.capacity = capacity;\n    this.tokens = capacity;\n    this.refillRate = refillRate;\n    this.lastRefill = Date.now();\n  }\n  \n  consume(tokens = 1) {\n    this.refill();\n    if (this.tokens >= tokens) {\n      this.tokens -= tokens;\n      return true;\n    }\n    return false;\n  }\n}\n```\n\n### 2. Fixed Window\n\nSimple but effective for most use cases:\n- Reset counters at fixed intervals\n- Easy to implement and understand\n- May allow bursts at window boundaries\n\n### 3. Sliding Window\n\nMore accurate but computationally expensive:\n- Smooth rate limiting\n- No boundary burst issues\n- Requires more memory and processing\n\n## Implementation Best Practices\n\n1. **Choose appropriate limits** based on your infrastructure\n2. **Implement different tiers** for different user types\n3. **Provide clear error messages** when limits are exceeded\n4. **Monitor and adjust** limits based on usage patterns\n5. **Consider geographic distribution** for global applications\n\n## HTTP Status Codes\n\nUse proper status codes:\n- `429 Too Many Requests` for rate limit exceeded\n- Include `Retry-After` header\n- Provide remaining quota in response headers\n\nEffective rate limiting protects your API while maintaining excellent user experience.'
                    WHEN 5 THEN E'# Mobile App Navigation: Creating Intuitive User Journeys\n\nGreat mobile navigation is invisible – users should effortlessly move through your app without thinking about how to get where they want to go. This guide explores proven patterns and emerging trends in mobile navigation design.\n\n## Navigation Fundamentals\n\n### The 3-Tap Rule\n\nUsers should reach any feature within three taps:\n- **Tap 1**: Open the app\n- **Tap 2**: Navigate to section\n- **Tap 3**: Access specific feature\n\n### Visual Hierarchy\n\nEstablish clear information architecture:\n- Primary navigation (bottom tabs)\n- Secondary navigation (top tabs or lists)\n- Tertiary navigation (action sheets, modals)\n\n## Popular Navigation Patterns\n\n### 1. Bottom Tab Navigation\n\nBest for 3-5 primary sections:\n\n```jsx\n<Tab.Navigator>\n  <Tab.Screen name="Home" component={HomeScreen} />\n  <Tab.Screen name="Search" component={SearchScreen} />\n  <Tab.Screen name="Profile" component={ProfileScreen} />\n</Tab.Navigator>\n```\n\n**Pros:**\n- Thumb-friendly on mobile devices\n- Always visible\n- Clear section separation\n\n**Cons:**\n- Limited to 5 items maximum\n- Takes up screen space\n\n### 2. Drawer Navigation\n\nIdeal for apps with many sections:\n\n```jsx\n<Drawer.Navigator>\n  <Drawer.Screen name="Dashboard" component={DashboardScreen} />\n  <Drawer.Screen name="Settings" component={SettingsScreen} />\n  <Drawer.Screen name="Help" component={HelpScreen} />\n</Drawer.Navigator>\n```\n\n**Pros:**\n- Accommodates many navigation items\n- Saves screen space\n- Can include user information\n\n**Cons:**\n- Hidden by default\n- Requires gesture or button tap\n\n## Accessibility Considerations\n\n- Use semantic labels for screen readers\n- Ensure sufficient touch target sizes (44pt minimum)\n- Provide clear focus indicators\n- Test with voice control features\n\n## Performance Tips\n\n- Implement lazy loading for screens\n- Use native navigation libraries\n- Optimize animations for 60fps\n- Preload critical screens\n\nGreat navigation feels natural and gets users to their destination quickly and efficiently.'
                    WHEN 6 THEN E'# Payment Integration Made Simple: Stripe Setup Guide\n\nIntegrating payments into your application doesn''t have to be complicated. This comprehensive guide walks you through setting up Stripe payments with security best practices and optimal user experience.\n\n## Why Choose Stripe?\n\nStripe has become the gold standard for online payments:\n- **Security**: PCI DSS compliant out of the box\n- **Global reach**: Supports 135+ currencies\n- **Developer experience**: Excellent APIs and documentation\n- **Features**: Subscriptions, invoicing, marketplaces, and more\n\n## Setup Process\n\n### 1. Account Creation\n\n1. Sign up at stripe.com\n2. Complete business verification\n3. Get your API keys (test and live)\n4. Configure webhook endpoints\n\n### 2. Frontend Integration\n\nInstall Stripe Elements:\n\n```bash\nnpm install @stripe/stripe-js @stripe/react-stripe-js\n```\n\nBasic payment form:\n\n```jsx\nimport { loadStripe } from "@stripe/stripe-js";\nimport { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";\n\nconst PaymentForm = () => {\n  const stripe = useStripe();\n  const elements = useElements();\n  \n  const handleSubmit = async (event) => {\n    event.preventDefault();\n    \n    const { error, paymentMethod } = await stripe.createPaymentMethod({\n      type: "card",\n      card: elements.getElement(CardElement),\n    });\n    \n    if (!error) {\n      // Send paymentMethod.id to your server\n    }\n  };\n  \n  return (\n    <form onSubmit={handleSubmit}>\n      <CardElement />\n      <button type="submit" disabled={!stripe}>\n        Pay Now\n      </button>\n    </form>\n  );\n};\n```\n\n### 3. Backend Integration\n\nServer-side payment processing:\n\n```javascript\nconst stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);\n\napp.post("/create-payment-intent", async (req, res) => {\n  const { amount, currency } = req.body;\n  \n  try {\n    const paymentIntent = await stripe.paymentIntents.create({\n      amount: amount * 100, // Convert to cents\n      currency: currency,\n      metadata: {\n        order_id: req.body.order_id\n      }\n    });\n    \n    res.send({\n      client_secret: paymentIntent.client_secret\n    });\n  } catch (error) {\n    res.status(400).send({ error: error.message });\n  }\n});\n```\n\n## Security Best Practices\n\n1. **Never store card data** on your servers\n2. **Use HTTPS** for all payment pages\n3. **Validate on server-side** before processing\n4. **Implement webhook verification**\n5. **Log payment attempts** for monitoring\n\n## Testing\n\nStripe provides test card numbers:\n- `4242424242424242` - Successful payment\n- `4000000000000002` - Card declined\n- `4000000000009995` - Insufficient funds\n\n## Going Live\n\n1. Complete Stripe account verification\n2. Switch to live API keys\n3. Update webhook endpoints\n4. Test with real payment methods\n5. Monitor payment success rates\n\nWith Stripe, you can focus on your product while trusting that payments are handled securely and reliably.'
                    WHEN 7 THEN E'# Email Template Systems: Building Responsive Communications\n\nEmail templates are crucial for maintaining consistent brand communication. This guide covers building a flexible, maintainable email template system that works across all email clients.\n\n## Email Template Challenges\n\nEmail rendering is notoriously difficult:\n- **Inconsistent CSS support** across email clients\n- **Limited HTML capabilities**\n- **Responsive design complexity**\n- **Dark mode considerations**\n- **Accessibility requirements**\n\n## Template Architecture\n\n### 1. Base Template Structure\n\n```html\n<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{subject}}</title>\n  <style>\n    /* Inline CSS for maximum compatibility */\n    .container { max-width: 600px; margin: 0 auto; }\n    .header { background-color: #f8f9fa; padding: 20px; }\n    .content { padding: 30px 20px; }\n    .footer { background-color: #6c757d; color: white; padding: 15px; }\n  </style>\n</head>\n<body>\n  <div class="container">\n    <div class="header">\n      <img src="{{logo_url}}" alt="{{company_name}}" height="40">\n    </div>\n    <div class="content">\n      {{content}}\n    </div>\n    <div class="footer">\n      <p>{{company_name}} | {{company_address}}</p>\n      <a href="{{unsubscribe_url}}">Unsubscribe</a>\n    </div>\n  </div>\n</body>\n</html>\n```\n\n### 2. Template Components\n\nCreate reusable components:\n\n```javascript\nconst EmailComponents = {\n  button: (text, url, color = "#007bff") => `\n    <table cellpadding="0" cellspacing="0" style="margin: 20px 0;">\n      <tr>\n        <td style="background-color: ${color}; border-radius: 4px; padding: 12px 24px;">\n          <a href="${url}" style="color: white; text-decoration: none; font-weight: bold;">\n            ${text}\n          </a>\n        </td>\n      </tr>\n    </table>\n  `,\n  \n  alert: (message, type = "info") => `\n    <div style="padding: 15px; margin: 20px 0; border-left: 4px solid ${getAlertColor(type)}; background-color: #f8f9fa;">\n      ${message}\n    </div>\n  `\n};\n```\n\n## Template Types\n\n### 1. Transactional Emails\n\n- Welcome messages\n- Password resets\n- Order confirmations\n- Account notifications\n\n### 2. Marketing Emails\n\n- Newsletters\n- Product announcements\n- Promotional campaigns\n- Event invitations\n\n### 3. System Notifications\n\n- Error alerts\n- System maintenance\n- Security notifications\n- Performance reports\n\n## Responsive Design\n\n```css\n@media screen and (max-width: 600px) {\n  .container {\n    width: 100% !important;\n    margin: 0 !important;\n  }\n  \n  .content {\n    padding: 20px 15px !important;\n  }\n  \n  .button {\n    width: 100% !important;\n    text-align: center !important;\n  }\n}\n```\n\n## Testing Strategy\n\n1. **Email client testing**: Gmail, Outlook, Apple Mail\n2. **Device testing**: Desktop, mobile, tablet\n3. **Dark mode testing**: iOS, Android, desktop clients\n4. **Accessibility testing**: Screen readers, keyboard navigation\n\n## Automation and Personalization\n\n```javascript\nconst personalizeEmail = (template, userData) => {\n  return template\n    .replace("{{user_name}}", userData.name)\n    .replace("{{user_email}}", userData.email)\n    .replace("{{custom_content}}", generateCustomContent(userData));\n};\n```\n\n## Performance Optimization\n\n- Optimize images for email\n- Use web-safe fonts\n- Minimize HTML size\n- Implement proper caching\n- Monitor delivery rates\n\nA well-designed email template system ensures consistent, professional communication that engages your audience across all devices and email clients.'
                    WHEN 8 THEN E'# Search Functionality: Building Fast and Relevant Results\n\nImplementing effective search functionality can make or break user experience. This guide explores different search approaches, from simple text matching to advanced full-text search with ranking algorithms.\n\n## Search Implementation Strategies\n\n### 1. Database Full-Text Search\n\nMost databases offer built-in full-text search:\n\n**PostgreSQL:**\n```sql\n-- Create a text search vector\nALTER TABLE articles ADD COLUMN search_vector tsvector;\n\n-- Update search vector\nUPDATE articles SET search_vector = \n  to_tsvector(''english'', title || '' '' || content);\n\n-- Create index for performance\nCREATE INDEX articles_search_idx ON articles USING gin(search_vector);\n\n-- Search query\nSELECT title, \n       ts_rank(search_vector, query) as rank\nFROM articles, \n     to_tsquery(''english'', ''javascript & tutorial'') query\nWHERE search_vector @@ query\nORDER BY rank DESC;\n```\n\n**MySQL:**\n```sql\n-- Create full-text index\nALTER TABLE articles ADD FULLTEXT(title, content);\n\n-- Search with relevance scoring\nSELECT title,\n       MATCH(title, content) AGAINST(''javascript tutorial'') as relevance\nFROM articles\nWHERE MATCH(title, content) AGAINST(''javascript tutorial'')\nORDER BY relevance DESC;\n```\n\n### 2. Elasticsearch Integration\n\nFor advanced search capabilities:\n\n```javascript\nconst { Client } = require(''@elastic/elasticsearch'');\nconst client = new Client({ node: ''http://localhost:9200'' });\n\n// Index a document\nawait client.index({\n  index: ''articles'',\n  id: 1,\n  body: {\n    title: ''JavaScript Tutorial'',\n    content: ''Learn JavaScript fundamentals...'',\n    tags: [''javascript'', ''tutorial'', ''programming''],\n    published_date: ''2024-01-15''\n  }\n});\n\n// Search with multiple criteria\nconst searchResult = await client.search({\n  index: ''articles'',\n  body: {\n    query: {\n      bool: {\n        must: [\n          {\n            multi_match: {\n              query: ''javascript tutorial'',\n              fields: [''title^2'', ''content'', ''tags'']\n            }\n          }\n        ],\n        filter: [\n          {\n            range: {\n              published_date: {\n                gte: ''2024-01-01''\n              }\n            }\n          }\n        ]\n      }\n    },\n    highlight: {\n      fields: {\n        title: {},\n        content: {}\n      }\n    }\n  }\n});\n```\n\n## Search UX Best Practices\n\n### 1. Auto-complete and Suggestions\n\n```javascript\nconst searchSuggestions = async (query) => {\n  if (query.length < 2) return [];\n  \n  const suggestions = await client.search({\n    index: ''articles'',\n    body: {\n      suggest: {\n        article_suggest: {\n          prefix: query,\n          completion: {\n            field: ''suggest'',\n            size: 5\n          }\n        }\n      }\n    }\n  });\n  \n  return suggestions.body.suggest.article_suggest[0].options;\n};\n```\n\n### 2. Search Filters and Facets\n\n```javascript\nconst searchWithFilters = async (query, filters = {}) => {\n  const must = [{\n    multi_match: {\n      query: query,\n      fields: [''title^2'', ''content'']\n    }\n  }];\n  \n  const filter = [];\n  \n  if (filters.category) {\n    filter.push({ term: { category: filters.category } });\n  }\n  \n  if (filters.dateRange) {\n    filter.push({\n      range: {\n        published_date: {\n          gte: filters.dateRange.start,\n          lte: filters.dateRange.end\n        }\n      }\n    });\n  }\n  \n  return await client.search({\n    index: ''articles'',\n    body: {\n      query: { bool: { must, filter } },\n      aggs: {\n        categories: {\n          terms: { field: ''category'' }\n        },\n        date_histogram: {\n          date_histogram: {\n            field: ''published_date'',\n            calendar_interval: ''month''\n          }\n        }\n      }\n    }\n  });\n};\n```\n\n## Performance Optimization\n\n### 1. Caching Strategies\n\n```javascript\nconst Redis = require(''redis'');\nconst redis = Redis.createClient();\n\nconst searchWithCache = async (query) => {\n  const cacheKey = `search:${query}`;\n  const cached = await redis.get(cacheKey);\n  \n  if (cached) {\n    return JSON.parse(cached);\n  }\n  \n  const results = await performSearch(query);\n  await redis.setex(cacheKey, 300, JSON.stringify(results)); // Cache for 5 minutes\n  \n  return results;\n};\n```\n\n### 2. Search Analytics\n\n```javascript\nconst trackSearch = async (query, results, userId) => {\n  await analytics.track({\n    event: ''Search Performed'',\n    userId: userId,\n    properties: {\n      query: query,\n      results_count: results.length,\n      timestamp: new Date().toISOString()\n    }\n  });\n};\n```\n\n## Search Quality Metrics\n\n- **Click-through rate**: How often users click search results\n- **Zero-result searches**: Queries that return no results\n- **Search abandonment**: Users who search but don''t interact with results\n- **Query reformulation**: Users who modify their search terms\n\nGreat search functionality anticipates user needs and delivers relevant results quickly, making your application more discoverable and user-friendly.'
                    WHEN 9 THEN E'# Application Performance Optimization: Speed at Scale\n\nPerformance optimization is an ongoing process that directly impacts user experience and business metrics. This comprehensive guide covers frontend, backend, and infrastructure optimizations that deliver measurable improvements.\n\n## Performance Metrics That Matter\n\n### Core Web Vitals\n\n- **Largest Contentful Paint (LCP)**: < 2.5 seconds\n- **First Input Delay (FID)**: < 100 milliseconds\n- **Cumulative Layout Shift (CLS)**: < 0.1\n\n### Additional Metrics\n\n- **First Contentful Paint (FCP)**: < 1.8 seconds\n- **Time to Interactive (TTI)**: < 3.8 seconds\n- **Total Blocking Time (TBT)**: < 200 milliseconds\n\n## Frontend Optimization\n\n### 1. Code Splitting and Lazy Loading\n\n```javascript\n// Route-based code splitting\nconst Dashboard = lazy(() => import(''./Dashboard''));\nconst Settings = lazy(() => import(''./Settings''));\n\nfunction App() {\n  return (\n    <Router>\n      <Suspense fallback={<div>Loading...</div>}>\n        <Routes>\n          <Route path="/dashboard" element={<Dashboard />} />\n          <Route path="/settings" element={<Settings />} />\n        </Routes>\n      </Suspense>\n    </Router>\n  );\n}\n\n// Component-level lazy loading\nconst HeavyChart = lazy(() => \n  import(''./HeavyChart'').then(module => ({\n    default: module.HeavyChart\n  }))\n);\n```\n\n### 2. Image Optimization\n\n```javascript\n// Modern image formats with fallbacks\nconst OptimizedImage = ({ src, alt, width, height }) => {\n  return (\n    <picture>\n      <source srcSet={`${src}.webp`} type="image/webp" />\n      <source srcSet={`${src}.avif`} type="image/avif" />\n      <img \n        src={`${src}.jpg`}\n        alt={alt}\n        width={width}\n        height={height}\n        loading="lazy"\n        decoding="async"\n      />\n    </picture>\n  );\n};\n\n// Responsive images\nconst ResponsiveImage = ({ src, alt }) => {\n  const srcSet = [\n    `${src}-400w.jpg 400w`,\n    `${src}-800w.jpg 800w`,\n    `${src}-1200w.jpg 1200w`\n  ].join('', '');\n  \n  return (\n    <img \n      src={`${src}-800w.jpg`}\n      srcSet={srcSet}\n      sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"\n      alt={alt}\n      loading="lazy"\n    />\n  );\n};\n```\n\n### 3. Memory Management\n\n```javascript\n// Proper cleanup in React\nuseEffect(() => {\n  const subscription = api.subscribe(data => {\n    setData(data);\n  });\n  \n  const timeoutId = setTimeout(() => {\n    // Some delayed operation\n  }, 5000);\n  \n  // Cleanup function\n  return () => {\n    subscription.unsubscribe();\n    clearTimeout(timeoutId);\n  };\n}, []);\n\n// Memoization for expensive calculations\nconst expensiveValue = useMemo(() => {\n  return heavyCalculation(data);\n}, [data]);\n\nconst memoizedComponent = memo(({ items }) => {\n  return (\n    <ul>\n      {items.map(item => <li key={item.id}>{item.name}</li>)}\n    </ul>\n  );\n});\n```\n\n## Backend Optimization\n\n### 1. Database Query Optimization\n\n```sql\n-- Add appropriate indexes\nCREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC);\nCREATE INDEX idx_products_category_price ON products(category, price);\n\n-- Optimize queries with EXPLAIN\nEXPLAIN ANALYZE\nSELECT p.name, p.price, c.name as category_name\nFROM products p\nJOIN categories c ON p.category_id = c.id\nWHERE p.price BETWEEN 10 AND 100\nAND c.active = true\nORDER BY p.created_at DESC\nLIMIT 20;\n\n-- Use query result caching\nSELECT /*+ USE_QUERY_CACHE */ \n       product_id, name, price\nFROM products\nWHERE category = ''electronics''\nAND price < 500;\n```\n\n### 2. API Response Optimization\n\n```javascript\n// Implement response compression\nconst compression = require(''compression'');\napp.use(compression());\n\n// Add response caching headers\napp.get(''/api/products'', (req, res) => {\n  res.set({\n    ''Cache-Control'': ''public, max-age=3600'', // 1 hour\n    ''ETag'': generateETag(products),\n    ''Last-Modified'': lastModifiedDate\n  });\n  \n  res.json(products);\n});\n\n// Implement pagination\napp.get(''/api/products'', async (req, res) => {\n  const page = parseInt(req.query.page) || 1;\n  const limit = parseInt(req.query.limit) || 20;\n  const offset = (page - 1) * limit;\n  \n  const products = await Product.findAll({\n    limit,\n    offset,\n    order: [[''created_at'', ''DESC'']]\n  });\n  \n  const total = await Product.count();\n  \n  res.json({\n    data: products,\n    pagination: {\n      page,\n      limit,\n      total,\n      pages: Math.ceil(total / limit)\n    }\n  });\n});\n```\n\n## Infrastructure Optimization\n\n### 1. CDN Configuration\n\n```javascript\n// CloudFront distribution settings\nconst distributionConfig = {\n  Origins: [{\n    DomainName: ''api.example.com'',\n    CustomOriginConfig: {\n      HTTPPort: 443,\n      OriginProtocolPolicy: ''https-only''\n    }\n  }],\n  DefaultCacheBehavior: {\n    TargetOriginId: ''api-origin'',\n    ViewerProtocolPolicy: ''redirect-to-https'',\n    CachePolicyId: ''custom-cache-policy'',\n    Compress: true\n  },\n  CacheBehaviors: [{\n    PathPattern: ''/static/*'',\n    CachePolicyId: ''static-assets-policy'',\n    TTL: 31536000 // 1 year\n  }]\n};\n```\n\n### 2. Load Balancing\n\n```yaml\n# nginx.conf\nupstream app_servers {\n    least_conn;\n    server app1:3000 weight=3;\n    server app2:3000 weight=3;\n    server app3:3000 weight=2;\n}\n\nserver {\n    listen 80;\n    server_name example.com;\n    \n    location / {\n        proxy_pass http://app_servers;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_cache_bypass $http_upgrade;\n    }\n    \n    location /static/ {\n        expires 1y;\n        add_header Cache-Control "public, immutable";\n        root /var/www;\n    }\n}\n```\n\n## Monitoring and Alerting\n\n```javascript\n// Performance monitoring\nconst performanceObserver = new PerformanceObserver((list) => {\n  for (const entry of list.getEntries()) {\n    if (entry.entryType === ''navigation'') {\n      analytics.track(''Page Load Performance'', {\n        loadTime: entry.loadEventEnd - entry.loadEventStart,\n        domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,\n        firstPaint: entry.responseEnd - entry.requestStart\n      });\n    }\n  }\n});\n\nperformanceObserver.observe({ entryTypes: [''navigation'', ''paint''] });\n```\n\nRemember: measure first, optimize second. Use real user monitoring to identify bottlenecks, then apply targeted optimizations that provide the biggest impact for your specific use case.'
                    WHEN 10 THEN E'# Security Audit Checklist: Protecting Your Application\n\nA comprehensive security audit is essential for protecting your application and user data. This checklist covers the most critical security areas that every application should address.\n\n## Authentication and Authorization\n\n### ✅ Authentication Security\n\n- [ ] **Strong password policies** enforced (minimum 8 characters, complexity requirements)\n- [ ] **Multi-factor authentication** available for sensitive accounts\n- [ ] **Account lockout** after failed login attempts (5-10 attempts)\n- [ ] **Password reset** tokens expire within reasonable time (15-30 minutes)\n- [ ] **Session management** with secure cookies and proper expiration\n- [ ] **Brute force protection** implemented (rate limiting, CAPTCHA)\n\n### ✅ Authorization Controls\n\n- [ ] **Principle of least privilege** applied to all user roles\n- [ ] **Role-based access control** properly implemented\n- [ ] **API endpoints** protected with proper authentication\n- [ ] **Direct object references** validated (prevent IDOR attacks)\n- [ ] **Admin functions** require additional verification\n\n## Data Protection\n\n### ✅ Data Encryption\n\n```javascript\n// Encrypt sensitive data at rest\nconst crypto = require(''crypto'');\n\nconst encryptData = (text, key) => {\n  const algorithm = ''aes-256-gcm'';\n  const iv = crypto.randomBytes(16);\n  const cipher = crypto.createCipher(algorithm, key, iv);\n  \n  let encrypted = cipher.update(text, ''utf8'', ''hex'');\n  encrypted += cipher.final(''hex'');\n  \n  const authTag = cipher.getAuthTag();\n  \n  return {\n    encrypted,\n    iv: iv.toString(''hex''),\n    authTag: authTag.toString(''hex'')\n  };\n};\n```\n\n### ✅ Data Handling\n\n- [ ] **PII data** properly classified and protected\n- [ ] **Data retention** policies implemented\n- [ ] **Secure data deletion** when no longer needed\n- [ ] **Database encryption** enabled for sensitive tables\n- [ ] **Backup encryption** for all data backups\n- [ ] **Data masking** in non-production environments\n\n## Input Validation and Sanitization\n\n### ✅ SQL Injection Prevention\n\n```javascript\n// Use parameterized queries\nconst getUserById = async (userId) => {\n  // ✅ SECURE: Parameterized query\n  const query = ''SELECT * FROM users WHERE id = $1'';\n  const result = await db.query(query, [userId]);\n  return result.rows[0];\n};\n\n// ❌ VULNERABLE: String concatenation\n// const query = `SELECT * FROM users WHERE id = ${userId}`;\n```\n\n### ✅ XSS Prevention\n\n```javascript\n// Sanitize user input\nconst DOMPurify = require(''dompurify'');\n\nconst sanitizeInput = (userInput) => {\n  return DOMPurify.sanitize(userInput, {\n    ALLOWED_TAGS: [''b'', ''i'', ''em'', ''strong''],\n    ALLOWED_ATTR: []\n  });\n};\n\n// Content Security Policy headers\napp.use((req, res, next) => {\n  res.setHeader(\n    ''Content-Security-Policy'',\n    "default-src ''self''; script-src ''self'' ''unsafe-inline''; style-src ''self'' ''unsafe-inline''"\n  );\n  next();\n});\n```\n\n### ✅ Input Validation Checklist\n\n- [ ] **All user inputs** validated on both client and server\n- [ ] **File uploads** restricted by type, size, and content\n- [ ] **Email addresses** properly validated\n- [ ] **URLs** validated before processing\n- [ ] **JSON payloads** size-limited and schema-validated\n\n## Network Security\n\n### ✅ HTTPS and Transport Security\n\n```javascript\n// Force HTTPS in production\napp.use((req, res, next) => {\n  if (process.env.NODE_ENV === ''production'' && !req.secure) {\n    return res.redirect(301, `https://${req.headers.host}${req.url}`);\n  }\n  next();\n});\n\n// Security headers\nconst helmet = require(''helmet'');\napp.use(helmet({\n  hsts: {\n    maxAge: 31536000,\n    includeSubDomains: true,\n    preload: true\n  },\n  contentSecurityPolicy: {\n    directives: {\n      defaultSrc: ["''self''"],\n      styleSrc: ["''self''", "''unsafe-inline''"],\n      scriptSrc: ["''self''"],\n      imgSrc: ["''self''", "data:", "https:"],\n    },\n  },\n}));\n```\n\n### ✅ Network Security Checklist\n\n- [ ] **TLS 1.2+** enforced for all connections\n- [ ] **Certificate pinning** implemented for mobile apps\n- [ ] **CORS policies** properly configured\n- [ ] **Rate limiting** on all public endpoints\n- [ ] **DDoS protection** in place\n- [ ] **Firewall rules** restricting unnecessary ports\n\n## Infrastructure Security\n\n### ✅ Server Hardening\n\n```bash\n# Update system packages\nsudo apt update && sudo apt upgrade -y\n\n# Configure firewall\nsudo ufw default deny incoming\nsudo ufw default allow outgoing\nsudo ufw allow ssh\nsudo ufw allow 80\nsudo ufw allow 443\nsudo ufw enable\n\n# Disable unnecessary services\nsudo systemctl disable apache2\nsudo systemctl stop apache2\n\n# Set up fail2ban for SSH protection\nsudo apt install fail2ban\nsudo systemctl enable fail2ban\n```\n\n### ✅ Infrastructure Checklist\n\n- [ ] **Operating systems** kept up to date\n- [ ] **Unnecessary services** disabled\n- [ ] **SSH keys** used instead of passwords\n- [ ] **Regular security patches** applied\n- [ ] **Monitoring and logging** enabled\n- [ ] **Backup and recovery** procedures tested\n\n## Application Security\n\n### ✅ Dependency Management\n\n```bash\n# Audit npm dependencies\nnpm audit\nnpm audit fix\n\n# Use Snyk for continuous monitoring\nnpx snyk test\nnpx snyk monitor\n\n# Keep dependencies updated\nnpm outdated\nnpm update\n```\n\n### ✅ Error Handling\n\n```javascript\n// Secure error handling\napp.use((err, req, res, next) => {\n  // Log full error details internally\n  console.error(err.stack);\n  \n  // Return generic error to client\n  if (process.env.NODE_ENV === ''production'') {\n    res.status(500).json({\n      error: ''Internal server error'',\n      message: ''Something went wrong''\n    });\n  } else {\n    res.status(500).json({\n      error: err.message,\n      stack: err.stack\n    });\n  }\n});\n```\n\n## Compliance and Documentation\n\n### ✅ Compliance Checklist\n\n- [ ] **GDPR compliance** for EU users\n- [ ] **CCPA compliance** for California users\n- [ ] **Privacy policy** updated and accessible\n- [ ] **Terms of service** current\n- [ ] **Data processing agreements** with third parties\n- [ ] **Incident response plan** documented and tested\n\n## Security Testing\n\n### ✅ Regular Security Testing\n\n- [ ] **Automated security scanning** integrated into CI/CD\n- [ ] **Penetration testing** performed annually\n- [ ] **Code reviews** include security considerations\n- [ ] **Vulnerability assessments** conducted quarterly\n- [ ] **Security training** provided to development team\n\nRemember: security is not a one-time task but an ongoing process. Regular audits, updates, and monitoring are essential for maintaining a secure application.'
                END,
                'markdown',
                true,
                'ai_response',
                NULL, -- task_id
                jsonb_build_object(
                    'word_count', CASE i
                        WHEN 1 THEN 850
                        WHEN 2 THEN 1200
                        WHEN 3 THEN 950
                        WHEN 4 THEN 1100
                        WHEN 5 THEN 1050
                        WHEN 6 THEN 1300
                        WHEN 7 THEN 1150
                        WHEN 8 THEN 1250
                        WHEN 9 THEN 1400
                        WHEN 10 THEN 1350
                    END,
                    'reading_time_minutes', CASE i
                        WHEN 1 THEN 4
                        WHEN 2 THEN 5
                        WHEN 3 THEN 4
                        WHEN 4 THEN 5
                        WHEN 5 THEN 5
                        WHEN 6 THEN 6
                        WHEN 7 THEN 5
                        WHEN 8 THEN 6
                        WHEN 9 THEN 6
                        WHEN 10 THEN 6
                    END,
                    'content_type', 'blog_post',
                    'generated_by', 'ai_agent',
                    'topics', CASE i
                        WHEN 1 THEN '["react", "dashboard", "components", "frontend"]'::jsonb
                        WHEN 2 THEN '["authentication", "security", "jwt", "backend"]'::jsonb
                        WHEN 3 THEN '["database", "schema", "design", "sql"]'::jsonb
                        WHEN 4 THEN '["api", "rate-limiting", "performance", "security"]'::jsonb
                        WHEN 5 THEN '["mobile", "navigation", "ux", "design"]'::jsonb
                        WHEN 6 THEN '["payments", "stripe", "integration", "security"]'::jsonb
                        WHEN 7 THEN '["email", "templates", "communication", "html"]'::jsonb
                        WHEN 8 THEN '["search", "elasticsearch", "performance", "ux"]'::jsonb
                        WHEN 9 THEN '["performance", "optimization", "frontend", "backend"]'::jsonb
                        WHEN 10 THEN '["security", "audit", "checklist", "compliance"]'::jsonb
                    END
                ),
                '{}', -- file_attachments
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '2 hours',
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '2 hours'
            );
        END LOOP;

        -- Create 3-5 LLM usage records per conversation
        FOR j IN 1..(3 + (i % 3)) LOOP
            usage_id := gen_random_uuid();
            
            -- Get a random model with matching provider (with fallback)
            WITH random_model AS (
                SELECT 
                    COALESCE(lm.provider_name, 'ollama') as provider_name,
                    COALESCE(lm.model_name, 'llama3.2:latest') as model_name
                FROM (
                SELECT provider_name, model_name 
                FROM public.llm_models 
                ORDER BY random() 
                LIMIT 1 
                ) lm
                UNION ALL
                SELECT 'ollama' as provider_name, 'llama3.2:latest' as model_name
                WHERE NOT EXISTS (SELECT 1 FROM public.llm_models)
                LIMIT 1
            )
            INSERT INTO public.llm_usage (
                id,
                run_id,
                conversation_id,
                user_id,
                provider_name,
                model_name,
                input_tokens,
                output_tokens,
                input_cost,
                output_cost,
                duration_ms,
                status,
                caller_type,
                agent_name,
                data_classification,
                started_at,
                completed_at,
                created_at
            ) 
            SELECT 
                usage_id,
                gen_random_uuid(),
                conv_id,
                demo_user_id,
                rm.provider_name,
                rm.model_name,
                100 + (i * 50) + (j * 25),
                200 + (i * 75) + (j * 30),
                ROUND((100 + (i * 50) + (j * 25)) * 0.000015, 6),
                ROUND((200 + (i * 75) + (j * 30)) * 0.00006, 6),
                1500 + (i * 200) + (j * 100),
                'completed',
                CASE j % 3
                    WHEN 0 THEN 'web_interface'
                    WHEN 1 THEN 'api_call'
                    ELSE 'background_task'
                END,
                CASE j % 4
                    WHEN 0 THEN 'conversation_agent'
                    WHEN 1 THEN 'task_agent'
                    WHEN 2 THEN 'analysis_agent'
                    ELSE 'summary_agent'
                END,
                CASE i % 3
                    WHEN 0 THEN 'public'
                    WHEN 1 THEN 'internal'
                    ELSE 'confidential'
                END,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j,
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '1 second' * (1500 + (i * 200) + (j * 100)),
                NOW() - INTERVAL '1 day' * (10 - i) + INTERVAL '1 hour' * j + INTERVAL '2 minutes'
            FROM random_model rm;
        END LOOP;
    END LOOP;

    RAISE NOTICE '✅ Successfully created comprehensive sample data:';
    RAISE NOTICE '   - 10 agent conversations with realistic titles and metadata';
    RAISE NOTICE '   - 10 deliverables with detailed descriptions';
    RAISE NOTICE '   - 25+ tasks with various statuses and priorities';
    RAISE NOTICE '   - 40+ LLM usage records across multiple providers';
    RAISE NOTICE '   - Realistic costs, tokens, and timing data';
    RAISE NOTICE '   - Data spans the last 10 days for testing analytics';
    RAISE NOTICE '   - All data properly linked to demo user: %', demo_user_id;
END $$;

-- =====================================
-- SYSTEM SETTINGS (GLOBAL MODEL CONFIG)
-- =====================================
-- Seed the global model configuration used by the API when MODEL_CONFIG_GLOBAL_JSON is not provided
INSERT INTO public.system_settings (key, value)
VALUES (
  'model_config_global',
  '{"provider":"openai","model":"gpt-4o","parameters":{"temperature":0.2,"maxTokens":800}}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- =====================================
-- PII PATTERNS SEEDING
-- =====================================
-- Clean up and seed built-in PII patterns with proper severity levels
-- This ensures the database is the single source of truth for PII policy enforcement
-- Note: severity and data_type columns are added by migration 20250115000001_add_pii_pattern_severity_columns.sql

-- Insert all built-in PII patterns with proper severity levels
-- Using ON CONFLICT to make this idempotent (safe to run multiple times)
INSERT INTO public.redaction_patterns (
    name, 
    pattern_regex, 
    replacement, 
    description, 
    category, 
    priority, 
    severity, 
    data_type, 
    is_active
) VALUES 
-- EMAIL PATTERNS (pseudonymizer)
('email_standard', 
 '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', 
 '[EMAIL_REDACTED]', 
 'Standard email addresses', 
 'pii_builtin', 
 10, 
 'pseudonymizer', 
 'email', 
 true),

('email_obfuscated', 
 '\b[A-Za-z0-9._%+-]+\s+(?:at|AT)\s+[A-Za-z0-9.-]+\s+(?:dot|DOT)\s+[A-Za-z]{2,}\b', 
 '[EMAIL_REDACTED]', 
 'Obfuscated email addresses (john at company dot com)', 
 'pii_builtin', 
 20, 
 'pseudonymizer', 
 'email', 
 true),

-- PHONE PATTERNS (pseudonymizer)
('phone_us_standard', 
 '\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b', 
 '[PHONE_REDACTED]', 
 'US phone numbers (various formats)', 
 'pii_builtin', 
 10, 
 'pseudonymizer', 
 'phone', 
 true),

('phone_international', 
 '\+(?:[0-9] ?){6,14}[0-9]', 
 '[PHONE_REDACTED]', 
 'International phone numbers', 
 'pii_builtin', 
 15, 
 'pseudonymizer', 
 'phone', 
 true),

-- NAME PATTERNS (flagger) - Allow names for content creation, just flag for monitoring
('name_first_last', 
 '\b[A-Z][a-z]{1,}(?: [A-Z][a-z]{1,}){1,3}\b', 
 '[NAME_REDACTED]', 
 'First and last names (Title case)', 
 'pii_builtin', 
 30, 
 'flagger', 
 'name', 
 true),

-- IP ADDRESS PATTERNS (flagger)
('ip_address_v4', 
 '\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b', 
 '[IP_REDACTED]', 
 'IPv4 addresses', 
 'pii_builtin', 
 10, 
 'flagger', 
 'ip_address', 
 true),

('ip_address_v6', 
 '\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b', 
 '[IP_REDACTED]', 
 'IPv6 addresses (full format)', 
 'pii_builtin', 
 15, 
 'flagger', 
 'ip_address', 
 true),

-- SSN PATTERNS (showstopper) - CRITICAL: These should block requests
('ssn_standard', 
 '\b\d{3}-\d{2}-\d{4}\b', 
 '[SSN_REDACTED]', 
 'Social Security Numbers (XXX-XX-XXXX)', 
 'pii_builtin', 
 5, 
 'showstopper', 
 'ssn', 
 true),

('ssn_no_dashes', 
 '\b\d{9}\b', 
 '[SSN_REDACTED]', 
 'Social Security Numbers (no dashes)', 
 'pii_builtin', 
 5, 
 'showstopper', 
 'ssn', 
 true),

-- CREDIT CARD PATTERNS (showstopper) - CRITICAL: These should block requests
('credit_card_visa', 
 '\b4[0-9]{12}(?:[0-9]{3})?\b', 
 '[CREDIT_CARD_REDACTED]', 
 'Visa credit card numbers', 
 'pii_builtin', 
 5, 
 'showstopper', 
 'credit_card', 
 true),

('credit_card_mastercard', 
 '\b5[1-5][0-9]{14}\b', 
 '[CREDIT_CARD_REDACTED]', 
 'Mastercard credit card numbers', 
 'pii_builtin', 
 5, 
 'showstopper', 
 'credit_card', 
 true),

('credit_card_amex', 
 '\b3[47][0-9]{13}\b', 
 '[CREDIT_CARD_REDACTED]', 
 'American Express credit card numbers', 
 'pii_builtin', 
 5, 
 'showstopper', 
 'credit_card', 
 true),

('credit_card_discover', 
 '\b6(?:011|5[0-9]{2})[0-9]{12}\b', 
 '[CREDIT_CARD_REDACTED]', 
 'Discover credit card numbers', 
 'pii_builtin', 
 5, 
 'showstopper', 
 'credit_card', 
 true),

-- USERNAME PATTERNS (flagger)
('username_handle', 
 '\b@[a-zA-Z0-9_]{3,15}\b', 
 '[USERNAME_REDACTED]', 
 'Social media usernames/handles', 
 'pii_builtin', 
 40, 
 'flagger', 
 'username', 
 true),

-- ADDRESS PATTERNS (pseudonymizer)
('address_us_street', 
 '\b\d{1,5}\s+[A-Za-z0-9\s]{3,}\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court)\b', 
 '[ADDRESS_REDACTED]', 
 'US street addresses', 
 'pii_builtin', 
 25, 
 'pseudonymizer', 
 'address', 
 true),

-- API KEYS AND TOKENS (showstopper) - CRITICAL: These should block requests
('github_token', 
 '\bgh[pousr]_[A-Za-z0-9]{36}\b', 
 '[GITHUB_TOKEN_REDACTED]', 
 'GitHub personal access tokens', 
 'pii_builtin', 
 1, 
 'showstopper', 
 'custom', 
 true),

('aws_access_key', 
 '\bAKIA[0-9A-Z]{16}\b', 
 '[AWS_ACCESS_KEY_REDACTED]', 
 'AWS access key IDs', 
 'pii_builtin', 
 1, 
 'showstopper', 
 'custom', 
 true),

('jwt_token', 
 '\beyJ[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\b', 
 '[JWT_TOKEN_REDACTED]', 
 'JSON Web Tokens', 
 'pii_builtin', 
 1, 
 'showstopper', 
 'custom', 
 true),

('bearer_token', 
 '\b[Bb]earer\s+[A-Za-z0-9+/]{20,}', 
 '[BEARER_TOKEN_REDACTED]', 
 'Bearer tokens', 
 'pii_builtin', 
 1, 
 'showstopper', 
 'custom', 
 true),

('openai_api_key', 
 '\bsk-[A-Za-z0-9]{48,}\b', 
 '[OPENAI_API_KEY_REDACTED]', 
 'OpenAI API keys', 
 'pii_builtin', 
 1, 
 'showstopper', 
 'custom', 
 true),

('stripe_key', 
 '\bsk_(?:test|live)_[A-Za-z0-9]{24,}\b', 
 '[STRIPE_KEY_REDACTED]', 
 'Stripe API keys', 
 'pii_builtin', 
 1, 
 'showstopper', 
 'custom', 
 true)
ON CONFLICT (name) DO UPDATE SET
    pattern_regex = EXCLUDED.pattern_regex,
    replacement = EXCLUDED.replacement,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    priority = EXCLUDED.priority,
    severity = EXCLUDED.severity,
    data_type = EXCLUDED.data_type,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

-- Statistics will be updated automatically via ON CONFLICT clause above

-- Log the PII patterns seeding operation
DO $$
DECLARE
    pattern_count INTEGER;
    showstopper_count INTEGER;
    pseudonymizer_count INTEGER;
    flagger_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO pattern_count 
    FROM public.redaction_patterns 
    WHERE category = 'pii_builtin';
    
    SELECT COUNT(*) INTO showstopper_count 
    FROM public.redaction_patterns 
    WHERE category = 'pii_builtin' AND severity = 'showstopper';
    
    SELECT COUNT(*) INTO pseudonymizer_count 
    FROM public.redaction_patterns 
    WHERE category = 'pii_builtin' AND severity = 'pseudonymizer';
    
    SELECT COUNT(*) INTO flagger_count 
    FROM public.redaction_patterns 
    WHERE category = 'pii_builtin' AND severity = 'flagger';
    
    RAISE NOTICE '';
    RAISE NOTICE '🔒 PII PATTERNS SEEDING COMPLETE';
    RAISE NOTICE '   - Successfully seeded % built-in PII patterns with severity levels', pattern_count;
    RAISE NOTICE '   - % Showstopper patterns (BLOCK requests): SSN, Credit Cards, API Keys, Tokens', showstopper_count;
    RAISE NOTICE '   - % Pseudonymizer patterns (SANITIZE): Email, Phone, Address', pseudonymizer_count;
    RAISE NOTICE '   - % Flagger patterns (MONITOR): Names, IP Address, Username', flagger_count;
    RAISE NOTICE '   - Database is now the single source of truth for PII policy enforcement';
    RAISE NOTICE '   - Social Security Numbers are correctly marked as SHOWSTOPPERS ✅';
END $$;

-- =====================================
-- CIDAFM COMMANDS SEEDING
-- =====================================

-- Insert basic CIDAFM commands
INSERT INTO public.cidafm_commands (
    id,
    type,
    name,
    description,
    default_active,
    is_builtin,
    created_at,
    updated_at
) VALUES
('550e8400-e29b-41d4-a716-446655440001', '^', 'format_markdown', 'Format response as Markdown with proper headers and structure', false, true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', '^', 'format_json', 'Format response as JSON with proper structure', false, true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', '&', 'include_examples', 'Include practical examples in the response', false, true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440004', '&', 'include_code', 'Include code snippets and implementation details', false, true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440005', '!', 'exclude_theory', 'Focus on practical implementation, avoid theoretical explanations', false, true, NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440006', '!', 'exclude_warnings', 'Skip safety warnings and disclaimers', false, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Log CIDAFM seeding completion
DO $$
BEGIN
    RAISE NOTICE '✅ CIDAFM commands seeded successfully - 6 built-in commands available';
END $$;

-- Add custom pseudonyms for specific entities (dictionary-based pseudonymization)
-- These are the only entities that will be pseudonymized during LLM processing
INSERT INTO public.pseudonym_dictionaries (
    original_value, 
    pseudonym, 
    data_type, 
    category, 
    frequency_weight, 
    is_active
) VALUES 
-- Our 3 specific entities with descriptive pseudonyms
('Matt Weber', '@person_matt', 'name', 'person', 1, true),
('GolferGeek', '@user_golfer', 'username', 'person', 1, true),
('Orchestrator AI', '@company_orchestrator', 'custom', 'business', 1, true);

-- =====================================
-- LLM PROVIDERS AND MODELS
-- =====================================

-- Insert LLM Providers (5 providers)
INSERT INTO public.llm_providers (name, display_name, api_base_url, configuration_json, is_active) VALUES
('openai', 'OpenAI', 'https://api.openai.com/v1', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('google', 'Google Gemini', 'https://generativelanguage.googleapis.com/v1', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('anthropic', 'Anthropic Claude', 'https://api.anthropic.com/v1', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('grok', 'Grok (xAI)', 'https://api.xai.com', '{"timeout": 30, "max_retries": 3}'::jsonb, true),
('ollama', 'Ollama', 'http://localhost:11434', '{"timeout": 30, "max_retries": 3, "local": true}'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- Insert LLM Models with corrections based on your notes
-- OPENAI MODELS (4 models)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active, model_tier
) VALUES
('gpt-5', 'openai', 'GPT-5', 'text-generation', 128000, 8192, '{}', '[]', true, 'fast-thinking'),
('o4-mini', 'openai', 'o4-mini', 'text-generation', 32000, 8192, '{}', '[]', true, 'general'),
('o1-preview', 'openai', 'o1-preview', 'text-generation', 16000, 4096, '{}', '[]', true, 'general'),
('o1-mini', 'openai', 'o1-mini', 'text-generation', 8000, 2048, '{}', '[]', true, 'ultra-fast');

-- GOOGLE MODELS (4 models)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active, model_tier
) VALUES
('gemini-2.5-pro', 'google', 'Gemini 2.5 Pro', 'text-generation', 1000000, 8192, '{}', '[]', true, 'fast-thinking'),
('gemini-2.5-flash', 'google', 'Gemini 2.5 Flash', 'text-generation', 1000000, 8192, '{}', '[]', true, 'ultra-fast'),
('gemini-2.0-pro', 'google', 'Gemini 2.0 Pro', 'text-generation', 1000000, 8192, '{}', '[]', true, 'general'),
('gemini-2.0-flash', 'google', 'Gemini 2.0 Flash', 'text-generation', 1048576, 8192, '{}', '[]', true, 'general');

-- ANTHROPIC MODELS (4 models) - with 3-5 naming fix
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active, model_tier
) VALUES
('claude-opus-4-1-20250805', 'anthropic', 'Claude Opus 4.1', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000015, "output_cost_per_token": 0.000075}'::jsonb,
 '["function_calling", "streaming", "vision", "coding", "reasoning", "agentic"]'::jsonb, true, 'fast-thinking'),

('claude-sonnet-4-20250514', 'anthropic', 'Claude Sonnet 4', 'text-generation', 200000, 64000,
 '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}'::jsonb,
 '["function_calling", "streaming", "vision", "balanced", "high_output"]'::jsonb, true, 'general'),

('claude-3-5-haiku-20241022', 'anthropic', 'Claude 3.5 Haiku', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.0008, "output_cost_per_token": 0.004}'::jsonb,
 '["streaming", "fast", "low_latency", "cost_effective"]'::jsonb, true, 'ultra-fast'),

('claude-3-5-sonnet-20241022', 'anthropic', 'Claude 3.5 Sonnet', 'text-generation', 200000, 8192,
 '{"input_cost_per_token": 0.000003, "output_cost_per_token": 0.000015}'::jsonb,
 '["function_calling", "streaming", "balanced", "reasoning"]'::jsonb, true, 'general');

-- GROK MODELS (5 models)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_active, model_tier
) VALUES
('grok-4', 'grok', 'Grok 4', 'text-generation', 128000, 8192,
 '{"subscription_tier": "SuperGrok", "monthly_cost": 40, "api_pricing": "custom"}'::jsonb,
 '["function_calling", "streaming", "tool_use", "real_time_search", "multimodal"]'::jsonb, true, 'fast-thinking'),

('grok-4-heavy', 'grok', 'Grok 4 Heavy', 'text-generation', 256000, 8192,
 '{"subscription_tier": "SuperGrok Heavy", "monthly_cost": 120, "api_pricing": "custom"}'::jsonb,
 '["function_calling", "streaming", "tool_use", "max_accuracy", "enterprise"]'::jsonb, true, 'fast-thinking'),

('grok-3', 'grok', 'Grok 3', 'text-generation', 128000, 8192,
 '{"subscription_tier": "Standard Grok", "monthly_cost": 20, "api_pricing": "custom"}'::jsonb,
 '["streaming", "reasoning", "think_mode"]'::jsonb, true, 'general'),

('grok-3-mini', 'grok', 'Grok 3 mini', 'text-generation', 64000, 4096,
 '{"subscription_tier": "included", "api_pricing": "low_cost"}'::jsonb,
 '["streaming", "fast", "lower_accuracy"]'::jsonb, true, 'ultra-fast'),

('grok-code-fast-1', 'grok', 'Grok Code Fast 1', 'text-generation', 256000, 8192,
 '{"api_only": true, "pricing": "custom", "specialized": "coding"}'::jsonb,
 '["function_calling", "tool_use", "coding", "ide_integration", "agentic"]'::jsonb, true, 'general');

-- OLLAMA MODELS (6 models - excluding deepseek-r1:70b and gpt-oss:120b per your notes)
INSERT INTO public.llm_models (
    model_name, provider_name, display_name, model_type, context_window, max_output_tokens,
    pricing_info_json, capabilities, is_local, model_tier, loading_priority, is_active
) VALUES
('llama3.2:latest', 'ollama', 'Llama 3.2 Latest', 'text-generation', 128000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "open_source"]'::jsonb,
 true, 'general', 8, true),

('qwen3:8b', 'ollama', 'Qwen 3 8B', 'text-generation', 32000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "multilingual", "efficient"]'::jsonb,
 true, 'general', 7, true),

('deepseek-r1:latest', 'ollama', 'DeepSeek R1 Latest', 'text-generation', 64000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "reasoning", "coding"]'::jsonb,
 true, 'fast-thinking', 9, true),

('qwq:latest', 'ollama', 'QwQ Latest', 'text-generation', 32000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "reasoning"]'::jsonb,
 true, 'general', 5, true),

('gpt-oss:20b', 'ollama', 'GPT-OSS 20B', 'text-generation', 32000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "open_source", "efficient"]'::jsonb,
 true, 'ultra-fast', 8, true),

('phi3.5:latest', 'ollama', 'Phi 3.5 Latest', 'text-generation', 32000, 4096,
 '{"local": true, "cost": 0}'::jsonb,
 '["streaming", "local", "efficient"]'::jsonb,
 true, 'ultra-fast', 6, true)

ON CONFLICT (provider_name, model_name) DO NOTHING;

-- =====================================
-- COMPANY & KPI DEMO DATA (migrated from migration 20250911_seed_demo_kpi.sql)
-- =====================================
-- Seeds one company, three departments, five revenue metrics,
-- quarterly goals, and ~80 KPI data points. Idempotent by natural keys.

DO $$
BEGIN
  -- Ensure pgcrypto for gen_random_uuid()
  PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
  IF NOT FOUND THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
END$$;

BEGIN;

WITH ins_company AS (
  INSERT INTO public.companies (id, name, industry, founded_year)
  SELECT gen_random_uuid(), 'Acme Analytics Inc.', 'Software', 2018
  WHERE NOT EXISTS (
    SELECT 1 FROM public.companies WHERE name = 'Acme Analytics Inc.'
  )
  RETURNING id
),
sel_company AS (
  SELECT id FROM ins_company
  UNION ALL
  SELECT id FROM public.companies WHERE name = 'Acme Analytics Inc.'
),
dept_names AS (
  SELECT unnest(ARRAY['Sales','Professional Services','Enterprise Accounts']) AS name
),
ins_depts AS (
  INSERT INTO public.departments (id, company_id, name, head_of_department, budget)
  SELECT gen_random_uuid(), (SELECT id FROM sel_company), d.name, NULL, 1000000
  FROM dept_names d
  WHERE NOT EXISTS (
    SELECT 1 FROM public.departments pd
    WHERE pd.company_id = (SELECT id FROM sel_company) AND pd.name = d.name
  )
  RETURNING id, name
),
sel_depts AS (
  SELECT id, name FROM ins_depts
  UNION ALL
  SELECT id, name FROM public.departments
  WHERE company_id = (SELECT id FROM sel_company) AND name IN ('Sales','Professional Services','Enterprise Accounts')
),
metric_rows AS (
  SELECT * FROM (
    VALUES
      ('Revenue_Total','Total revenue','USD','revenue'),
      ('Revenue_Subscription','Recurring subscription revenue','USD','revenue'),
      ('Revenue_Services','Professional services revenue','USD','revenue'),
      ('Revenue_Usage','Usage-based revenue','USD','revenue'),
      ('Revenue_Enterprise','Enterprise contract revenue','USD','revenue')
  ) AS t(name, description, unit, metric_type)
),
ins_metrics AS (
  INSERT INTO public.kpi_metrics (id, name, description, unit, metric_type)
  SELECT gen_random_uuid(), m.name, m.description, m.unit, m.metric_type
  FROM metric_rows m
  WHERE NOT EXISTS (
    SELECT 1 FROM public.kpi_metrics km WHERE km.name = m.name
  )
  RETURNING id, name
),
sel_metrics AS (
  SELECT id, name FROM ins_metrics
  UNION ALL
  SELECT id, name FROM public.kpi_metrics
  WHERE name IN ('Revenue_Total','Revenue_Subscription','Revenue_Services','Revenue_Usage','Revenue_Enterprise')
),
goal_period AS (
  SELECT date_trunc('quarter', CURRENT_DATE)::date AS start_date,
         (date_trunc('quarter', CURRENT_DATE) + INTERVAL '3 months - 1 day')::date AS end_date
)
INSERT INTO public.kpi_goals (id, department_id, metric_id, target_value, period_start, period_end)
SELECT gen_random_uuid(), d.id, m.id,
       CASE m.name
         WHEN 'Revenue_Total' THEN 500000
         WHEN 'Revenue_Subscription' THEN 250000
         WHEN 'Revenue_Services' THEN 150000
         WHEN 'Revenue_Usage' THEN  50000
         WHEN 'Revenue_Enterprise' THEN  75000
       END::numeric,
       (SELECT start_date FROM goal_period),
       (SELECT end_date FROM goal_period)
FROM sel_depts d
JOIN sel_metrics m ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.kpi_goals kg
  WHERE kg.department_id = d.id
    AND kg.metric_id = m.id
    AND kg.period_start = (SELECT start_date FROM goal_period)
    AND kg.period_end   = (SELECT end_date   FROM goal_period)
);

WITH sel_depts AS (
  SELECT d.id, d.name
  FROM public.departments d
  JOIN public.companies c ON c.id = d.company_id
  WHERE c.name = 'Acme Analytics Inc.' AND d.name IN ('Sales','Professional Services','Enterprise Accounts')
),
sel_metrics AS (
  SELECT id, name FROM public.kpi_metrics
  WHERE name IN ('Revenue_Total','Revenue_Subscription','Revenue_Services','Revenue_Usage','Revenue_Enterprise')
),
gen_dates AS (
  SELECT (CURRENT_DATE - (g % 90))::date AS date_recorded, g
  FROM generate_series(1, 80) AS s(g)
),
vals AS (
  SELECT d.id AS department_id,
         m.id AS metric_id,
         GREATEST(0, (
           CASE m.name
             WHEN 'Revenue_Total' THEN 15000
             WHEN 'Revenue_Subscription' THEN 8000
             WHEN 'Revenue_Services' THEN 5000
             WHEN 'Revenue_Usage' THEN 1500
             WHEN 'Revenue_Enterprise' THEN 2500
             ELSE 1000
           END
         ) + ((g * 97) % 1000) - 500)::numeric AS value,
         gd.date_recorded
  FROM sel_depts d
  CROSS JOIN sel_metrics m
  JOIN gen_dates gd ON TRUE
  LIMIT 80
)
INSERT INTO public.kpi_data (id, department_id, metric_id, value, date_recorded)
SELECT gen_random_uuid(), v.department_id, v.metric_id, v.value, v.date_recorded
FROM vals v
WHERE NOT EXISTS (
  SELECT 1 FROM public.kpi_data kd
  WHERE kd.department_id = v.department_id
    AND kd.metric_id = v.metric_id
    AND kd.date_recorded = v.date_recorded
);

COMMIT;
