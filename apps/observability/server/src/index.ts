import 'dotenv/config';
import express from 'express';
import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';
import cors from 'cors';
import { Server } from 'http';
import {
  initDatabase,
  insertEvent,
  getFilterOptions,
  getRecentEvents,
  updateEventHITLResponse
} from './db';
import type { HookEvent, HumanInTheLoopResponse } from './types';
import {
  createTheme,
  updateThemeById,
  getThemeById,
  searchThemes,
  deleteThemeById,
  exportThemeById,
  importTheme,
  getThemeStats
} from './theme';

// Initialize database
initDatabase();

const PORT = parseInt(process.env.SERVER_PORT || '4100');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for large hook payloads

// Store WebSocket clients
const wsClients = new Set<WSWebSocket>();

// Helper function to send response to agent via WebSocket
async function sendResponseToAgent(
  wsUrl: string,
  response: HumanInTheLoopResponse
): Promise<void> {
  console.log(`[HITL] Connecting to agent WebSocket: ${wsUrl}`);

  return new Promise((resolve, reject) => {
    let ws: WSWebSocket | null = null;
    let isResolved = false;

    const cleanup = () => {
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    };

    try {
      ws = new WSWebSocket(wsUrl);

      ws.on('open', () => {
        if (isResolved) return;
        console.log('[HITL] WebSocket connection opened, sending response...');

        try {
          ws!.send(JSON.stringify(response));
          console.log('[HITL] Response sent successfully');

          // Wait longer to ensure message fully transmits before closing
          setTimeout(() => {
            cleanup();
            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          }, 500);
        } catch (error) {
          console.error('[HITL] Error sending message:', error);
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(error);
          }
        }
      });

      ws.on('error', (error) => {
        console.error('[HITL] WebSocket error:', error);
        cleanup();
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      });

      ws.on('close', () => {
        console.log('[HITL] WebSocket connection closed');
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!isResolved) {
          console.error('[HITL] Timeout sending response to agent');
          cleanup();
          isResolved = true;
          reject(new Error('Timeout sending response to agent'));
        }
      }, 5000);

    } catch (error) {
      console.error('[HITL] Error creating WebSocket:', error);
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    }
  });
}

// Broadcast message to all WebSocket clients
function broadcastToClients(message: string) {
  wsClients.forEach(client => {
    if (client.readyState === WSWebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error('Error broadcasting to client:', err);
        wsClients.delete(client);
      }
    } else {
      wsClients.delete(client);
    }
  });
}

// Routes

// POST /hooks - Lightweight endpoint for Claude Code hooks from any app
app.post('/hooks', async (req, res) => {
  try {
    // Accept hook data in a simple format, auto-fill defaults
    const hookData = req.body;

    const event: HookEvent = {
      source_app: hookData.source_app || hookData.sourceApp || 'unknown',
      session_id: hookData.session_id || hookData.sessionId || hookData.payload?.session_id || 'unknown',
      hook_event_type: hookData.event_type || hookData.hook_event_type || hookData.eventType || 'Unknown',
      payload: hookData.payload || hookData,
      timestamp: hookData.timestamp || Date.now(),
      summary: hookData.summary,
      chat: hookData.chat,
      model_name: hookData.model_name || hookData.modelName
    };

    // Insert event into database
    const savedEvent = await insertEvent(event);

    // Broadcast to all WebSocket clients
    const message = JSON.stringify({ type: 'event', data: savedEvent });
    broadcastToClients(message);

    // Return minimal response for efficiency
    res.status(200).json({ success: true, id: savedEvent.id });
  } catch (error) {
    console.error('Error processing hook:', error);
    // Always return 200 to not block hooks
    res.status(200).json({ success: false, error: 'Failed to process hook' });
  }
});

