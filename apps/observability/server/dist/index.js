"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const db_1 = require("./db");
const theme_1 = require("./theme");
(0, db_1.initDatabase)();
const PORT = parseInt(process.env.SERVER_PORT || '4100');
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
const wsClients = new Set();
async function sendResponseToAgent(wsUrl, response) {
    console.log(`[HITL] Connecting to agent WebSocket: ${wsUrl}`);
    return new Promise((resolve, reject) => {
        let ws = null;
        let isResolved = false;
        const cleanup = () => {
            if (ws) {
                try {
                    ws.close();
                }
                catch (e) {
                }
            }
        };
        try {
            ws = new ws_1.WebSocket(wsUrl);
            ws.on('open', () => {
                if (isResolved)
                    return;
                console.log('[HITL] WebSocket connection opened, sending response...');
                try {
                    ws.send(JSON.stringify(response));
                    console.log('[HITL] Response sent successfully');
                    setTimeout(() => {
                        cleanup();
                        if (!isResolved) {
                            isResolved = true;
                            resolve();
                        }
                    }, 500);
                }
                catch (error) {
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
            setTimeout(() => {
                if (!isResolved) {
                    console.error('[HITL] Timeout sending response to agent');
                    cleanup();
                    isResolved = true;
                    reject(new Error('Timeout sending response to agent'));
                }
            }, 5000);
        }
        catch (error) {
            console.error('[HITL] Error creating WebSocket:', error);
            cleanup();
            if (!isResolved) {
                isResolved = true;
                reject(error);
            }
        }
    });
}
function broadcastToClients(message) {
    wsClients.forEach(client => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            try {
                client.send(message);
            }
            catch (err) {
                console.error('Error broadcasting to client:', err);
                wsClients.delete(client);
            }
        }
        else {
            wsClients.delete(client);
        }
    });
}
app.post('/hooks', async (req, res) => {
    try {
        const hookData = req.body;
        const event = {
            source_app: hookData.source_app || hookData.sourceApp || 'unknown',
            session_id: hookData.session_id || hookData.sessionId || hookData.payload?.session_id || 'unknown',
            hook_event_type: hookData.event_type || hookData.hook_event_type || hookData.eventType || 'Unknown',
            payload: hookData.payload || hookData,
            timestamp: hookData.timestamp || Date.now(),
            summary: hookData.summary,
            chat: hookData.chat,
            model_name: hookData.model_name || hookData.modelName
        };
        const savedEvent = await (0, db_1.insertEvent)(event);
        const message = JSON.stringify({ type: 'event', data: savedEvent });
        broadcastToClients(message);
        res.status(200).json({ success: true, id: savedEvent.id });
    }
    catch (error) {
        console.error('Error processing hook:', error);
        res.status(200).json({ success: false, error: 'Failed to process hook' });
    }
});
app.post('/events', async (req, res) => {
    try {
        const event = req.body;
        if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const savedEvent = await (0, db_1.insertEvent)(event);
        const message = JSON.stringify({ type: 'event', data: savedEvent });
        broadcastToClients(message);
        res.json(savedEvent);
    }
    catch (error) {
        console.error('Error processing event:', error);
        res.status(400).json({ error: 'Invalid request' });
    }
});
app.get('/events/filter-options', async (req, res) => {
    try {
        const options = await (0, db_1.getFilterOptions)();
        res.json(options);
    }
    catch (error) {
        console.error('Error getting filter options:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.get('/events/recent', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '300');
        const events = await (0, db_1.getRecentEvents)(limit);
        res.json(events);
    }
    catch (error) {
        console.error('Error getting recent events:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
app.post('/events/:id/respond', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const response = req.body;
        response.respondedAt = Date.now();
        const updatedEvent = await (0, db_1.updateEventHITLResponse)(id, response);
        if (!updatedEvent) {
            return res.status(404).json({ error: 'Event not found' });
        }
        if (updatedEvent.humanInTheLoop?.responseWebSocketUrl) {
            try {
                await sendResponseToAgent(updatedEvent.humanInTheLoop.responseWebSocketUrl, response);
            }
            catch (error) {
                console.error('Failed to send response to agent:', error);
            }
        }
        const message = JSON.stringify({ type: 'event', data: updatedEvent });
        broadcastToClients(message);
        res.json(updatedEvent);
    }
    catch (error) {
        console.error('Error processing HITL response:', error);
        res.status(400).json({ error: 'Invalid request' });
    }
});
app.post('/api/themes', async (req, res) => {
    try {
        const themeData = req.body;
        const result = await (0, theme_1.createTheme)(themeData);
        const status = result.success ? 201 : 400;
        res.status(status).json(result);
    }
    catch (error) {
        console.error('Error creating theme:', error);
        res.status(400).json({
            success: false,
            error: 'Invalid request body'
        });
    }
});
app.get('/api/themes', async (req, res) => {
    try {
        const query = {
            query: req.query.query || undefined,
            isPublic: req.query.isPublic ? req.query.isPublic === 'true' : undefined,
            authorId: req.query.authorId || undefined,
            sortBy: req.query.sortBy || undefined,
            sortOrder: req.query.sortOrder || undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset) : undefined,
        };
        const result = await (0, theme_1.searchThemes)(query);
        res.json(result);
    }
    catch (error) {
        console.error('Error searching themes:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.get('/api/themes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Theme ID is required'
            });
        }
        const result = await (0, theme_1.getThemeById)(id);
        const status = result.success ? 200 : 404;
        res.status(status).json(result);
    }
    catch (error) {
        console.error('Error getting theme:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
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
        const result = await (0, theme_1.updateThemeById)(id, updates);
        const status = result.success ? 200 : 400;
        res.status(status).json(result);
    }
    catch (error) {
        console.error('Error updating theme:', error);
        res.status(400).json({
            success: false,
            error: 'Invalid request body'
        });
    }
});
app.delete('/api/themes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Theme ID is required'
            });
        }
        const authorId = req.query.authorId || undefined;
        const result = await (0, theme_1.deleteThemeById)(id, authorId);
        const status = result.success ? 200 : (result.error?.includes('not found') ? 404 : 403);
        res.status(status).json(result);
    }
    catch (error) {
        console.error('Error deleting theme:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.get('/api/themes/:id/export', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await (0, theme_1.exportThemeById)(id);
        if (!result.success) {
            const status = result.error?.includes('not found') ? 404 : 400;
            return res.status(status).json(result);
        }
        res.setHeader('Content-Disposition', `attachment; filename="${result.data.theme.name}.json"`);
        res.json(result.data);
    }
    catch (error) {
        console.error('Error exporting theme:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.post('/api/themes/import', async (req, res) => {
    try {
        const importData = req.body;
        const authorId = req.query.authorId || undefined;
        const result = await (0, theme_1.importTheme)(importData, authorId);
        const status = result.success ? 201 : 400;
        res.status(status).json(result);
    }
    catch (error) {
        console.error('Error importing theme:', error);
        res.status(400).json({
            success: false,
            error: 'Invalid import data'
        });
    }
});
app.get('/api/themes/stats', async (req, res) => {
    try {
        const result = await (0, theme_1.getThemeStats)();
        res.json(result);
    }
    catch (error) {
        console.error('Error getting theme stats:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
app.get('/', (req, res) => {
    res.send('Multi-Agent Observability Server');
});
const server = new http_1.Server(app);
const wss = new ws_1.WebSocketServer({
    server,
    path: '/stream'
});
wss.on('connection', async (ws) => {
    console.log('WebSocket client connected');
    wsClients.add(ws);
    try {
        const events = await (0, db_1.getRecentEvents)(300);
        ws.send(JSON.stringify({ type: 'initial', data: events }));
    }
    catch (error) {
        console.error('Error sending initial events:', error);
    }
    ws.on('message', (message) => {
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
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 WebSocket endpoint: ws://localhost:${PORT}/stream`);
    console.log(`📮 POST events to: http://localhost:${PORT}/events`);
});
//# sourceMappingURL=index.js.map