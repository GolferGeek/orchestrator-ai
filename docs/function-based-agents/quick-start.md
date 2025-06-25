# Quick Start Guide

Get your first function-based agent running in 5 minutes! This guide will walk you through creating both TypeScript and Python agents.

## Prerequisites

- Node.js 18+ and pnpm installed
- TypeScript familiarity (for TypeScript agents)
- Python 3.10+ (for Python agents)
- Basic understanding of the Orchestrator AI project structure

## Option 1: TypeScript Function Agent

### Step 1: Create Agent Directory Structure

```bash
# Navigate to specialists directory
cd apps/api/src/agents/actual/specialists

# Create your agent directory
mkdir my_first_agent
cd my_first_agent
```

### Step 2: Create Agent Service

Create `agent-service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { FunctionAgentBaseService } from '../../../base/services/base-services';
import { LLMService } from '../../../base/services/llm/llm.service';
import { AgentContextService } from '../../../base/services/base-services/a2a-base/agent-context.service';

@Injectable()
export class MyFirstAgentService extends FunctionAgentBaseService {
  constructor(
    llmService: LLMService,
    httpService?: HttpService,
    contextService?: AgentContextService
  ) {
    super(llmService, httpService, contextService);
  }
}
```

### Step 3: Create Agent Function

Create `agent-function.ts`:

```typescript
import { AgentFunction } from '../../../base/interfaces/agent-function.interface';

export const executeAgentFunction: AgentFunction = async (params) => {
  const { prompt, context, llm } = params;
  
  // Simple example: echo the prompt with some processing
  const processedMessage = `Hello! You said: "${prompt}". I'm your first function agent!`;
  
  // You can use the LLM if needed
  if (prompt.toLowerCase().includes('help')) {
    const llmResponse = await llm?.invoke(
      `Provide helpful information about: ${prompt}`
    );
    
    return {
      success: true,
      message: llmResponse?.content || processedMessage,
      data: {
        originalPrompt: prompt,
        processedAt: new Date().toISOString(),
        agentType: 'typescript-function'
      }
    };
  }
  
  return {
    success: true,
    message: processedMessage,
    data: {
      originalPrompt: prompt,
      processedAt: new Date().toISOString(),
      agentType: 'typescript-function'
    }
  };
};
```

### Step 4: Create Agent Context

Create `agent-context.md`:

```markdown
# My First Agent

## Role
A simple demonstration agent that shows how function-based agents work.

## Capabilities
- Echo user messages with friendly responses
- Provide helpful information when asked
- Demonstrate basic LLM integration

## Example Interactions
- "Hello!" → "Hello! You said: 'Hello!'. I'm your first function agent!"
- "Help me with something" → [Uses LLM to provide helpful response]
```

### Step 5: Test Your Agent

```bash
# Build the project
cd apps/api
pnpm build

# Start the development server
pnpm start:dev

# Test your agent
curl -X POST "http://localhost:4100/agents/specialists/my_first_agent/tasks" \
  -H "Content-Type: application/json" \
  -H "x-test-api-key: test-key-12345" \
  -d '{"prompt": "Hello, this is my first test!"}'
```

## Option 2: Python Function Agent

### Step 1: Create Agent Directory Structure

```bash
# Navigate to specialists directory
cd apps/api/src/agents/actual/specialists

# Create your agent directory
mkdir my_python_agent
cd my_python_agent
```

### Step 2: Create Agent Service

Create `agent-service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PythonFunctionAgentBaseService } from '../../../base/services/base-services';
import { LLMService } from '../../../base/services/llm/llm.service';
import { AgentContextService } from '../../../base/services/base-services/a2a-base/agent-context.service';

@Injectable()
export class MyPythonAgentService extends PythonFunctionAgentBaseService {
  constructor(
    llmService: LLMService,
    httpService?: HttpService,
    contextService?: AgentContextService
  ) {
    super(llmService, httpService, contextService);
  }
}
```

### Step 3: Create Python Function

Create `agent-function.py`:

```python
#!/usr/bin/env python3
import json
import sys
from datetime import datetime

