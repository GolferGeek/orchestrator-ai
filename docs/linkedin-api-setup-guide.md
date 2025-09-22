# LinkedIn API Setup Guide for N8N Social Media Workflow

This guide walks you through setting up LinkedIn API credentials for the N8N Social Media Auto-Poster workflow.

## Overview

To enable automatic posting to LinkedIn through our N8N workflow, you need to:
1. Create a LinkedIn app
2. Get API credentials (Client ID and Secret)
3. Configure OAuth settings
4. Set up credentials in N8N

## Step 1: Create a LinkedIn App

1. **Go to LinkedIn Developer Portal:**
   - Visit: https://www.linkedin.com/developers/
   - Sign in with your LinkedIn account

2. **Create a New App:**
   - Click **"Create App"** button
   - Fill out the required information:
     - **App name**: Something like "N8N Social Media Automation" or "Orchestrator AI Social Posts"
     - **LinkedIn Page**: Select your company page (or create one if needed)
     - **Privacy policy URL**: You can use a placeholder like `https://yourcompany.com/privacy`
     - **App logo**: Upload a logo (optional but recommended)
     - **Legal agreement**: Check the box to agree to terms

3. **Submit and Wait for Approval:**
   - LinkedIn will review your app (usually takes a few hours to a few days)
   - You'll get an email when it's approved

## Step 2: Get Your API Credentials

Once your app is approved:

1. **Go to your app dashboard** in the LinkedIn Developer Portal
2. **Click on the "Auth" tab**
3. **You'll see:**
   - **Client ID** (this is your client ID)
   - **Client Secret** (click "Show" to reveal it)

## Step 3: Configure OAuth Redirect URLs

1. **In the "Auth" tab, scroll down to "OAuth 2.0 settings"**
2. **Add these redirect URLs:**
   - `http://localhost:5678/rest/oauth2-credential/callback`
   - `https://your-n8n-domain.com/rest/oauth2-credential/callback` (if you have a production N8N instance)

## Step 4: Request Required Permissions

1. **In the "Products" tab, request these products:**
   - **Share on LinkedIn** (for posting content)
   - **Sign In with LinkedIn** (for authentication)

2. **Wait for approval** (LinkedIn will review your use case)

## Step 5: Configure in N8N

Once you have your credentials:

1. **Go to your N8N instance**: `http://localhost:5678`
2. **Navigate to Settings → Credentials**
3. **Click "Add Credential"**
4. **Select "LinkedIn OAuth2 API"**
5. **Fill in:**
   - **Client ID**: Your LinkedIn app's client ID
   - **Client Secret**: Your LinkedIn app's client secret
   - **Scope**: `r_liteprofile r_emailaddress w_member_social` (for posting)
6. **Click "Connect my account"** to authenticate
7. **Save the credential**

## Step 6: Update Your Workflow

The LinkedIn node in your workflow should now be able to use these credentials to post to your LinkedIn profile.

## Important Notes

### LinkedIn API Limitations:
- **Free tier**: Limited to 100 posts per day
- **Paid tier**: Higher limits available
- **Content restrictions**: Must comply with LinkedIn's content policies

### Alternative Approach - LinkedIn Company Page:
If you want to post to a company page instead of your personal profile:
1. **Create a LinkedIn Company Page** (if you don't have one)
2. **Request "Marketing Developer Platform"** product in your LinkedIn app
3. **Use the company page posting API** instead

### Testing:
Once configured, you can test the LinkedIn posting by:
1. **Activating your N8N workflow**
2. **Sending a test webhook request**
3. **Checking your LinkedIn profile** for the new post

## Troubleshooting

### Common Issues:
- **App not approved**: LinkedIn can take 1-3 business days to approve apps
- **OAuth errors**: Make sure redirect URLs are exactly correct
- **Permission denied**: Ensure you've requested the right products and they're approved
- **Rate limiting**: LinkedIn has strict rate limits, especially on free tier

### Getting Help:
- LinkedIn Developer Documentation: https://docs.microsoft.com/en-us/linkedin/
- LinkedIn Developer Community: https://www.linkedin.com/groups/5136892/

## Next Steps

After setting up LinkedIn credentials, you'll also need to configure:
- **Twitter API credentials** (for Twitter posting)
- **Facebook Graph API credentials** (for Facebook posting)
- **OpenAI API credentials** (for content generation)

See the main workflow documentation for complete setup instructions.

---

**Created**: September 22, 2025  
**For**: N8N Social Media Auto-Poster Workflow  
**Workflow ID**: ziIxAjjTPTzLhIAT
