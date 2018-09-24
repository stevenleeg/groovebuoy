const uuid = require('uuid/v1');

const MAX_DJS = 5;

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

    this.peers.push(peer);
    clearTimeout(this._removalTimeout);

    this.broadcast({
      excludeIds: [peer.id],
      name: 'setPeers', 
      params: {peers: this.peers.map(p => p.serialize())},
    });
  }

  removePeer = ({peer}) => {
    const index = this.peers.indexOf(peer);
    if (index === -1) {
      console.log('[ERR] Could not find peer to remove from room');
      return;
    }

    console.log('Removing peer from room');
    this.peers.splice(index, 1);

    // Remove from them from the DJ list if they're there
    this.removeDj({peer});

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

    this.broadcast({
      name: 'setPeers', 
      params: {peers: this.peers.map(p => p.serialize())},
    });
  }

  // Promotes the given peer to DJ
  addDj = ({peer}) => {
    if (this.djs.length === MAX_DJS) return false;
    this.djs.push(peer);
    this.broadcast({name: 'setDjs', params: {
      djs: this.djs.map(p => p.id),
    }});

    return true;
  }

  removeDj = ({peer}) => {
    const index = this.djs.indexOf(peer);
    if (index === -1) return false;

    this.djs.splice(index, 1);
    this.broadcast({name: 'setDjs', params: {
      djs: this.djs.map(p => p.id),
    }});
  }

  broadcast = ({name, params, excludeIds = []}) => {
    this.peers.forEach((peer) => {
      if (excludeIds.includes(peer.id)) return;
      peer.send({name, params})
    });
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
