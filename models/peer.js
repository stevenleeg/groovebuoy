const EventEmitter = require('events');
const uuid = require('uuid/v1');

class Peer {
  constructor({socket}) {
    this.socket = socket;
    this.id = uuid();
    socket.on('message', this._handleMessage);

    this.rpcMethods = {
      authenticate: this.authenticate,
    };
  }

  ////
  // Socket events
  //
  _handleMessage = (msg) => {
    let payload;
    try {
      payload = JSON.stringify(msg.utf8Data);
    } catch (e) {
      console.log('Received invalid message from connection');
      return;
    }

    const {type, ...params} = payload;
    const method = this.rpcMethods[type];
    if (method) {
      console.log('Received command:', cmd.type);
      method(params);
    } else {
      console.log('Received invalid payload:', payload);
    }
  }

  ////
  // RPC Commands
  //
  authenticate = ({username}) => {
    this.username = username;
  }

  ////
  // Helpers
  //
  serialize = () => ({
    id: this.id,
    username: this.username,
  })
}

module.exports = Peer;
