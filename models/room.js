const uuid = require('uuid/v1');

class Room {
  constructor({name, server}) {
    this.id = uuid();
    this.name = name;
    this.server = server;
    this.peers = [];
    this.djs = [];
    this.owner = null;

    this._removalTimeout = null;
  }

  addPeer = ({peer}) => {
    if (this.peers.length === 0) {
      this.owner = peer;
    }

    this.broadcast({name: 'peerJoined', peer: peer.serialize()});

    this.peers.push(peer);
    clearTimeout(this._removalTimeout);
  }

  removePeer = ({peer}) => {
    const index = this.peers.indexOf(peer);
    if (index === -1) {
      console.log('[ERR] Could not find peer to remove from room');
      return;
    }

    console.log('Removing peer from room');
    this.peers.splice(index, 1);

    // If we don't have any peers left let's clean ourselves up after 45s
    if (this.peers.length === 0) {
      this._removalTimeout = setTimeout(() => {
        this.server.removeRoom({room: this})
      }, 45000);
    }

    // Reassign owner if they're leaving
    if (peer === this.owner) {
      this.owner = this.peers[0];
    }

    this.broadcast({name: 'peerLeft', id: peer.id});
  }

  broadcast = ({name, params}) => {
    this.peers.forEach(p => p.send({name, params}));
  }

  serialize = ({includePeers = false} = {}) => ({
    id: this.id,
    name: this.name,
    ...(includePeers ? {
      peers: this.peers.map(p => p.serialize()),
      djs: this.djs.map(p => p.id),
    } : {}),
  })
}

module.exports = Room;
