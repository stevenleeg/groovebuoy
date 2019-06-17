const jwt = require('jsonwebtoken');
const Peer = require('./peer');
const Room = require('./room');

class PeerServer {
  constructor({socket}) {
    this.socket = socket;
    this.peers = [];
    this.rooms = [];

    this.socket.on('connection', this._handleNewConnection);

    // Create a first invite
    const invite = this.generateInvite();
    console.log(`Seed invite:\n${invite}\n`);
  }

  generateInvite = () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      // Generated at
      g: timestamp,
      // URL
      u: process.env.BUOY_URL,
      // Server name
      n: process.env.BUOY_NAME,
    };

    return jwt.sign(payload, process.env.JWT_SECRET);
  };

  ////
  // Websocket server event helpers
  //
  _handleNewConnection = (peerSocket) => {
    const peer = new Peer({socket: peerSocket, server: this});
    this.peers.push(peer);

    console.log(`New connection established`);
  }

  ////
  // Peer-invoked methods
  //
  createRoom = ({name}) => {
    const room = new Room({name, server: this});
    this.rooms.push(room);
    return room;
  }

  ////
  // Lifecycle methods
  //
  removeRoom = ({room}) => {
    const index = this.rooms.indexOf(room);
    this.rooms.splice(index, 1);
  }

  removePeer = ({peer}) => {
    const i = this.peers.indexOf(peer);
    this.peers.splice(i, 1);
  }
}

module.exports = PeerServer;
