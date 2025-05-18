# Orchestrator AI

A multi-agent system that orchestrates specialized AI agents to handle various tasks. Built with FastAPI and powered by the OpenAI API.

## 🚀 Getting Started

Follow these steps to set up and run the Orchestrator AI system on your local machine.

### Prerequisites

- Node.js (v16+)
- Python 3.10+
- npm or pnpm
- OpenAI API key

### Step 1: Get an OpenAI API Key

1. Go to [OpenAI's platform](https://platform.openai.com/)
2. Sign up or log in to your account
3. Navigate to the API section
4. Create an API key
5. Copy your API key for the next step

### Step 2: Set Up Environment Variables

1. Create a `.env` file in the root directory of the project
2. Add the following variables to the file:

```
OPENAI_API_KEY=your_openai_api_key_here
ENVIRONMENT=development
LOG_LEVEL=INFO
HOST=0.0.0.0
PORT=8000
```

Replace `your_openai_api_key_here` with the API key you obtained in Step 1.

### Step 3: Configure and Run the API

The project includes several npm scripts to simplify setup and running:

```bash
# Configure the API environment (only need to run this once)
npm run configure:api

# Run the API server
npm run api

# Run API tests
npm run test:api
```

#### What These Commands Do:

- `npm run configure:api`: Sets up the Python virtual environment and installs all dependencies
- `npm run api`: Starts the FastAPI server
- `npm run test:api`: Runs the API test suite

## 📋 Available Agents

The system includes several specialized agents:

- **Orchestrator**: The main routing agent that directs queries to appropriate specialized agents
- **Metrics Agent**: Provides business metrics and analytics information
- **Blog Post Writer**: Creates high-quality blog posts for marketing purposes
- And more...

## 📝 Usage

Once the API server is running, you can interact with it:

1. Send requests to the orchestrator endpoint: `http://localhost:8000/agents/orchestrator/tasks`
2. The orchestrator will analyze your request and route it to the appropriate specialized agent
3. Receive a comprehensive response based on the agent's specialized knowledge

### Example Request:

```json
{
  "id": "task-123",
  "message": {
    "role": "user",
    "parts": [
      {
        "type": "text",
        "text": "What were our total sales in Q3 2023?"
      }
    ]
  }
}
```

## 🛠️ Development

To extend the system with new agents, add them to the appropriate category in `apps/api/agents/` directory and create corresponding context files in `markdown_context/`.

## 📄 License

This project is licensed under the MIT License. 