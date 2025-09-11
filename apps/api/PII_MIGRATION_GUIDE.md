# PII System Migration Guide

## Overview

We're simplifying the PII system from a complex, nested structure to a clean, simple one. This guide shows how to migrate existing code.

## Key Changes

### Old Complex Structure
```typescript
PIIProcessingMetadata {
  piiDetected: boolean;
  showstopperDetected: boolean;
  detectionResults: {
    totalMatches: number;
    flaggedMatches: PIIMatch[];
    showstopperMatches?: PIIMatch[];
    dataTypesSummary: Record<string, DataTypeSummary>;
    severityBreakdown: SeverityBreakdown;
  };
  policyDecision: PolicyDecision;
  pseudonymInstructions?: PseudonymInstructions;
  pseudonymResults?: PseudonymResults;
  userMessage: UserMessage;
  processingFlow: ProcessingFlow;
  processingSteps: string[];
  timestamps: ProcessingTimestamps;
}
```

### New Simple Structure
```typescript
SimplifiedPIIMetadata {
  flags: PIIFlag[];           // Pattern-detected PII
  pseudonyms: PIIPseudonym[]; // Dictionary-replaced items
  flagCount: number;
  pseudonymCount: number;
  blocked?: boolean;
  blockingReason?: string;
}
```

## Migration Examples

### Before: Complex Routing Service
```typescript
// OLD - Complex with multiple PII checks
async route(prompt: string, options: any) {
  // Check showstoppers
  const piiResult = await this.piiService.checkPolicy(prompt, options);
  if (piiResult.metadata.showstopperDetected) {
    return { blocked: true, piiMetadata: piiResult.metadata };
  }
  
  // Apply dictionary pseudonymization separately
  const pseudonymResult = await this.dictionaryService.pseudonymizeText(prompt);
  
  // Merge complex metadata
  const metadata = {
    ...piiResult.metadata,
    pseudonymInstructions: { /* complex */ },
    pseudonymResults: { /* complex */ }
  };
  
  return { provider, model, piiMetadata: metadata };
}
```

### After: Simple Routing Service
```typescript
// NEW - Single clean call
async route(prompt: string, options: any) {
  // Everything in one call
  const { processedText, metadata, dictionaryMappings } = 
    await this.piiService.processPII(prompt, options);
  
  if (metadata.blocked) {
    return { blocked: true, piiMetadata: metadata };
  }
  
  return { 
    provider, 
    model, 
    piiMetadata: metadata,
    dictionaryMappings // For reversal later
  };
}
```

### Before: Complex LLM Service
```typescript
// OLD - Multiple PII processing steps
async generateResponse(prompt: string) {
  // Check PII policy
  const piiCheck = await this.piiService.checkPolicy(prompt);
  
  // Apply dictionary separately
  const dictResult = await this.dictionaryService.pseudonymizeText(prompt);
  
  // Complex metadata merging
  const piiMetadata = {
    ...piiCheck.metadata,
    pseudonymsApplied: dictResult.mappings.map(/* transform */),
    // ... lots of complex nesting
  };
  
  // Send to LLM
  const response = await llm.invoke(processedPrompt);
  
  // Reverse pseudonyms
  const reversed = await this.dictionaryService.reversePseudonyms(response);
  
  return { content: reversed, piiMetadata };
}
```

### After: Simple LLM Service
```typescript
// NEW - Clean pass-through
async generateResponse(prompt: string, routingDecision: any) {
  // PII already processed by routing
  const { piiMetadata, dictionaryMappings } = routingDecision;
  
  // Send to LLM (text already pseudonymized if needed)
  const response = await llm.invoke(prompt);
  
  // Reverse if needed
  if (dictionaryMappings?.length > 0) {
    const { originalText } = await this.piiService.reversePseudonyms(
      response, 
      dictionaryMappings
    );
    return { content: originalText, piiMetadata };
  }
  
  return { content: response, piiMetadata };
}
```

### Before: Agent Getting PII Counts
```typescript
// OLD - Navigate complex structure
const flagCount = 
  metadata?.detectionResults?.flaggedMatches?.length || 
  metadata?.detectionResults?.totalMatches || 0;

const pseudonymCount = 
  metadata?.pseudonymResults?.processedMatches?.length ||
  metadata?.pseudonymResults?.mappingsCount ||
  metadata?.pseudonymInstructions?.targetMatches?.length || 0;
```

### After: Agent Getting PII Counts
```typescript
// NEW - Direct access
const flagCount = metadata?.flagCount || 0;
const pseudonymCount = metadata?.pseudonymCount || 0;
```

## Step-by-Step Migration

1. **Install Simplified Module**
   ```typescript
   import { SimplifiedPIIModule } from './services/pii-simplified.module';
   
   @Module({
     imports: [SimplifiedPIIModule],
     // ...
   })
   ```

2. **Update Service Injection**
   ```typescript
   // OLD
   constructor(
     private piiService: PIIService,
     private dictionaryService: DictionaryPseudonymizerService,
     private centralizedRouting: CentralizedRoutingService
   ) {}
   
   // NEW
   constructor(
     private piiService: SimplifiedPIIService,
     private routing: SimplifiedCentralizedRoutingService
   ) {}
   ```

3. **Update Method Calls**
   - Replace `piiService.checkPolicy()` with `piiService.processPII()`
   - Remove separate `dictionaryService.pseudonymizeText()` calls
   - Use `metadata.flags` instead of `metadata.detectionResults.flaggedMatches`
   - Use `metadata.pseudonyms` instead of complex pseudonym structures

4. **Update Frontend**
   - Use `simplifiedPii` field in message metadata
   - Direct access to `flagCount` and `pseudonymCount`

## Benefits

1. **Single Responsibility**: Each service does one thing
2. **Clear Data Flow**: PII processing happens once at routing
3. **Simple Structure**: No nested objects to navigate
4. **Easy Testing**: Simple in/out for each service
5. **Maintainable**: Easy to understand and modify

## Rollback Plan

Both systems can coexist during migration:
- Legacy services remain unchanged
- New simplified services available via `SimplifiedPIIModule`
- Frontend supports both metadata formats
- Gradual migration of services