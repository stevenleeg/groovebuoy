const uuid = require('uuid/v1');

class Peer {
  constructor({socket, server}) {
    this.socket = socket;
    this.server = server;
    this.currentRoom = null;
    this.id = uuid();
    this.profile = null;

    this.socket.on('call', this._handleMessage);

    this.rpcMethods = {
      authenticate: this.authenticate,
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
      console.log(`[RCV ${this.id.split('-')[0]}]: ${name}`);
      const value = method(params);
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
      ...room.serialize({includePeers: true}),
      peers: room.peers.map(p => p.serialize()),
    };
  }

  createRoom = ({name}) => {
    return this.server.createRoom({name}).serialize();
  }

  becomeDj = () => {
    if (!this.currentRoom) {
      return {error: true, message: 'Must be in a room to promote'};
    }

    if (!this.currentRoom.addDj({peer: this})) {
      return {error: true, message: 'Could not promote'};
    }

    return {success: true};
  }

  trackEnded = () => {
    if (!this.currentRoom) {
      return {error: true, message: 'Must be in a room to end a track'};
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

    return {success: true};
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
