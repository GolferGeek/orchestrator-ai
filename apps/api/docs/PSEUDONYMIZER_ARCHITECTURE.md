# Pseudonymizer Service Architecture

## 🎯 **Clean Separation of Concerns**

The new `PseudonymizerService` centralizes ALL pseudonymization logic and removes it from the LLM service entirely.

## 🏗️ **New Architecture**

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     Agent       │    │ PseudonymizerSvc │    │   LLM Service   │
│                 │    │                  │    │                 │
│ 1. Get user     │    │ • Detect PII     │    │ • Generate      │
│    input        │───▶│ • Create pseudo  │    │   response      │
│                 │    │ • Store mappings │    │ • No PII logic  │
│ 2. Pseudonymize │    │ • Cache context  │    │                 │
│    before LLM   │    │                  │    │                 │
│                 │    │                  │    │                 │
│ 3. Call LLM     │────┼──────────────────┼───▶│                 │
│    with pseudo  │    │                  │    │                 │
│                 │    │                  │    │                 │
│ 4. Get response │◀───┼──────────────────┼────│                 │
│                 │    │                  │    │                 │
│ 5. Reverse      │───▶│ • Lookup cache   │    │                 │
│    pseudonyms   │    │ • Apply mappings │    │                 │
│                 │    │ • Return original│    │                 │
│ 6. Return to    │    │                  │    │                 │
│    user         │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔄 **LLM Service Flow**

### **Before (Broken)**
```typescript
// LLM service has scattered pseudonymization logic
// Multiple services (PIIService, DataSanitizationService, etc.)
// Reversal context gets lost in complex indirection
// Agents get 500 errors due to complexity
```

### **After (Clean)**
```typescript
// LLM Service handles pseudonymization internally and transparently
async generateResponse(systemPrompt, userMessage, options) {
  const requestId = options.conversationId || generateRequestId();
  
  // 1. Pseudonymize input right before LLM call
  const pseudonymResult = await this.pseudonymizerService.pseudonymizeText(
    userMessage,
    requestId
  );
  
  // 2. Call LLM with pseudonymized text
  const llmResponse = await this.callLLMProvider(
    systemPrompt,
    pseudonymResult.pseudonymizedText,
    options
  );
  
  // 3. Reverse pseudonyms in response right after LLM call
  const reversalResult = await this.pseudonymizerService.reversePseudonyms(
    llmResponse,
    requestId
  );
  
  // 4. Return clean response (agents never see pseudonyms)
  return reversalResult.originalText;
}
```

### **Agent Flow (Simplified)**
```typescript
// Agents just call LLM service normally - no pseudonymization concerns!
const response = await llmService.generateResponse(
  systemPrompt,
  userMessage,  // Raw input - LLM service handles pseudonymization
  options
);
// Response is already clean - no pseudonyms visible to agent or user
```

## 🎭 **PseudonymizerService Responsibilities**

### **Core Functions**
- `pseudonymizeText(text, requestId)` - Detect PII and replace with pseudonyms
- `reversePseudonyms(text, requestId)` - Convert pseudonyms back to original values

### **Database Management**
- Store pseudonym mappings in `pseudonym_mappings` table
- Cache reversal contexts in `pseudonym_reversal_contexts` table
- Maintain audit trail in `pseudonym_audit_log` table
- Handle consistent pseudonym generation (same input = same pseudonym)

### **Performance Optimization**
- In-memory cache for fast reversal lookups
- Automatic cache expiry and cleanup
- Fallback to database when cache misses
- Async audit logging to avoid blocking

## 🚫 **What LLM Service NO LONGER Does**

- ❌ PII detection
- ❌ Pseudonym generation
- ❌ Pseudonym reversal
- ❌ Sanitization context management
- ❌ Database storage of pseudonym mappings

## ✅ **What LLM Service ONLY Does**

- ✅ Generate responses from text input
- ✅ Handle provider routing
- ✅ Manage model selection
- ✅ Track usage metrics
- ✅ Handle authentication and authorization

## 🔧 **Implementation Plan**

### **Phase 1: Create PseudonymizerService**
- ✅ Implement centralized pseudonymization logic
- ✅ Add database storage and caching
- ✅ Create clean API interface

### **Phase 2: Integrate PseudonymizerService into LLM Service**
- 🔄 Add PseudonymizerService to LLMService constructor
- 🔄 Modify `generateResponse()` to pseudonymize before LLM calls
- 🔄 Modify `generateResponse()` to reverse after LLM responses
- 🔄 Remove existing scattered pseudonymization logic

### **Phase 3: Agents Remain Simple**
- ✅ No changes needed to agent code!
- ✅ Agents continue calling `llmService.generateResponse()` normally
- ✅ Pseudonymization becomes transparent to agents

### **Phase 4: Update Other Services**
- 🔄 Remove DataSanitizationService (or simplify to only handle redaction)
- 🔄 Update PIIService to only handle policy checking
- 🔄 Clean up service dependencies

## 🧪 **Testing Strategy**

1. **Unit Tests**: Test PseudonymizerService in isolation
2. **Integration Tests**: Test agent flow with pseudonymization
3. **End-to-End Tests**: Test complete user journey with authentication
4. **Performance Tests**: Verify cache performance and database fallback

## 📊 **Benefits**

- **Clean Separation**: Each service has a single responsibility
- **Better Performance**: In-memory caching for fast reversals
- **Easier Testing**: Isolated pseudonymization logic
- **Better Debugging**: Clear flow and error handling
- **Maintainability**: No more scattered pseudonymization code
- **Reliability**: Proper database storage and audit trails
