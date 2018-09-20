const uuid = require('uuid/v1');

class Peer {
  constructor({socket, server}) {
    this.socket = socket;
    this.server = server;
    this.room = null;
    this.id = uuid();

    socket.on('message', this._handleMessage);

    this.rpcMethods = {
      authenticate: this.authenticate,
      fetchRooms: this.fetchRooms,
      createRoom: this.createRoom,
    };
  }

  ////
  // Socket events
  //
  _handleMessage = (msg) => {
    let payload;
    try {
      payload = JSON.parse(msg);
    } catch (e) {
      console.log('Received invalid message from connection: ', msg);
      return;
    }

    const {name, nonce, ...params} = payload;
    const method = this.rpcMethods[name];
    if (method) {
      console.log('Received command:', name);
      this.send({nonce, params: method(params)});
    } else {
      console.log('Received invalid call:', name);
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
    console.log('Sending to peer', this.id, name);
    this.socket.send(JSON.stringify({name, params, nonce}))
  }
}

module.exports = Peer;
