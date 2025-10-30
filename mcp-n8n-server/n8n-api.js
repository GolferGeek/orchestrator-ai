import axios from 'axios';

export class N8nAPI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.client = axios.create({
      baseURL: `${this.baseUrl}/api/v1`,
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  // List all workflows
  async listWorkflows() {
    try {
      const response = await this.client.get('/workflows');
      return {
        success: true,
        data: response.data.data || response.data,
        count: response.data.data?.length || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Get specific workflow by ID
  async getWorkflow(id) {
    try {
      const response = await this.client.get(`/workflows/${id}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Create new workflow
  async createWorkflow(workflowData) {
    try {
      const response = await this.client.post('/workflows', workflowData);
      return {
        success: true,
        data: response.data.data || response.data,
        message: 'Workflow created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Update existing workflow
  async updateWorkflow(id, workflowData) {
    try {
      const response = await this.client.put(`/workflows/${id}`, workflowData);
      return {
        success: true,
        data: response.data.data || response.data,
        message: 'Workflow updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Delete workflow
  async deleteWorkflow(id) {
    try {
      await this.client.delete(`/workflows/${id}`);
      return {
        success: true,
        message: 'Workflow deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Execute workflow
  async executeWorkflow(id, data = {}) {
    try {
      const response = await this.client.post(`/workflows/${id}/execute`, data);
      return {
        success: true,
        data: response.data.data || response.data,
        executionId: response.data.executionId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Get executions for a workflow
  async getExecutions(workflowId, limit = 10) {
    try {
      const response = await this.client.get(`/executions`, {
        params: {
          filter: JSON.stringify({ workflowId }),
          limit
        }
      });
      return {
        success: true,
        data: response.data.data || response.data,
        count: response.data.count || 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Get specific execution
  async getExecution(id) {
    try {
      const response = await this.client.get(`/executions/${id}`);
      return {
        success: true,
        data: response.data.data || response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Activate/deactivate workflow
  async setWorkflowActive(id, active) {
    try {
      const response = await this.client.patch(`/workflows/${id}`, { active });
      return {
        success: true,
        data: response.data.data || response.data,
        message: `Workflow ${active ? 'activated' : 'deactivated'} successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status
      };
    }
  }

  // Test N8n connection
  async testConnection() {
    try {
      const response = await this.client.get('/workflows?limit=1');
      return {
        success: true,
        message: 'N8n connection successful',
        serverInfo: {
          status: 'connected',
          baseUrl: this.baseUrl
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        status: error.response?.status,
        message: 'Failed to connect to N8n'
      };
    }
  }
}