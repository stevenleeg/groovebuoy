require('dotenv').config();

const express = require('express');
const http = require('http');
const SocketIO = require('socket.io');
const PeerServer = require('./models/peer-server');

// Spin up our webserver
const app = express();
const server = http.createServer(app);
const io = SocketIO(server);
const peerServer = new PeerServer({socket: io});

app.get('/tracks/:id', (req, res) => {
  const track = peerServer.tracks[req.params.id];
  if (!track) {
    res.status(404).send('Not found');
    return;
  }

  res
    .set('Content-Type', track.contentType)
    .send(track.data);
});

server.listen(8000, () => {
  console.log('Server is listening on port 8000');
});
