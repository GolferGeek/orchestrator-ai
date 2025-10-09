# Metrics Agent Walkthrough Video Script
**Target Duration:** 9 minutes  
**Purpose:** Deep dive into Finance Metrics Agent capabilities  
**Audience:** Business owners, finance teams, managers needing data insights

---

## PRE-RECORDING SETUP
- [ ] Open Orchestrator AI platform
- [ ] Navigate to Finance/Metrics agent
- [ ] Prepare sample business scenarios
- [ ] Have SQL query examples ready
- [ ] Test screen recording setup
- [ ] Ensure database connection is working

---

## SCRIPT

### Opening Hook (0:00 - 0:45)
**[SCREEN: Orchestrator AI main interface]**

> "Okay, real talk - are you like me where you have a million spreadsheets but still have no idea if your business is actually doing well? I built our Finance Metrics agent because I was tired of spending hours trying to figure out basic stuff like 'are we making money' and 'should I be worried about this month's numbers?'"

**[ACTION: Navigate to Metrics agent]**

> "I'm going to show you exactly how I use this agent to understand what's happening in our business. No fancy business school stuff - just practical 'is my business healthy or not' kind of insights."

### Agent Introduction & Capabilities (0:45 - 1:45)
**[SCREEN: Metrics agent interface/description]**

> "So this agent is basically like having a CFO who actually knows what they're doing and doesn't speak in confusing finance jargon. It connects to your database and can make sense of all those numbers floating around."

**[ACTION: Show agent capabilities or context]**

> "The cool thing is it understands business context. Like, it knows that customer acquisition cost matters way more than just raw revenue numbers. It gets the difference between one-time sales and recurring revenue - stuff that actually matters for running a business."

**[ACTION: Start conversation with agent]**

> "Let me show you with the exact question I ask myself every month: 'How are we actually doing revenue-wise?'"

### Scenario 1: Revenue Analysis (1:45 - 3:30)
**[SCREEN: Chat interface with Metrics agent]**

> "So here's what I actually ask it every month - and this is a real question that keeps me up at night:"

**[TYPE IN CHAT:]**
```
How's our revenue looking over the last year? Are we trending up or down, and should I be worried about anything? I want to understand if we're growing or if I need to make some changes.
```

**[ACTION: Send message and wait for response]**

> "Look at this - it immediately goes and actually checks our database. It's not just making stuff up or giving generic advice. It's looking at our actual numbers."

