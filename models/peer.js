const uuid = require('uuid/v1');

class Peer {
  constructor({socket, server}) {
    this.socket = socket;
    this.server = server;
    this.currentRoom = null;
    this.id = uuid();

    this.socket.on('call', this._handleMessage);

    this.rpcMethods = {
      authenticate: this.authenticate,
      fetchRooms: this.fetchRooms,
      createRoom: this.createRoom,
      joinRoom: this.joinRoom,
    };
  }

  ////
  // Socket events
  //
  _handleMessage = ({name, params}, respond) => {
    const method = this.rpcMethods[name];
    if (method) {
      console.log(`[RCV]: ${name}`);
      const value = method(params);
      console.log(`[RSP]: ${JSON.stringify(value)}`);
      respond(value);
    } else {
      console.log(`[RCV] Invalid call: ${name}`);
      respond({error: true, message: 'Invalid method name'});
    }
  }

  ////
  // RPC Commands
  //
  authenticate = ({username}) => {
    this.username = username;
    return true;
  }

  fetchRooms = () => {
    return this.server.rooms.map(r => r.serialize());
  }

  joinRoom = ({id}) => {
    const room = this.server.rooms.find(r => r.id === id);
    if (!room) return {error: true, message: 'Room not found'};

    this.currentRoom = room;
    this.currentRoom.addPeer({peer: this});

    return {
      ...room.serialize(),
      peers: room.peers.map(p => p.serialize()),
    };
  }

  createRoom = ({name}) => {
    return this.server.createRoom({name}).serialize();
  }

  ////
  // Helpers
  //
  serialize = () => ({
    id: this.id,
    username: this.username,
  })

  send = ({name, params}) => {
    console.log(`[SND]: ${name}`);
    this.socket.emit('call', {name, params});
  }
}

module.exports = Peer;
