const uuid = require('uuid/v1');

class Room {
  constructor({name, server}) {
    this.id = uuid();
    this.name = name;
    this.server = server;
    this.peers = [];
    this.owner = null;

    this._removalTimeout = null;
  }

  addPeer = ({peer}) => {
    if (this.peers.length === 0) {
      this.owner = peer;
    }

    this.peers.push(peer);
    clearTimeout(this._removalTimeout);
  }

  removePeer = ({peer}) => {
    const index = this.peers.indexOf(peer);
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
  }

  serialize = () => ({
    id: this.id,
    name: this.name,
    peerCount: this.peers.length,
  })
}

module.exports = Room;
