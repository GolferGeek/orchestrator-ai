# 🎭 VIP List Management API Reference

**Base URL**: `http://localhost:7000/sanitization`

This API provides complete CRUD operations for managing VIP lists, custom PII patterns, and pseudonym dictionaries.

---

## 📋 **PII Pattern Management (VIP Lists)**

### **GET** `/pii/patterns` - List All VIP Patterns
```bash
curl -X GET "http://localhost:7000/sanitization/pii/patterns"
```
**Response:**
```json
{
  "patterns": [
    {
      "name": "vip_tech_executives",
      "dataType": "name",
      "pattern": "/\\b(?:Tim Cook|Elon Musk)\\b/gi",
      "description": "Tech executive VIP names",
      "priority": 5,
      "enabled": true
    }
  ],
  "stats": {
    "builtInPatterns": 15,
    "customPatterns": 3,
    "totalPatterns": 18,
    "enabledPatterns": 17
  },
  "totalPatterns": 18,
  "dataTypes": ["email", "phone", "name", "address", "ip_address", "username", "credit_card", "ssn", "custom"]
}
```

### **POST** `/pii/patterns` - Add New VIP Pattern
```bash
curl -X POST "http://localhost:7000/sanitization/pii/patterns" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vip_tech_executives",
    "dataType": "name",
    "pattern": "\\b(?:Tim Cook|Elon Musk|Jeff Bezos)\\b",
    "description": "Tech executive VIP names",
    "priority": 5
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "PII pattern 'vip_tech_executives' added successfully",
  "pattern": { "name": "vip_tech_executives", ... }
}
```

### **PUT** `/pii/patterns/:name` - Update VIP Pattern ✨ *NEW*
```bash
curl -X PUT "http://localhost:7000/sanitization/pii/patterns/vip_tech_executives" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "vip_tech_executives_updated",
    "dataType": "name",
    "pattern": "\\b(?:Tim Cook|Elon Musk|Jeff Bezos|Satya Nadella)\\b",
    "description": "Updated tech executive VIP names",
    "priority": 3
  }'
```

### **DELETE** `/pii/patterns/:name` - Delete VIP Pattern ✨ *NEW*
```bash
curl -X DELETE "http://localhost:7000/sanitization/pii/patterns/vip_tech_executives"
```
**Response:**
```json
{
  "success": true,
  "message": "PII pattern 'vip_tech_executives' deleted successfully"
}
```

### **POST** `/pii/test` - Test VIP Detection
```bash
curl -X POST "http://localhost:7000/sanitization/pii/test" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Meeting with Tim Cook from Apple scheduled for 3pm",
    "dataTypes": ["name"],
    "minConfidence": 0.8
  }'
```
**Response:**
```json
{
  "success": true,
  "originalText": "Meeting with Tim Cook from Apple scheduled for 3pm",
  "detectionResult": {
    "matches": [
      {
        "value": "Tim Cook",
        "dataType": "name",
        "patternName": "vip_tech_executives",
        "startIndex": 13,
        "endIndex": 21,
        "confidence": 1.0
      }
    ],
    "processingTime": 12,
    "patternsChecked": 18
  },
  "matchCount": 1
}
```

---

## 🔒 **Redaction Pattern Management**

### **GET** `/redaction/patterns` - List Redaction Patterns
```bash
curl -X GET "http://localhost:7000/sanitization/redaction/patterns"
```

### **POST** `/redaction/patterns` - Add Redaction Pattern
```bash
curl -X POST "http://localhost:7000/sanitization/redaction/patterns" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "custom_project_codes",
    "pattern": "\\bPROJECT-[A-Z0-9]{4,8}\\b",
    "replacement": "[PROJECT_CODE]",
    "description": "Internal project codes",
    "category": "corporate",
    "priority": 20
  }'
```

