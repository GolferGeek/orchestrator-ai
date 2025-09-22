# Social Media Post Generator - N8N Workflow Guide

This guide will help you create a comprehensive N8N workflow that takes social media input and generates optimized posts for LinkedIn, Twitter, and Facebook Marketplace.

## Workflow Overview

The workflow will:
1. Accept webhook input with content and context
2. Validate the input
3. Generate three different social media posts using AI
4. Return all posts in a structured response

## Step-by-Step Setup

### 1. Create New Workflow
- Open N8N at `http://localhost:5678`
- Click "New Workflow"
- Name it "Social Media Post Generator"

### 2. Add Webhook Trigger
- Drag a **Webhook** node from the trigger section
- Configure:
  - **HTTP Method**: POST
  - **Path**: `social-media-input`
  - **Respond**: "Using 'Respond to Webhook' Node"
- This will create a webhook URL like: `http://localhost:5678/webhook/social-media-input`

### 3. Add Input Validation
- Add an **IF** node after the webhook
- Configure condition:
  - **Value 1**: `{{ $json.content }}`
  - **Operation**: "is not empty"
- This ensures we have content to work with

### 4. Add AI Content Generators

#### LinkedIn Post Generator
- Add an **OpenAI** node
- Configure:
  - **Resource**: Chat
  - **Operation**: Complete
  - **Model**: gpt-3.5-turbo
  - **Messages**:
    - **System**: "You are a professional LinkedIn content writer. Create engaging, professional LinkedIn posts that are 1300-3000 characters, use professional tone, include 3-5 relevant hashtags, encourage engagement, are suitable for B2B audience, and include a call-to-action when appropriate."
    - **User**: "Create a LinkedIn post based on this content: {{ $json.content }}\n\nAdditional context: {{ $json.context || 'No additional context provided' }}"

#### Twitter Post Generator
- Add another **OpenAI** node
- Configure:
  - **Resource**: Chat
  - **Operation**: Complete
  - **Model**: gpt-3.5-turbo
  - **Messages**:
    - **System**: "You are a Twitter content writer. Create engaging Twitter posts that are under 280 characters, use conversational tone, include 1-3 relevant hashtags, are engaging and shareable, use emojis appropriately, and include a call-to-action when space allows."
    - **User**: "Create a Twitter post based on this content: {{ $json.content }}\n\nAdditional context: {{ $json.context || 'No additional context provided' }}"

#### Facebook Marketplace Post Generator
- Add a third **OpenAI** node
- Configure:
  - **Resource**: Chat
  - **Operation**: Complete
  - **Model**: gpt-3.5-turbo
  - **Messages**:
    - **System**: "You are a Facebook Marketplace content writer. Create engaging Facebook Marketplace posts that are 100-500 characters, use friendly approachable tone, include relevant details about the item/service, use emojis to make it visually appealing, include clear pricing if applicable, and encourage local engagement."
    - **User**: "Create a Facebook Marketplace post based on this content: {{ $json.content }}\n\nAdditional context: {{ $json.context || 'No additional context provided' }}\n\nItem details: {{ $json.item_details || 'No specific item details' }}"

### 5. Combine Results
- Add a **Merge** node after all three AI generators
- Configure:
  - **Mode**: "Combine"
  - **Combine By**: "Combine All"

### 6. Add Response Nodes

#### Success Response
- Add a **Respond to Webhook** node
- Configure:
  - **Respond With**: JSON
  - **Response Body**:
```json
{
  "status": "success",
  "message": "Social media posts generated successfully",
  "posts": {
    "linkedin": "{{ $json.linkedin_post }}",
    "twitter": "{{ $json.twitter_post }}",
    "facebook": "{{ $json.facebook_post }}"
  }
}
```

#### Error Response
- Add another **Respond to Webhook** node for the "false" path of the IF node
- Configure:
  - **Respond With**: JSON
  - **Response Body**:
```json
{
  "status": "error",
  "message": "Invalid input: Content is required"
}
```

### 7. Connect the Nodes
Connect the nodes in this order:
1. Webhook → IF (validation)
2. IF (true) → All three OpenAI nodes (parallel)
3. All three OpenAI nodes → Merge
4. Merge → Success Response
5. IF (false) → Error Response

### 8. Configure OpenAI Credentials
- You'll need to set up OpenAI credentials in N8N
- Go to Settings → Credentials
- Add new "OpenAI API" credential
- Enter your OpenAI API key

## Testing the Workflow

### 1. Activate the Workflow
- Click the "Active" toggle in the top right
- The webhook will now be live

### 2. Test with Sample Data
Use this curl command to test:

```bash
curl -X POST "http://localhost:5678/webhook/social-media-input" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "We just launched our new AI-powered social media automation tool that helps businesses create engaging content across multiple platforms.",
    "context": "Product launch announcement",
    "item_details": "Software tool for social media management"
  }'
```

### 3. Expected Response
You should get a response like:
```json
{
  "status": "success",
  "message": "Social media posts generated successfully",
  "posts": {
    "linkedin": "🚀 Excited to announce the launch of our new AI-powered social media automation tool! This innovative solution helps businesses create engaging, platform-optimized content that drives real results... #AI #SocialMedia #Automation #BusinessGrowth",
    "twitter": "🚀 Just launched our AI-powered social media automation tool! Create engaging content across all platforms with ease. Perfect for businesses looking to scale their social presence. #AI #SocialMedia #Launch",
    "facebook": "🚀 NEW: AI-Powered Social Media Automation Tool! 🎯 Create engaging posts for LinkedIn, Twitter & Facebook automatically. Perfect for local businesses wanting to boost their online presence! 💪 #SocialMedia #AI #LocalBusiness"
  }
}
```

## Advanced Features

### 1. Add More Platforms
You can easily extend this workflow to include:
- Instagram posts
- TikTok captions
- YouTube descriptions
- Blog post summaries

### 2. Add Content Templates
Create different templates for:
- Product launches
- Event announcements
- Educational content
- Promotional posts

### 3. Add Scheduling
Integrate with scheduling tools like:
- Buffer
- Hootsuite
- Later
- Facebook Creator Studio

### 4. Add Analytics
Track performance by integrating with:
- Google Analytics
- Facebook Insights
- Twitter Analytics
- LinkedIn Analytics

## Troubleshooting

### Common Issues:
1. **OpenAI API errors**: Check your API key and credits
2. **Webhook not responding**: Ensure the workflow is active
3. **Content too long**: Adjust the AI prompts for character limits
4. **Missing context**: Add more detailed prompts for better results

### Tips:
- Test with different content types
- Adjust AI prompts based on your brand voice
- Monitor API usage to avoid rate limits
- Save successful prompts as templates
