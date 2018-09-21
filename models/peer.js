const uuid = require('uuid/v1');

class Peer {
  constructor({socket, server}) {
    this.socket = socket;
    this.server = server;
    this.room = null;
    this.id = uuid();

    this.socket.on('call', this._handleMessage);

    this.rpcMethods = {
      authenticate: this.authenticate,
      fetchRooms: this.fetchRooms,
      fetchRoom: this.fetchRoom,
      createRoom: this.createRoom,
    };
  }

  ////
  // Socket events
  //
  _handleMessage = ({name, nonce, params}, respond) => {
    const method = this.rpcMethods[name];
    if (method) {
      console.log(`[RCV]: ${name}`);
      const value = method(params);
      console.log(`[SND]: ${value}`);
      respond(value);
    } else {
      console.log(`[RCV] Invalid call: ${name}`);
      respond({error: true});
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

  fetchRoom = ({id}) => {
    const room = this.server.rooms.find(r => r.id === id);
    if (!room) return null
    return room.serialize();
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

  send = ({name, params, nonce}) => {
    console.log(`[SND]: ${name} (${nonce})`);
    this.socket.emit('call', {name, params, nonce});
  }
}

module.exports = Peer;