### **DELETE** `/redaction/patterns/:name` - Delete Redaction Pattern
```bash
curl -X DELETE "http://localhost:7000/sanitization/redaction/patterns/custom_project_codes"
```

---

## 🎭 **Pseudonymization Management**

### **POST** `/pseudonym/generate` - Generate Pseudonym
```bash
curl -X POST "http://localhost:7000/sanitization/pseudonym/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "Tim Cook",
    "dataType": "name",
    "context": "executive"
  }'
```
**Response:**
```json
{
  "success": true,
  "originalValue": "Tim Cook",
  "pseudonym": "Alexander Sterling",
  "dataType": "name",
  "isNew": false,
  "context": "executive"
}
```

### **POST** `/pseudonym/lookup` - Lookup Existing Pseudonym
```bash
curl -X POST "http://localhost:7000/sanitization/pseudonym/lookup" \
  -H "Content-Type: application/json" \
  -d '{
    "value": "Tim Cook",
    "dataType": "name"
  }'
```

---

## 🧪 **Testing & Debugging**

### **POST** `/test` - Complete Sanitization Test
```bash
curl -X POST "http://localhost:7000/sanitization/test" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hi, I am Tim Cook from Apple. My API key is sk-1234567890abcdef.",
    "enablePseudonymization": true,
    "enableRedaction": true,
    "context": "demo"
  }'
```
**Response:**
```json
{
  "success": true,
  "result": {
    "sanitizedText": "Hi, I am Alexander Sterling from Strategic-Solutions. My API key is sk-[REDACTED].",
    "originalLength": 68,
    "sanitizedLength": 78,
    "piiDetected": true,
    "secretsDetected": true,
    "pseudonymsApplied": 2,
    "redactionsApplied": 1,
    "processingTimeMs": 45
  }
}
```

### **GET** `/stats` - Service Statistics
```bash
curl -X GET "http://localhost:7000/sanitization/stats"
```
**Response:**
```json
{
  "redactionPatternStats": {
    "totalPatterns": 25,
    "customPatterns": 5,
    "productionMode": false,
    "verboseLogging": true
  },
  "piiPatternStats": {
    "builtInPatterns": 15,
    "customPatterns": 3,
    "totalPatterns": 18,
    "enabledPatterns": 17,
    "lastRefresh": "2025-01-04T15:30:00Z"
  },
  "pseudonymizationStats": {
    "totalMappings": 156,
    "customPatterns": 3,
    "dictionaryEntries": 89,
    "cacheHitRate": 0.78
  }
}
```

---

## 🎨 **UI Implementation Guide**

### **Recommended UI Components**

1. **VIP Pattern Management Table**
   - List all patterns with edit/delete actions
   - Add new pattern modal/form
   - Test pattern functionality
   - Priority sorting and filtering

2. **Pattern Testing Interface**
   - Text input for testing
   - Real-time pattern matching
   - Highlighting of detected entities
   - Before/after comparison

3. **Statistics Dashboard**
   - Service health metrics
   - Pattern usage statistics
   - Performance monitoring

4. **Pseudonym Dictionary Manager**
   - Category-based organization
   - Bulk import/export
   - Frequency weight management

### **Error Handling**
All endpoints return consistent error format:
```json
{
  "success": false,
  "message": "Detailed error message",
  "error": "ERROR_CODE" // Optional
}
```

### **Validation Rules**
- Pattern names must be unique
- Regex patterns must be valid
- Priority must be 1-100 (lower = higher priority)
- Data types are enum-validated

---

## 🚀 **Next Steps for UI Development**

1. ✅ **API Endpoints**: Complete CRUD operations available
2. 🎯 **UI Framework**: Vue.js components recommended
3. 📊 **Real-time Updates**: WebSocket support for live pattern testing
4. 🔐 **Authentication**: Integrate with existing user management
5. 📱 **Responsive Design**: Mobile-friendly pattern management

The API is **production-ready** and provides all necessary endpoints for a comprehensive VIP list management UI!
