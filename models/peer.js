const EventEmitter = require('events');
const uuid = require('uuid/v1');

class Peer {
  constructor({socket, server}) {
    this.socket = socket;
    this.server = server;
    this.id = uuid();

    socket.on('message', this._handleMessage);

    this.rpcMethods = {
      authenticate: this.authenticate,
      fetchRooms: this.fetchRooms,
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

    const {name, ...params} = payload;
    const method = this.rpcMethods[name];
    if (method) {
      console.log('Received command:', name);
      method(params);
    } else {
      console.log('Received invalid call:', name);
    }
  }

  ////
  // RPC Commands
  //
  authenticate = ({username}) => {
    this.username = username;
  }

  fetchRooms = () => {
    this.send({
      name: 'setRooms',
      params: this.server.rooms.map(r => r.serialize()),
    });
  }

  ////
  // Helpers
  //
  serialize = () => ({
    id: this.id,
    username: this.username,
  })

  send = ({name, params}) => {
    console.log('Sending to peer', this.id, name);
    this.socket.send(JSON.stringify({name, params}))
  }
}

module.exports = Peer;
