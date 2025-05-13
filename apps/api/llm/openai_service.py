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
        # Add other parameters like functions/tools if needed later
    ) -> Optional[str]:
        """Gets a chat completion from OpenAI."""
        try:
            self.logger.debug(f"Sending request to OpenAI: model={model}, messages={messages}")
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages, # type: ignore ( khắc phục lỗi kiểu cho messages )
                temperature=temperature,
                max_tokens=max_tokens,
            )
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
        available_agents: List[Dict[str, str]] # e.g., [{"name": "metrics", "description": "Handles business metrics"}]
    ) -> Dict[str, Any]:
        """
        Uses OpenAI to decide the next action based on user query and available agents.
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
        
        prompt_lines.append("\\nBased on the user's query, you must decide on ONE of the following actions:")
        prompt_lines.append("1. 'delegate': If the query clearly matches an agent's capability. If so, specify the 'agent_name' and formulate a concise 'query_for_agent' based on the user's original query.")
        prompt_lines.append("2. 'respond_directly': If the query is simple and you can answer it directly without delegation (e.g., a greeting). Provide the 'response_text'.")
        prompt_lines.append("3. 'clarify': If the query is ambiguous or needs more information to decide on an action. Provide a 'clarification_question'.")
        prompt_lines.append("4. 'cannot_handle': If the query is outside the scope of your capabilities and known agents.")
        
        prompt_lines.append("\\nRespond ONLY with a JSON object with the fields 'action' (string, one of ['delegate', 'respond_directly', 'clarify', 'cannot_handle']), "
                            "and then conditionally: 'agent_name' (string), 'query_for_agent' (string), 'response_text' (string), or 'clarification_question' (string).")
        
        # Correctly escaped JSON examples
        prompt_lines.append('Example for delegation: {"action": "delegate", "agent_name": "metrics", "query_for_agent": "What are the current sales figures?"}')
        prompt_lines.append('Example for direct response: {"action": "respond_directly", "response_text": "Hello! How can I assist you today?"}')
        prompt_lines.append('Example for clarification: {"action": "clarify", "clarification_question": "Which specific metrics are you interested in?"}')
        prompt_lines.append('Example for cannot handle: {"action": "cannot_handle"}')

        system_prompt = "\\n".join(prompt_lines)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query}
        ]

        self.logger.info(f"Orchestration decision for query '{user_query}'. System prompt: {system_prompt}")

        try:
            # For critical decision making, a more capable model might be better, e.g., gpt-4
            # Using gpt-3.5-turbo for now for speed/cost.
            llm_response_str = await self.get_chat_completion(
                messages=messages,
                model="gpt-3.5-turbo-0125", # Ensure model supports JSON mode if directly asking for JSON
                temperature=0.2, # Low temperature for more deterministic decisions
                max_tokens=150 
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