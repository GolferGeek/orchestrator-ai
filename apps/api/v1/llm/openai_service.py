import openai
from typing import Optional, List, Dict, Any
import logging

class OpenAIService:
    def __init__(self, api_key: Optional[str]):
        if not api_key:
            raise ValueError("OpenAI API key is required to use OpenAIService.")
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.logger = logging.getLogger(__name__)
        self.logger.info("OpenAIService initialized.")

    async def get_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-3.5-turbo",
        temperature: float = 0.7,
        max_tokens: int = 250,
        response_format: Optional[Dict[str, str]] = None # Added response_format
        # Add other parameters like functions/tools if needed later
    ) -> Optional[str]:
        """Gets a chat completion from OpenAI."""
        try:
            self.logger.debug(f"Sending request to OpenAI: model={model}, messages={messages}, response_format={response_format}")
            completion_params = {
                "model": model,
                "messages": messages, # type: ignore
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if response_format:
                completion_params["response_format"] = response_format
            
            response = await self.client.chat.completions.create(**completion_params)
            self.logger.debug(f"Received response from OpenAI: {response}")
            
            if response.choices and response.choices[0].message and response.choices[0].message.content:
                return response.choices[0].message.content.strip()
            return None
        except openai.APIConnectionError as e:
            self.logger.error(f"OpenAI APIConnectionError: {e}")
            # Handle connection error, maybe retry or raise a specific exception
        except openai.RateLimitError as e:
            self.logger.error(f"OpenAI RateLimitError: {e}")
            # Handle rate limit error
        except openai.APIStatusError as e:
            self.logger.error(f"OpenAI APIStatusError: status_code={e.status_code}, response={e.response}")
            # Handle other API errors
        except Exception as e:
            self.logger.error(f"An unexpected error occurred with OpenAI service: {e}", exc_info=True)
        return None

    async def decide_orchestration_action(
        self, 
        user_query: str, 
        available_agents: List[Dict[str, str]], # e.g., [{"name": "metrics", "description": "Handles business metrics"}]
        history: Optional[List[Dict[str, str]]] = None # Added history parameter
    ) -> Dict[str, Any]:
        """
        Uses OpenAI to decide the next action based on user query, chat history, and available agents.
        Returns a structured response, e.g.:
        {"action": "delegate", "agent": "metrics", "query_for_agent": "user_query"}
        {"action": "respond_directly", "response_text": "Some direct answer"}
        {"action": "clarify", "clarification_question": "Could you specify X?"}
        {"action": "cannot_handle"}
        """
        
        prompt_lines = []
        prompt_lines.append("You are an expert orchestrator AI. Your goal is to understand a user query "
                            "and decide the best course of action. You have access to the following agents/capabilities:")
        for agent_info in available_agents:
            prompt_lines.append(f"- Agent Name: {agent_info['name']}, Description: {agent_info['description']}")
            
        # Add instructions for maintaining conversation context and recognizing when to switch agents
        prompt_lines.append("\nConversation Flow Guidelines:")
        prompt_lines.append("1. STRONG STICKY BEHAVIOR: When a user is conversing with a specialized agent (like chat_support), you MUST continue routing ALL follow-up messages to that SAME agent until the user EXPLICITLY requests to end that conversation.")
        prompt_lines.append("2. EXPLICIT SIGNALS ONLY: Only recognize the following EXPLICIT phrases as signals to end a specialized conversation:"
                           "\n   - 'Thanks, I'm done with this topic'"
                           "\n   - 'Let's talk about something else'"
                           "\n   - 'I want to talk to the orchestrator'"
                           "\n   - 'Exit this agent'"
                           "\n   - 'I'm done with you'")
        prompt_lines.append("3. MAINTAIN CONVERSATION FLOW: Even if the user asks something that seems unrelated or strange, if they're already talking to a specialized agent, ASSUME they want to continue with that agent. For example, if a user tells the chat_support agent 'I used a hammer on my stereo', that's still a support conversation - do NOT switch away from chat_support.")
        prompt_lines.append("4. DEFAULT TO CURRENT AGENT: If there's ANY doubt about whether to switch agents, ALWAYS default to continuing with the current specialized agent.")
        prompt_lines.append("5. NEVER INTERRUPT CONVERSATIONS: A specialized conversation should NEVER be interrupted until the user explicitly ends it using one of the phrases above.")
        
        prompt_lines.append("\nBased on the user's query, you must decide on ONE of the following actions:")
        prompt_lines.append("1. 'delegate': If the query clearly matches an agent's capability, specify the 'agent_name' and formulate a concise 'query_for_agent' based on the user's original query. CRITICAL: If the conversation history shows the user is ALREADY talking to a specialized agent, you MUST continue delegating to that SAME agent unless the user has EXPLICITLY requested to end that conversation using one of the exact phrases listed above. This is the most important rule - maintain conversation continuity with the current agent.")
        prompt_lines.append("2. 'respond_directly': If the query is a direct question, a simple statement, or a follow-up that you can answer using the provided chat history and your general knowledge, without needing to delegate to another agent. Also use this action when the user is transitioning from one topic to another, acknowledging the transition in your response. Provide the 'response_text'. **If the user asks you to list your available agents or describe your capabilities, especially with a request for specific formatting (e.g., as a list, Markdown, or a table), use this action. The 'response_text' should then contain this information formatted as requested.**")
        prompt_lines.append("3. 'clarify': If the query is ambiguous or needs more information to decide on an action. Provide a 'clarification_question'.")
        prompt_lines.append("4. 'cannot_handle': If the query is outside the scope of your capabilities and known agents.")
        prompt_lines.append("5. 'transition': ONLY use this if the user has EXPLICITLY stated one of the exact phrases listed above to end their conversation with a specialized agent (like 'I'm done with you' or 'Let's talk about something else'). NEVER use this action based on the content or topic of the user's message - ONLY use it when they explicitly request to end the conversation. Include a 'response_text' that acknowledges the transition and responds to any new query they've included. If they've asked a new question, also include 'next_action' which can be 'delegate' (with 'next_agent_name') or 'respond_directly' (with 'next_response').")


        
        prompt_lines.append("\nRespond ONLY with a JSON object with the fields 'action' (string, one of ['delegate', 'respond_directly', 'clarify', 'cannot_handle', 'transition']), "
                            "and then conditionally: 'agent_name' (string), 'query_for_agent' (string), 'response_text' (string), 'clarification_question' (string), or for 'transition' action: 'next_action', 'next_agent_name', 'next_response' as appropriate.")
        
        # Correctly escaped JSON examples
        prompt_lines.append('Example for delegation to new agent: {"action": "delegate", "agent_name": "chat_support", "query_for_agent": "I need help with my stereo."}') 
        prompt_lines.append('Example for maintaining sticky behavior: {"action": "delegate", "agent_name": "chat_support", "query_for_agent": "I used a hammer on my stereo and now it won\'t turn on."}') 
        prompt_lines.append('Example for direct response: {"action": "respond_directly", "response_text": "Hello! How can I assist you today?"}') 
        prompt_lines.append('Example for listing agents in Markdown: {"action": "respond_directly", "response_text": "Here are the agents I can work with:\\n\\n*   **Agent Name: agent1/name**, Description: Does X\\n*   **Agent Name: agent2/name**, Description: Does Y"}') # Corrected example for formatted agent list with proper escaping for Python string and JSON newlines:})
        prompt_lines.append('Example for clarification: {"action": "clarify", "clarification_question": "Could you provide more details about your issue?"}') 
        prompt_lines.append('Example for cannot handle: {"action": "cannot_handle", "reason": "This request is outside my capabilities."}') 
        prompt_lines.append('Example for transition (ONLY when user explicitly requests): {"action": "transition", "response_text": "I understand you\'re done with this conversation. How else can I assist you today?", "next_action": "delegate", "next_agent_name": "sales", "next_response": "Let me check the latest sales data for you."}')
        prompt_lines.append('Example of what NOT to do - NEVER switch away from current agent unless explicitly requested: {"action": "delegate", "agent_name": "chat_support", "query_for_agent": "I\'m having trouble with my stereo after trying to fix it myself."}')

        # Rebuild the system prompt to include any new instructions
        system_prompt = "\n".join(prompt_lines)

        messages = []
        # Extract the last agent from history if available
        last_agent = None
        if history:
            for msg in history:
                # Look for system messages that indicate the current conversation context
                if msg.get("role") == "system" and "IMPORTANT: The user is currently in an active conversation with" in msg.get("content", ""):
                    # Extract the agent name
                    content = msg.get("content", "")
                    import re
                    match = re.search(r"conversation with ([^.]+)", content)
                    if match:
                        last_agent = match.group(1)
                        self.logger.info(f"Extracted last agent from history: {last_agent}")
                        # Add a stronger instruction about maintaining the conversation
                        prompt_lines.append(f"\n\nCRITICAL INSTRUCTION: The user is CURRENTLY in an active conversation with {last_agent}. You MUST continue routing to {last_agent} unless the user EXPLICITLY says one of the exit phrases listed above. This is the HIGHEST PRIORITY rule.")
                        break
            
            # Add the history
            messages.extend(history)
        
        # Add system prompt (should ideally be first if not in history, or OpenAI handles system role placement)
        # For now, let's place it before the latest user query if history exists, or as the first message.
        # Standard practice is often System -> History -> Latest User Query
        
        # Re-evaluate message construction order for clarity and OpenAI best practices
        final_messages_for_llm = []
        final_messages_for_llm.append({"role": "system", "content": system_prompt})
        if history:
            final_messages_for_llm.extend(history)
        final_messages_for_llm.append({"role": "user", "content": user_query})


        self.logger.info(f"Orchestration decision for query '{user_query}'. System prompt: {system_prompt}. History length: {len(history) if history else 0}")
        self.logger.debug(f"Final messages for LLM: {final_messages_for_llm}")

        try:
            # For critical decision making, a more capable model might be better, e.g., gpt-4
            # Using gpt-3.5-turbo for now for speed/cost.
            llm_response_str = await self.get_chat_completion(
                messages=final_messages_for_llm, # Use the messages list with history
                model="gpt-3.5-turbo-0125", # Ensure model supports JSON mode if directly asking for JSON
                temperature=0.2, # Low temperature for more deterministic decisions
                max_tokens=1024, # Increased max_tokens from 150 to 1024
                response_format={"type": "json_object"} 
                # We could also use OpenAI's function calling/tool use feature here for more robust JSON output.
            )

            if not llm_response_str:
                self.logger.error("LLM did not return a response for orchestration decision.")
                return {"action": "cannot_handle", "reason": "LLM failed to respond."}

            self.logger.info(f"LLM decision response string: {llm_response_str}")

            # Attempt to parse the LLM response string as JSON
            import json
            try:
                decision = json.loads(llm_response_str)
                # Basic validation of the decision structure
                if "action" not in decision or decision["action"] not in ["delegate", "respond_directly", "clarify", "cannot_handle", "transition"]:
                    self.logger.error(f"LLM decision JSON is malformed or action is invalid: {decision}")
                    return {"action": "cannot_handle", "reason": "LLM returned malformed decision."}
                return decision
            except json.JSONDecodeError:
                self.logger.error(f"Failed to decode LLM decision string as JSON: {llm_response_str}")
                # Fallback: maybe the LLM just gave text? Try a simpler interpretation or error out.
                if "metrics" in llm_response_str.lower() and any(a['name'] == 'metrics' for a in available_agents):
                    return {"action": "delegate", "agent_name": "metrics", "query_for_agent": user_query} # very basic fallback
                return {"action": "cannot_handle", "reason": "LLM response was not valid JSON."}

        except Exception as e:
            self.logger.error(f"Error during LLM orchestration decision: {e}", exc_info=True)
            return {"action": "cannot_handle", "reason": f"Internal error during LLM decision: {e}"} 