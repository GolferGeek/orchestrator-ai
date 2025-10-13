# 5 Popular Agentic AI Design Patterns

**Source:** [MarkTechPost Article](https://www.marktechpost.com/2025/10/12/5-most-popular-agentic-ai-design-patterns-every-ai-engineer-should-know/)  
**Date:** October 12, 2025  
**Author:** Arham Islam

## Overview

Modern AI agents require structured design patterns to handle complex, real-world tasks. These patterns define how agents think, act, and collaborate beyond simple chatbot interactions.

---

## 1. ReAct Agent (Reasoning + Acting)

**Concept:** Combines step-by-step reasoning with external tool usage.

**How it works:**
- Agent alternates between thinking, acting, and observing
- Similar to human problem-solving (plan → execute → adjust)
- Uses external tools when needed (search, code execution, APIs)

**Example analogy:** Planning dinner by checking your fridge, observing what's available, then adjusting your plan based on ingredients found.

**Architecture:** Agent has access to multiple tools, decides when to invoke them, and can re-run actions after new observations.

---

## 2. CodeAct Agent

**Concept:** AI that writes, executes, and refines code based on natural language instructions.

**Key capabilities:**
- Generate code from natural language
- Execute code in safe sandbox environments
- Analyze execution results
- Iterate based on feedback

**Components:**
- Code execution environment
- Workflow definition
- Prompt engineering
- Memory management

**Real-world example:** Manus AI - uses agent loop to analyze requests, select tools/APIs, execute in Linux sandbox, iterate until completion.

---

## 3. Self-Reflection Agent

**Concept:** AI that evaluates its own work and improves through iteration.

**Process cycle:**
1. Generate initial output
2. Reflect on quality (identify errors/improvements)
3. Refine output based on self-feedback
4. Repeat until high-quality result achieved

**Use cases:** Tasks benefiting from iterative improvement - writing, code generation, complex analysis.

**Advantage:** More reliable than single-pass generation.

---

## 4. Multi-Agent Workflow (MAS)

**Concept:** Team of specialized agents instead of single general-purpose agent.

**Benefits:**
- Each agent focuses on specific expertise
- Tailored prompts per agent (can use different LLMs)
- Independent evaluation and improvement
- Parallel task execution

**Architecture:** User prompt decomposed into specialized tasks handled by separate agents (e.g., Research, Coding, Reviewer), then synthesized into final output.

**Advantage:** Complex problems divided into manageable, specialized units.

---

## 5. Agentic RAG (Retrieval-Augmented Generation)

**Concept:** Autonomous agents actively manage retrieval and generation processes.

**Difference from traditional RAG:**
- Dynamic vs. static retrieval
- Active searching and evaluation
- Memory of past interactions
- Context-aware responses

**Three main components:**
1. **Retrieval System** - Fetches relevant information (BM25, dense embeddings)
2. **Generation Model** - LLM converts retrieved data to responses
3. **Agent Layer** - Coordinates retrieval/generation, maintains memory

**Result:** Smarter, more contextual answers than traditional RAG.

---

## Relevance to Our Project

These patterns directly apply to our orchestration system:

- **ReAct** → Our agent runners with tool access
- **Multi-Agent** → Our orchestration of specialized agents (finance-manager, summarizer, etc.)
- **Self-Reflection** → Potential checkpoint/approval improvements
- **CodeAct** → Supabase-agent and tool agents executing operations
- **Agentic RAG** → Context agents with memory and retrieval

Understanding these patterns helps us design better agent interactions and orchestration flows.

---

## Tags
#AI #Agents #DesignPatterns #Architecture #Orchestration

