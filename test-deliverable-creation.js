#!/usr/bin/env node

/**
 * Test script to verify deliverable creation logic for blog posts
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:4000';

// Test data - simulating what a blog post agent would generate
const testBlogContent = `# The Future of AI in Business: A Comprehensive Guide

Artificial Intelligence (AI) is revolutionizing the way businesses operate, offering unprecedented opportunities for innovation, efficiency, and growth. In this comprehensive guide, we'll explore the current landscape of AI in business and look ahead to what the future holds.

## Executive Summary

The integration of AI technologies into business processes is no longer a luxury—it's a necessity for companies looking to remain competitive in today's fast-paced market. From automating routine tasks to providing deep insights through data analysis, AI is transforming every aspect of business operations.

## Key Trends Shaping AI in Business

### 1. Automation and Process Optimization

AI-powered automation is streamlining workflows and reducing manual effort across industries. Companies are implementing intelligent systems that can:

- Process documents and extract key information
- Handle customer inquiries through advanced chatbots
- Optimize supply chain operations
- Automate financial processes and compliance checks

### 2. Predictive Analytics and Decision Making

Machine learning algorithms are enabling businesses to make data-driven decisions with greater accuracy. These systems can:

- Forecast market trends and customer behavior
- Identify potential risks and opportunities
- Optimize pricing strategies
- Enhance inventory management

### 3. Personalization at Scale

AI is making it possible to deliver personalized experiences to customers without manual intervention:

- Customized product recommendations
- Tailored marketing campaigns
- Dynamic pricing based on customer profiles
- Personalized customer service interactions

## Implementation Challenges

While the benefits are clear, businesses face several challenges when implementing AI solutions:

1. **Data Quality and Availability**: AI systems require high-quality, relevant data to function effectively
2. **Skills Gap**: Finding and retaining AI talent remains a significant challenge
3. **Integration Complexity**: Incorporating AI into existing systems can be technically challenging
4. **Ethical Considerations**: Ensuring AI systems are fair, transparent, and unbiased
5. **Regulatory Compliance**: Navigating evolving regulations around AI use

## Future Outlook

The future of AI in business is bright, with several emerging trends expected to drive further adoption:

- **Edge AI**: Processing AI computations locally to reduce latency and improve privacy
- **Explainable AI**: Making AI decision-making processes more transparent and understandable
- **AI-Human Collaboration**: Developing systems that augment human capabilities rather than replace them
- **Industry-Specific AI**: Tailored AI solutions for specific sectors and use cases

## Conclusion

As we look to the future, it's clear that AI will continue to play an increasingly important role in business strategy and operations. Companies that embrace AI technologies today will be better positioned to thrive in tomorrow's competitive landscape.

The key to success lies in understanding that AI is not just a technology investment—it's a business transformation that requires careful planning, proper execution, and ongoing adaptation to emerging trends and capabilities.`;

async function login() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'testuser@golfergeek.com',
      password: 'testuser01!'
    });
    
    console.log('✅ Login successful');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testBlogPostAgent(authToken) {
  try {
    console.log('\n🔍 Testing Blog Post Writer agent...');
    
    const response = await axios.post(
      `${API_BASE_URL}/agents/marketing/blog_post/tasks`,
      {
        prompt: 'Write a comprehensive blog post about "The Future of AI in Business" targeting business decision makers. Include practical examples and actionable insights.',
        providerId: 'openai',
        modelId: 'gpt-3.5-turbo'
      },
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Blog post task completed');
    console.log('📊 Task result:', {
      success: response.data.success,
      hasContent: !!response.data.result?.content,
      contentLength: response.data.result?.content?.length || 0,
      hasDeliverableId: !!response.data.result?.deliverableId,
      deliverableId: response.data.result?.deliverableId,
      taskId: response.data.taskId
    });

    if (response.data.result?.deliverableId) {
      console.log('🎉 SUCCESS: Deliverable was created with ID:', response.data.result.deliverableId);
      
      // Verify the deliverable exists
      try {
        const deliverableResponse = await axios.get(
          `${API_BASE_URL}/deliverables/${response.data.result.deliverableId}`,
          {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }
        );
        
        console.log('✅ Deliverable verified:', {
          id: deliverableResponse.data.id,
          title: deliverableResponse.data.title,
          type: deliverableResponse.data.deliverable_type,
          format: deliverableResponse.data.format,
          contentLength: deliverableResponse.data.content.length
        });
        
      } catch (error) {
        console.error('❌ Failed to fetch deliverable:', error.response?.data || error.message);
      }
    } else {
      console.log('❌ PROBLEM: No deliverable was created');
      console.log('📝 Response content preview:', response.data.result?.content?.substring(0, 200) + '...');
    }

    return response.data;
    
  } catch (error) {
    console.error('❌ Blog post test failed:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting deliverable creation test...');
    
    // Login first
    const authToken = await login();
    
    // Test blog post deliverable creation
    await testBlogPostAgent(authToken);
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();