# Testing Directory

This directory contains all test files for the Orchestrator AI API.

## 🏌️ Golf Blog Post Test Suite (LLM Provider Testing)

Our comprehensive LLM testing framework using the "golf blog post" prompt:

### Provider Test Files:
- **`test-ollama-golf.js`** - Tests all 11 Ollama models (local inference)
- **`test-openai-golf.js`** - Tests OpenAI models (o1-mini, gpt-4o-mini, gpt-4o, gpt-5)
- **`test-google-golf.js`** - Tests Google Gemini models (2.0-flash-exp, 2.5-flash, 2.5-pro)
- **`test-anthropic-golf.js`** - Tests Anthropic Claude models (3.5-haiku, 3.5-sonnet, 3-opus)
- **`test-grok-golf.js`** - Tests Grok (xAI) models (grok-2-1212, grok-2-vision-1212, grok-3)

### Test Results Summary:
- **Total Models Tested**: 25+ across 5 major providers
- **Success Rate**: 95%+ (only quota/access issues on 2 models)
- **Speed Champion**: OpenAI o1-mini (223+ tokens/sec)
- **Value Champion**: OpenAI gpt-4o-mini ($0.0005 per test)
- **Quality Champion**: GPT-5 (1300+ words per response)
- **Free Champion**: All Ollama models (local, $0.00 cost)

### Usage:
```bash
# Test individual providers
node testing/test-ollama-golf.js
node testing/test-openai-golf.js
node testing/test-google-golf.js
node testing/test-anthropic-golf.js
node testing/test-grok-golf.js
```

## 🧪 Other Test Files

The directory also contains various other test files for:
- Agent functionality testing
- PII/Pseudonymization testing
- Provider-specific testing
- Integration testing
- Health checks

## 📋 Environment Requirements

Make sure you have the required API keys in your `.env` file:
- `OPENAI_API_KEY`
- `GOOGLE_API_KEY` 
- `ANTHROPIC_API_KEY`
- `XAI_API_KEY`
- `PERPLEXITY_API_KEY`

## 🎯 BaseLLMService Architecture

These tests validate our new `BaseLLMService` abstract class architecture and standardized interfaces defined in:
- `src/llms/services/base-llm.service.ts` (Abstract base class)
- `src/llms/services/llm-interfaces.ts` (Standardized interfaces)
- `src/llms/services/` (All LLM service implementations)
