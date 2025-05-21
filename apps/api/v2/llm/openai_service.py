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
        
        # Check if we have a chat support or customer support agent in the available agents
        has_chat_support = False
        for agent_info in available_agents:
            prompt_lines.append(f"- Agent Name: {agent_info['name']}, Description: {agent_info['description']}")
            if "chat_support" in agent_info['name'] or "customer_support" in agent_info['name'] or "support" in agent_info['name']:
                has_chat_support = True
        
        # Add special instructions for chat support requests
        if has_chat_support:
            prompt_lines.append("\nIMPORTANT: If the user is asking to talk to customer support, chat with support, or asking for help with a product/service issue, " 
                              "ALWAYS delegate to the customer/chat_support agent. This includes any variation of 'speak to support', 'talk to a person', " 
                              "'customer service', 'need help with my account', etc.")
        
        prompt_lines.append("\nBased on the user's query, you must decide on ONE of the following actions:")
        prompt_lines.append("1. 'delegate': If the query clearly matches an agent's capability. If so, specify the 'agent_name' and formulate a concise 'query_for_agent' based on the user's original query.")
        prompt_lines.append("2. 'respond_directly': If the query is a direct question, a simple statement, or a follow-up that you can answer using the provided chat history and your general knowledge, without needing to delegate to another agent. Provide the 'response_text'. Make sure to use information from the chat history if relevant to the user's query.")
        prompt_lines.append("3. 'clarify': If the query is ambiguous or needs more information to decide on an action. Provide a 'clarification_question'.")
        prompt_lines.append("4. 'cannot_handle': If the query is outside the scope of your capabilities and known agents.")
        
        prompt_lines.append("\nRespond ONLY with a JSON object with the fields 'action' (string, one of ['delegate', 'respond_directly', 'clarify', 'cannot_handle']), "
                            "and then conditionally: 'agent_name' (string), 'query_for_agent' (string), 'response_text' (string), or 'clarification_question' (string).")
        
        # Correctly escaped JSON examples
        prompt_lines.append('Example for delegation: {"action": "delegate", "agent_name": "metrics", "query_for_agent": "What are the current sales figures?"}')
        prompt_lines.append('Example for direct response: {"action": "respond_directly", "response_text": "Hello! How can I assist you today?"}')
        prompt_lines.append('Example for clarification: {"action": "clarify", "clarification_question": "Which specific metrics are you interested in?"}')
        prompt_lines.append('Example for cannot handle: {"action": "cannot_handle"}')

        system_prompt = "\n".join(prompt_lines)

        messages = []
        # Prepend history if available
        if history:
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
                max_tokens=150,
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
                if "action" not in decision or decision["action"] not in ["delegate", "respond_directly", "clarify", "cannot_handle"]:
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