// POST /events - Receive new events
app.post('/events', async (req, res) => {
  try {
    const event: HookEvent = req.body;

    // Validate required fields
    if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert event into database
    const savedEvent = await insertEvent(event);

    // Broadcast to all WebSocket clients
    const message = JSON.stringify({ type: 'event', data: savedEvent });
    broadcastToClients(message);

    res.json(savedEvent);
  } catch (error) {
    console.error('Error processing event:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// GET /events/filter-options - Get available filter options
app.get('/events/filter-options', async (req, res) => {
  try {
    const options = await getFilterOptions();
    res.json(options);
  } catch (error) {
    console.error('Error getting filter options:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /events/recent - Get recent events
app.get('/events/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || '300');
    const events = await getRecentEvents(limit);
    res.json(events);
  } catch (error) {
    console.error('Error getting recent events:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /events/:id/respond - Respond to HITL request
app.post('/events/:id/respond', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const response: HumanInTheLoopResponse = req.body;
    response.respondedAt = Date.now();

    // Update event in database
    const updatedEvent = await updateEventHITLResponse(id, response);

    if (!updatedEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Send response to agent via WebSocket
    if (updatedEvent.humanInTheLoop?.responseWebSocketUrl) {
      try {
        await sendResponseToAgent(
          updatedEvent.humanInTheLoop.responseWebSocketUrl,
          response
        );
      } catch (error) {
        console.error('Failed to send response to agent:', error);
        // Don't fail the request if we can't reach the agent
      }
    }

    // Broadcast updated event to all connected clients
    const message = JSON.stringify({ type: 'event', data: updatedEvent });
    broadcastToClients(message);

    res.json(updatedEvent);
  } catch (error) {
    console.error('Error processing HITL response:', error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// Theme API endpoints

// POST /api/themes - Create a new theme
app.post('/api/themes', async (req, res) => {
  try {
    const themeData = req.body;
    const result = await createTheme(themeData);

    const status = result.success ? 201 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('Error creating theme:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid request body'
    });
  }
});

// GET /api/themes - Search themes
app.get('/api/themes', async (req, res) => {
  try {
    const query = {
      query: req.query.query as string || undefined,
      isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
      authorId: req.query.authorId as string || undefined,
      sortBy: req.query.sortBy as any || undefined,
      sortOrder: req.query.sortOrder as any || undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
    };

    const result = await searchThemes(query);
    res.json(result);
  } catch (error) {
    console.error('Error searching themes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/themes/:id - Get a specific theme
app.get('/api/themes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Theme ID is required'
      });
    }

    const result = await getThemeById(id);
    const status = result.success ? 200 : 404;
    res.status(status).json(result);
  } catch (error) {
    console.error('Error getting theme:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// PUT /api/themes/:id - Update a theme
app.put('/api/themes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Theme ID is required'
      });
    }

    const updates = req.body;
    const result = await updateThemeById(id, updates);

    const status = result.success ? 200 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid request body'
    });
  }
});

// DELETE /api/themes/:id - Delete a theme
app.delete('/api/themes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Theme ID is required'
      });
    }

    const authorId = req.query.authorId as string || undefined;
    const result = await deleteThemeById(id, authorId);

    const status = result.success ? 200 : (result.error?.includes('not found') ? 404 : 403);
    res.status(status).json(result);
  } catch (error) {
    console.error('Error deleting theme:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/themes/:id/export - Export a theme
app.get('/api/themes/:id/export', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await exportThemeById(id);
    if (!result.success) {
      const status = result.error?.includes('not found') ? 404 : 400;
      return res.status(status).json(result);
    }

    res.setHeader('Content-Disposition', `attachment; filename="${result.data!.theme.name}.json"`);
    res.json(result.data);
  } catch (error) {
    console.error('Error exporting theme:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/themes/import - Import a theme
app.post('/api/themes/import', async (req, res) => {
  try {
    const importData = req.body;
    const authorId = req.query.authorId as string || undefined;

    const result = await importTheme(importData, authorId);

    const status = result.success ? 201 : 400;
    res.status(status).json(result);
  } catch (error) {
    console.error('Error importing theme:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid import data'
    });
  }
});

// GET /api/themes/stats - Get theme statistics
app.get('/api/themes/stats', async (req, res) => {
  try {
    const result = await getThemeStats();
    res.json(result);
  } catch (error) {
    console.error('Error getting theme stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Default route
app.get('/', (req, res) => {
  res.send('Multi-Agent Observability Server');
});

// Create HTTP server
const server = new Server(app);

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  path: '/stream'
});

// WebSocket connection handler
wss.on('connection', async (ws: WSWebSocket) => {
  console.log('WebSocket client connected');
  wsClients.add(ws);

  try {
    // Send recent events on connection
    const events = await getRecentEvents(300);
    ws.send(JSON.stringify({ type: 'initial', data: events }));
  } catch (error) {
    console.error('Error sending initial events:', error);
  }

  ws.on('message', (message) => {
    // Handle any client messages if needed
    console.log('Received message:', message.toString());
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    wsClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    wsClients.delete(ws);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 WebSocket endpoint: ws://localhost:${PORT}/stream`);
  console.log(`📮 POST events to: http://localhost:${PORT}/events`);
});
