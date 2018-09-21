const Peer = require('./peer');
const Room = require('./room');

class PeerServer {
  constructor({socket}) {
    this.socket = socket;
    this.peers = [];
    this.rooms = [];

    this.socket.on('connection', this._handleNewConnection);
  }

  ////
  // Websocket server event helpers
  //
  _handleNewConnection = (peerSocket) => {
    const peer = new Peer({socket: peerSocket, server: this});
    this.peers.push(peer);

    peerSocket.on('disconnect', () => {
      if (peer.currentRoom) {
        peer.currentRoom.removePeer({peer});
      }

      const i = this.peers.indexOf(peer);
      this.peers.splice(i, 1);
      console.log('Connection closed');
    });

    console.log(`New connection established: ${peer.id}`);
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
}

module.exports = PeerServer;
