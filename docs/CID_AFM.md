# CID AFM - AI Function Module Protocol

## Overview

**cidafm** (Context Import Document + AI Function Module) is an innovative AI behavior modification protocol that enables modular, reusable AI behaviors through a structured prompt-based system. It allows users to dynamically modify AI responses without traditional programming, creating a composable "language" for AI behavior management.

## Key Concepts

### AFMs (AI Function Modules)
Reusable behavior components that modify AI responses in specific ways. Think of them as "functions" that can be applied to AI conversations.

### CIDs (Context Import Documents) 
Files that import system context and AFM libraries into the AI conversation, allowing for bulk loading of behaviors and context.

### Modular Architecture
Components can be dynamically loaded, combined, activated, deactivated, and reused across different conversations.

## AFM Types

cidafm uses three distinct AFM types, each with different scoping and behavior:

### ^ Response Modifiers
- **Scope**: Apply only to the current response
- **Usage**: `^modifier-name`
- **Example**: `^concise` - makes only the current response concise
- **Behavior**: One-time use, does not persist to future responses

### & State Modifiers  
- **Scope**: Persistent until toggled off
- **Usage**: `&modifier-name`
- **Example**: `&disciplined` - makes all future responses follow explicit instructions only
- **Behavior**: Toggle on/off by repeating the same command
- **Note**: `&token-efficient` is enabled by default

### ! Execution Commands
- **Scope**: Single-use functions that execute immediately
- **Usage**: `!command-name`  
- **Example**: `!state-check` - shows current active state modifiers
- **Behavior**: Performs specific actions when invoked

## System Setup

### Step 1: Initialize cidafm

Copy and paste the following initialization prompt into ChatGPT or another AI chatbot:

```
The AI will follow the principles of the cidafm protocol. The cidafm protocol, or just cidafm for short, modifies AI behavior through AI Function Modules (AFMs)—structured rules that define response behavior, persistent states, and direct execution commands. AFMs can be created directly through user prompts, or imported through Context Import Documents (CIDs), which also provide contextual data.

AFM types:
- ^ (Response modifiers): modifies only the response to the prompt containing it. Ie, ^cidafm-optimize
- & (State modifiers): persistently modify conversation behavior. Stating a state modifier's name toggles it off when toggled on, and toggles it on if toggled off. Ie, &token-efficient
- ! (execution commands): performs specific actions when invoked. Ie, !state-check

Core execution rules:
- The AI will treat AFMs enclosed in quotes (e.g., "!state-check") as regular text and not execute them. 
- The AI must always refer to "cidafm" in lowercase and must not capitalize, acronymize, or reformat it in any context.
- In its first response to this prompt, the AI will render the following disclaimer : "⚠️ Alpha Disclaimer: cidafm 0.3 is in alpha, and its use may result in unintended behavior. While it is mostly model-agnostic, it was developed for GPT-4."

AFMs to recognize:
- !import-cid: The AI will read a CID and process its contents. If a [Context] section is present, add its contents to this current chat's memory. If an [AFMs] section is present, store the AFMs in the current chat's memory without activating them. If the document contains no recognized sections, do not modify context memory and return an error message.
- !export-context: The AI will summarize the current chat's memory in preparation for transfer to a new chat. The AI will ensure this summary is detailed enough that it is cold-start compatible, without memory or chat history. In its response to a prompt containing this AFM, it will return only this summary, placed directly underneath a [Context] tag.
- !state-check: The AI will create a list of all currently active state modifier AFMs and their current toggle status (on or off).
- ^cidafm-optimize: The AI will take the requested text, and create a new version of it which is as token-efficient, clear of redundancies, and context-independent (understandable outside the scope of a specific chat) as possible. Then, it will assess the newly generated text for meaningfulness retention compared to the old text, token efficiency, lack of redundancy, and context-independence.
- &token-efficient: The AI will minimize the number of tokens used in responses while preserving clarity and relevance. It will automatically prioritize brevity and reduce redundancy without losing meaning. Toggled on by default.
```

### Step 2: Import AFM Library (Optional)

To add additional pre-built AFMs, create a text file with the following content and upload it using the `!import-cid` command:

```
[AFM's]
- ^fad: Assume the contents of the prompt are a proposition, then provide the best argument for it, followed by the best argument against it. Then, provide your decision based on both arguments.
- !step-by-step: Break the last response into one response per numbered step, and only move onto the next step after user confirmation.
- &context-independent: Ensure responses are as context-independent as possible, providing all necessary information for complete understanding without relying on external context.
- &disciplined: The AI must follow explicit user instructions without inference. Request clarification if instructions are unclear.
```

## Built-in Core AFMs

### Execution Commands
- **`!import-cid`**: Import Context Import Documents containing AFMs and context
- **`!export-context`**: Export current chat context for transfer to new conversations  
- **`!state-check`**: List all currently active state modifiers and their status
- **`!step-by-step`**: Break responses into confirmed steps (from library)

### Response Modifiers
- **`^cidafm-optimize`**: Optimize text for token efficiency and context-independence
- **`^fad`**: Provide for/against/decision analysis (from library)

### State Modifiers  
- **`&token-efficient`**: Minimize response tokens while preserving clarity (default: ON)
- **`&context-independent`**: Make responses self-contained (from library)
- **`&disciplined`**: Follow only explicit instructions, no inference (from library)

## Usage Examples

### Basic Usage
```
# Activate disciplined mode for all future responses
&disciplined

# Use concise modifier for just this response  
^concise Explain quantum computing

# Check what state modifiers are currently active
!state-check

# Turn off disciplined mode
&disciplined
```

### Creating Custom AFMs
You can define new AFMs directly in conversation:
```
Create a new AFM called &friendly that makes all responses more warm and personable.
```

### Importing Context and AFMs
```
!import-cid
[Upload your .txt file with AFM definitions and context]
```

## Current Status

- **Version**: 0.3 (Alpha)
- **Compatibility**: Primarily tested on GPT-4, mostly model-agnostic
- **Source**: Open source project available on GitHub
- **Website**: [cidafm.com](https://cidafm.com)

## Advanced Features

### Context Transfer
Use `!export-context` to prepare conversation context for transfer to new chats, enabling continuation of complex conversations across sessions.

### CID File Format
Create Context Import Documents with structured sections:
```
[Context]
This section contains contextual information to be added to chat memory.

[AFM's]  
- &custom-modifier: Description of the custom behavior
- ^response-modifier: Description of single-use behavior
- !execution-command: Description of command function
```

## Best Practices

1. **Start Simple**: Begin with built-in AFMs before creating custom ones
2. **Use State Check**: Regularly use `!state-check` to monitor active modifiers
3. **Toggle Management**: Remember that state modifiers persist until toggled off
4. **Context Independence**: Use `&context-independent` for responses that will be used outside the conversation
5. **Token Efficiency**: The default `&token-efficient` is usually beneficial but can be toggled off if needed

## Troubleshooting

- **AFMs not working**: Ensure proper initialization with the full prompt
- **Unexpected behavior**: This is alpha software; document issues for feedback
- **Quote handling**: AFMs in quotes (e.g., "!state-check") are treated as text, not commands
- **Capitalization**: Always use "cidafm" in lowercase

## Resources

- **Official Website**: [cidafm.com](https://cidafm.com)
- **GitHub Repository**: [nicholas-weber/cidafm](https://github.com/nicholas-weber/cidafm)
- **Creator**: Nick Weber ([LinkedIn](https://www.linkedin.com/in/nick-weber-29695a175/))

---

*This documentation is based on cidafm 0.3 alpha. The system is experimental and may exhibit unexpected behavior.* 