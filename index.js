const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const PeerServer = require('./models/peer-server');

const app = express();
const server = http.createServer(app);
const ws = new WebSocket.Server({server});
const peerServer = new PeerServer({websocket: ws});

server.listen(8000, () => {
  console.log('Server is listening');
});
