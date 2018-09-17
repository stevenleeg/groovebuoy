const Peer = require('./peer');
const Room = require('./room');

class PeerServer {
  constructor({websocket}) {
    this.websocket = websocket;
    this.peers = [];

    this.websocket.on('connection', this._handleNewConnection);
  }

  _handleNewConnection = (socket) => {
    const peer = new Peer({socket});
    this.peers.push(peer);

    socket.on('close', () => {
      const i = this.peers.indexOf(peer);
      this.peers.splice(i, 1);
      console.log('Connection closed');
    });

    console.log(`New connection established: ${peer.id}`);
  }
}

module.exports = PeerServer;