**[SCREEN: Show agent's SQL queries and results]**

> "See how it's pulling the real data, calculating month-over-month changes, and then - this is the key part - it tells me what it means in plain English."

**[ACTION: Scroll through agent's analysis]**

> "Like, it'll say 'Hey, March was rough - 15% drop, but here's why that probably happened.' It's doing the detective work I used to spend hours on."

### Scenario 2: Customer Metrics Deep Dive (3:30 - 5:15)
**[SCREEN: Continue conversation]**

> "Now here's the question that really matters - are we spending too much to get customers, and are those customers actually worth it?"

**[TYPE IN CHAT:]**
```
I need to understand our customer economics. What's our Customer Acquisition Cost (CAC) and Customer Lifetime Value (LTV)? Are we spending too much to acquire customers? Show me the numbers and tell me if I should be worried.
```

**[ACTION: Send message]**

> "This is where the agent's financial expertise really shines. CAC and LTV calculations can be complex, involving multiple data sources and specific formulas."

**[SCREEN: Show agent working through calculations]**

> "Watch how it breaks down the calculation methodology. It's not just giving me numbers - it's showing me exactly how these metrics are computed so I can verify and understand the logic."

**[ACTION: Review detailed calculations]**

> "The LTV/CAC ratio of 3.2:1 - the agent immediately flags this as healthy, explaining that a ratio above 3:1 typically indicates sustainable unit economics. This is exactly the kind of insight a CFO would provide."

### Scenario 3: Dashboard Creation (5:15 - 7:00)
**[SCREEN: Continue with dashboard request]**

> "Now let's say I need to present to investors or just want a simple overview I can check weekly. Here's how I ask for that:"

**[TYPE IN CHAT:]**
```
Create a simple business health dashboard for me. I want to see our key metrics in one place - revenue, new customers, churn rate, cash flow, and profit margins. Make it easy to understand at a glance whether things are going well or not.
```

**[ACTION: Send message]**

> "The agent understands that 'executive dashboard' means high-level, visually clear, and focused on key decision-making metrics."

**[SCREEN: Show formatted dashboard output]**

> "Look at this output - it's formatted for presentation, includes context about whether metrics are improving or declining, and provides benchmarking information."

**[ACTION: Highlight specific dashboard elements]**

> "Each metric includes the current value, trend direction, and comparison to previous periods. This is board-ready reporting generated in under a minute."

### Advanced Features: Predictive Insights (7:00 - 8:15)
**[SCREEN: New conversation thread or continue]**

> "Here's where it gets really useful - I can ask it to help me plan ahead and spot potential problems before they happen."

**[TYPE IN CHAT:]**
```
Based on how we've been doing, what should I expect for revenue next quarter? What are the biggest risks to watch out for, and what would need to happen for us to exceed our projections?
```

**[ACTION: Send and review response]**

> "Notice how it's not just extrapolating numbers - it's identifying the key variables that could impact the forecast. Customer retention rate, average deal size, sales cycle length - these are the metrics that actually drive revenue."

**[SCREEN: Show risk factors and recommendations]**

> "The agent is essentially providing scenario planning. 'If churn increases by 2%, revenue projection drops to X. If average deal size grows by 10%, revenue could exceed projections by Y.' This is strategic thinking, not just data reporting."

### Troubleshooting & Setup (8:15 - 8:45)
**[SCREEN: Show data setup scenario]**

> "What if your database is empty or not connected? The agent handles this gracefully."

**[TYPE EXAMPLE:]**
```
I'm getting 'no data found' errors when I ask about revenue. My database might be empty or not connected properly. Can you help me figure out what's wrong and how to set this up correctly?
```

**[ACTION: Show agent's helpful setup instructions]**

> "Instead of failing silently, the agent provides step-by-step instructions for setting up your data structure. It shows you exactly what tables you need, what sample data to insert, and how to verify everything is working."

### Closing & Next Steps (8:45 - 9:00)
**[SCREEN: Return to main interface]**

> "So that's how I actually use this thing. Instead of spending Sunday nights stressed out about spreadsheets, I just ask the agent what's going on and get straight answers. It's like having someone who actually enjoys digging through numbers."

**[ACTION: Show agent selection or dashboard]**

> "If you're like me and numbers make your head hurt, but you know you need to understand them to run your business well, give this a try. Ask it whatever's keeping you up at night about your business metrics."

---

## POST-PRODUCTION NOTES
- [ ] Highlight SQL queries in post-production for clarity
- [ ] Add callout boxes for key metrics (CAC, LTV, etc.)
- [ ] Include definition overlays for business terms
- [ ] Ensure all numbers and calculations are visible
- [ ] Add chapter markers for different scenarios

---

## KEY DEMO SCENARIOS TO EMPHASIZE
1. **Real Data**: Agent works with actual database, not fake data
2. **Business Context**: Provides insights, not just numbers
3. **Professional Output**: Board-ready formatting and analysis
4. **Predictive Capability**: Forward-looking insights and scenario planning
5. **Setup Support**: Helps users get started with proper data structure

---

## SAMPLE BUSINESS METRICS TO REFERENCE
- Monthly Recurring Revenue (MRR): $45,000
- Customer Acquisition Cost (CAC): $150
- Customer Lifetime Value (LTV): $480
- Churn Rate: 3.2% monthly
- Gross Margin: 68%
- LTV/CAC Ratio: 3.2:1

---

## TECHNICAL NOTES
- Keep SQL queries visible long enough to read
- Show database tables and structure when relevant
- Demonstrate both successful queries and error handling
- Include examples of data validation and quality checks
- Show how agent explains its reasoning for calculations