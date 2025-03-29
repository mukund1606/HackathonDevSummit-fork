// server.js
const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Store client connections with their IDs
const clients = new Map();

wss.on('connection', (ws) => {
  let clientId = null;
  
  console.log('Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
      
      // Handle registration message
      if (data.type === 'register') {
        clientId = data.data;
        
        // If we already have a connection with this ID, close it
        const existingClient = clients.get(clientId);
        if (existingClient && existingClient !== ws) {
          console.log(`Closing existing connection for client ${clientId}`);
          existingClient.close();
        }
        
        // Register the new connection
        clients.set(clientId, ws);
        console.log(`Client registered with ID: ${clientId}`);
        
        // Confirm registration to client
        ws.send(JSON.stringify({
          type: 'registered',
          data: clientId
        }));
        
        return;
      }
      
      // Set the source ID if not already set
      if (!data.source && clientId) {
        data.source = clientId;
      }
      
      // Route the message to the target client
      if (data.target) {
        const targetClient = clients.get(data.target);
        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
          console.log(`Routing ${data.type} from ${data.source} to ${data.target}`);
          targetClient.send(JSON.stringify(data));
        } else {
          console.log(`Target client ${data.target} not found or not connected`);
          // Notify sender that target is unavailable
          ws.send(JSON.stringify({
            type: 'error',
            data: {
              message: `Target client ${data.target} is not available`
            },
            source: 'server'
          }));
        }
      } else {
        console.log('No target specified for message');
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`Client disconnected: ${clientId || 'unknown'}`);
    // Only remove from clients map if this is the current connection for this ID
    if (clientId && clients.get(clientId) === ws) {
      clients.delete(clientId);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send({
    status: 'ok',
    connections: clients.size
  });
});

// Show connected clients (useful for debugging)
app.get('/clients', (req, res) => {
  res.status(200).send({
    clients: Array.from(clients.keys())
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebRTC signaling server running on port ${PORT}`);
});