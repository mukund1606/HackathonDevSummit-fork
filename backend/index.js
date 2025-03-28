// signaling-server/index.js
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const wss = new WebSocket.Server({ port: 8080 });
const clients = new Map();

wss.on('connection', (ws) => {
  const id = uuidv4();
  clients.set(id, ws);
  console.log(`Client connected: ${id}`);

  ws.send(JSON.stringify({ type: 'id', data: id }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const target = clients.get(data.target);
      target && target.send(JSON.stringify(data));
    } catch (error) {
      console.error('Message handling error:', error);
    }
  });

  ws.on('close', () => {
    clients.delete(id);
    console.log(`Client disconnected: ${id}`);
  });
});

console.log('Signaling server running on ws://localhost:8080');