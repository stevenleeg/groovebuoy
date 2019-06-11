const uuid = require('uuid/v1');
const JWT = require('jsonwebtoken');

// Peers have 5000 seconds to authenticate before getting das boot
const AUTH_TIMEOUT = 5000;

class Peer {
  constructor({socket, server}) {
    this.socket = socket;
    this.server = server;
    this.currentRoom = null;
    this.profile = null;
    this.id = null;

    // They have 5 seconds to authenticate
    this.authTimeout = setTimeout(this._closeUnauthenticated, 5000);

    this.socket.on('call', this._handleMessage);
    this.socket.on('disconnect', this._handleDisconnect);

    this.rpcMethods = {
      authenticate: this.authenticate,
      join: this.join,
      fetchRooms: this.fetchRooms,
      createRoom: this.createRoom,
      joinRoom: this.joinRoom,
      becomeDj: this.becomeDj,
      trackEnded: this.trackEnded,
      setProfile: this.setProfile,
    };
  }

  ////
  // Socket events
  //
  _handleMessage = ({name, params}, respond) => {
    const method = this.rpcMethods[name];
    if (method) {
      const id = this.id ? this.id.split('-')[0] : 'unauth';
      console.log(`[RCV ${id}]: ${name}`);
      const value = method(params);
      respond(value);
    } else {
      console.log(`[RCV] Invalid call: ${name}`);
      respond({error: true, message: 'Invalid method name'});
    }
  }

  _handleDisconnect = () => {
    if (this.currentRoom) {
      this.currentRoom.removePeer({peer: this});
    }

    this.server.removePeer({peer: this});
    console.log('Connection closed');
  };

  _closeUnauthenticated = () => {
    console.log('Closing unauthenticated peer');
    this.socket.disconnect();
  }

  ////
  // RPC Commands
  //
  join = ({jwt}) => {
    const invite = JWT.verify(jwt, process.env.JWT_SECRET);
    if (invite.u !== process.env.BUOY_URL || invite.n !== process.env.BUOY_NAME) {
      return {error: true, message: 'invalid token'};
    }

    this.id = uuid();

    // Generate an auth token
    const token = JWT.sign({
      // URL
      u: process.env.BUOY_URL,
      // Server name
      n: process.env.BUOY_NAME,
      // ID
      i: this.id,
    }, process.env.JWT_SECRET);

    clearTimeout(this.authTimeout);
    return {token};
  }

  authenticate = ({jwt}) => {
    const token = JWT.verify(jwt, process.env.JWT_SECRET);
    if (token.u !== process.env.BUOY_URL || token.n !== process.env.BUOY_NAME) {
      return {error: true, message: 'invalid token'};
    }

    this.id = token.i;

    clearTimeout(this.authTimeout);
    return {success: true, id: this.id};
  }

  fetchRooms = () => {
    return this.server.rooms.map(r => r.serialize());
  }

  joinRoom = ({id}) => {
    const room = this.server.rooms.find(r => r.id === id);
    if (!room) return {error: true, message: 'room not found'};

    this.currentRoom = room;
    this.currentRoom.addPeer({peer: this});

    return {
      ...room.serialize({includePeers: true}),
    };
  }

  createRoom = ({name}) => {
    return this.server.createRoom({name}).serialize();
  }

  becomeDj = () => {
    if (!this.currentRoom) {
      return {error: true, message: 'must be in a room to promote'};
    }

    if (!this.currentRoom.addDj({peer: this})) {
      return {error: true, message: 'could not promote'};
    }

    return {success: true};
  }

  trackEnded = () => {
    if (!this.currentRoom) {
      return {error: true, message: 'must be in a room to end a track'};
    }

    if (this.currentRoom.activeDj !== this) {
      // TODO: some kind of metric to determine if everyone is ending at the
      // same time
      return {success: true};
    }

    this.currentRoom.spinDj();

    return {success: true};
  }

  setProfile = ({profile}) => {
    this.profile = profile;

    if (this.currentRoom) {
      this.currentRoom.broadcast({
        name: 'setPeerProfile',
        params: {id: this.id, profile},
        excludeIds: [this.id],
      });
    }

    return {success: true, peerId: this.id};
  }

  ////
  // Helpers
  //
  serialize = () => ({
    id: this.id,
    profile: this.profile,
  })

  send = ({name, params = {}, callback}) => {
    console.log(`[SND ${this.id.split('-')[0]}]: ${name}`);
    this.socket.emit('call', {name, params}, callback);
  }
}

module.exports = Peer;