def execute_agent_function(params):
    """
    Main agent function that processes requests
    
    Args:
        params (dict): Input parameters including 'prompt', 'context', etc.
    
    Returns:
        dict: Response with success, message, and data
    """
    prompt = params.get('prompt', '')
    context = params.get('context', {})
    
    # Simple processing
    if 'python' in prompt.lower():
        message = f"Great! You mentioned Python. I'm a Python-powered agent and I received: '{prompt}'"
        agent_type = "python-function"
    else:
        message = f"Hello from Python! You said: '{prompt}'"
        agent_type = "python-function"
    
    return {
        "success": True,
        "message": message,
        "data": {
            "originalPrompt": prompt,
            "processedAt": datetime.now().isoformat(),
            "agentType": agent_type,
            "pythonVersion": sys.version.split()[0]
        }
    }

def main():
    """Main entry point for command line execution"""
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "message": "No input provided"}))
        return
    
    try:
        # Parse input from command line argument
        input_data = json.loads(sys.argv[1])
        
        # Process the request
        result = execute_agent_function(input_data)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except json.JSONDecodeError as e:
        print(json.dumps({
            "success": False, 
            "message": f"Invalid JSON input: {str(e)}"
        }))
    except Exception as e:
        print(json.dumps({
            "success": False, 
            "message": f"Error processing request: {str(e)}"
        }))

if __name__ == "__main__":
    main()
```

### Step 4: Make Python Script Executable

```bash
chmod +x agent-function.py
```

### Step 5: Create Agent Context

Create `agent-context.md`:

```markdown
# My Python Agent

## Role
A Python-powered demonstration agent showing Python function capabilities.

## Capabilities
- Process requests using Python
- Demonstrate Python-specific features
- Show integration between TypeScript and Python

## Example Interactions
- "Hello!" → "Hello from Python! You said: 'Hello!'"
- "I love Python" → "Great! You mentioned Python. I'm a Python-powered agent..."
```

### Step 6: Test Your Python Agent

```bash
# Build and start the server
cd apps/api
pnpm build
pnpm start:dev

# Test your Python agent
curl -X POST "http://localhost:4100/agents/specialists/my_python_agent/tasks" \
  -H "Content-Type: application/json" \
  -H "x-test-api-key: test-key-12345" \
  -d '{"prompt": "Hello from my Python agent!"}'
```

## What Just Happened?

1. **Automatic Discovery**: The agent discovery service found your new agents automatically
2. **Dynamic Loading**: Your agent functions were loaded without configuration
3. **Type Safety**: TypeScript agents get full type checking and IntelliSense
4. **Multi-Language**: Python agents run seamlessly alongside TypeScript agents

## Next Steps

1. 📖 Read the [Architecture Overview](./architecture.md) to understand how it works
2. 🎯 Explore [TypeScript Agents](./typescript-agents.md) for advanced TypeScript patterns
3. 🐍 Check out [Python Agents](./python-agents.md) for LangGraph integration
4. 🧪 Learn about [Testing Your Agents](./testing.md) for robust development

## Troubleshooting

**Agent not found?**
- Check that your directory is in `apps/api/src/agents/actual/specialists/`
- Ensure `agent-service.ts` exports a class ending in `Service`
- Verify the build completed successfully

**Python agent not working?**
- Ensure Python script is executable: `chmod +x agent-function.py`
- Check Python is available in your PATH
- Verify the JSON input/output format

**TypeScript errors?**
- Run `pnpm build` to check for compilation errors
- Ensure all imports are correct
- Check that interfaces match the expected signatures

---

🎉 **Congratulations!** You've created your first function-based agents. The system is designed to be this simple while being incredibly powerful under the hood. 