#!/usr/bin/env node

/**
 * Direct test of deliverable detection logic
 */

// Mock the deliverable content detection logic from the A2A base service
function isDeliverableContent(content) {
  // Look for deliverable markers
  const deliverableMarkers = [
    /^#\s+(.+)/m, // Markdown headers
    /^##\s+(.+)/m,
    /^\*\*(.+)\*\*$/m, // Bold titles
    /DELIVERABLE:/i,
    /DOCUMENT:/i,
    /REPORT:/i,
    /ANALYSIS:/i,
    /PLAN:/i,
    /REQUIREMENTS:/i,
  ];

  // Check for structured content (multiple sections OR substantial length)
  // Lowered threshold to catch more content as deliverables
  const hasStructure = content.includes('\n\n') || content.length > 300;
  const hasMarkers = deliverableMarkers.some(marker => marker.test(content));

  console.log('🔍 Deliverable content analysis:', {
    contentLength: content.length,
    hasMultipleParagraphs: content.includes('\n\n'),
    lengthThresholdMet: content.length > 300,
    hasStructure,
    hasMarkers,
    isDeliverable: hasStructure || hasMarkers
  });

  return hasStructure || hasMarkers;
}

// Test different types of content
const testCases = [
  {
    name: 'Blog Post with Headers',
    content: `# The Future of AI in Business

Artificial Intelligence is revolutionizing how businesses operate. In this post, we'll explore the key trends.

## Key Benefits

AI provides numerous benefits including:
- Automation of routine tasks
- Enhanced decision making
- Improved customer experiences

## Conclusion

The future of AI in business is bright and companies should start adopting these technologies today.`
  },
  {
    name: 'Short Blog Post',
    content: `# Quick AI Tips

Here are 5 quick tips for implementing AI in your business:

1. Start with clear objectives
2. Ensure data quality
3. Train your team
4. Monitor performance
5. Scale gradually

These tips will help you succeed with AI adoption.`
  },
  {
    name: 'Simple Response',
    content: `AI is important for businesses because it can automate tasks and improve efficiency. Companies should consider implementing AI solutions.`
  },
  {
    name: 'Structured Content without Headers',
    content: `The impact of artificial intelligence on business operations has been transformative. Companies across industries are leveraging AI to streamline processes, reduce costs, and enhance customer experiences.

Key benefits include improved decision making through predictive analytics, automated customer service through chatbots, and enhanced operational efficiency through process automation.

However, implementation challenges exist. Organizations must address data quality issues, skill gaps, and integration complexities. Success requires careful planning and phased implementation.

Looking ahead, emerging trends like edge AI, explainable AI, and industry-specific solutions will drive further adoption. Companies that invest in AI capabilities today will be better positioned for future success.`
  }
];

console.log('🚀 Testing deliverable content detection logic...\n');

testCases.forEach((testCase, index) => {
  console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
  console.log(`Content preview: "${testCase.content.substring(0, 100)}..."`);
  
  const isDeliverable = isDeliverableContent(testCase.content);
  console.log(`Result: ${isDeliverable ? '✅ DELIVERABLE' : '❌ NOT DELIVERABLE'}\n`);
});

console.log('🎯 Summary: The logic should detect structured content (multiple paragraphs OR >300 chars) OR content with deliverable markers as deliverables.');