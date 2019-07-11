const jwt = require('jsonwebtoken');
const uuid = require('uuid/v1');

const Peer = require('./peer');
const Room = require('./room');

class PeerServer {
  constructor({socket}) {
    this.socket = socket;
    this.peers = [];
    this.rooms = [];
    this.tracks = {};

    if (process.env.BUOY_ID) {
      this.id = process.env.BUOY_ID;
    } else {
      this.id = uuid();
      console.log(`Buoy ID is set to ${this.id}`);
      console.log('Please set the BUOY_ID environment variable, otherwise invite tokens will be reset between server sessions');
    }

    this.url = `${process.env.SSL_ENABLED === '1' ? 'https://' : 'http://'}${process.env.BUOY_HOST}/`;
    this.wsUrl = `${process.env.SSL_ENABLED === '1' ? 'wss://' : 'ws://'}${process.env.BUOY_HOST}/`;
    this.name = process.env.BUOY_NAME;

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
      u: this.wsUrl,
      // Server name
      n: this.name,
      // Server ID
      i: this.id,
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
  createRoom = ({id, name, adminId}) => {
    // If they're trying to restore a room, make sure it doesn't already exist
    if (id) {
      const roomExists = this.rooms.reduce((r, exists) => r.id === id || exists, false)
      if (roomExists) {
        return {error: true, message: 'room with this id already exists'};
      }
    }

    const room = new Room({id, name, adminId, server: this});
    this.rooms.push(room);
    this.broadcastRooms();

    return room;
  }


  // Broadcast to all peers without a room
  broadcastRooms = () => {
    const rooms = this.rooms.map(r => r.serialize());
    this.peers.forEach((peer) => {
      if (peer.currentRoom) {
        return;
      }

      peer.send({name: 'setRooms', params: {rooms}});
    });
  }

  ////
  // Lifecycle methods
  //
  removeRoom = ({room}) => {
    const index = this.rooms.indexOf(room);
    this.rooms.splice(index, 1);
    this.broadcastRooms();
  }

  removePeer = ({peer}) => {
    const i = this.peers.indexOf(peer);
    this.peers.splice(i, 1);
  }
}

module.exports = PeerServer;
