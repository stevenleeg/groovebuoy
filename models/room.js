const uuid = require('uuid/v1');

const MAX_DJS = 5;

class Room {
  constructor({name, server}) {
    this.id = uuid();
    this.name = name;
    this.server = server;
    this.peers = [];
    this.djs = [];
    this.activeDj = null;
    this.owner = null;
    this.nowPlaying = null;
    this.skipWarning = false;

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

    // If we're in the middle of playing a song, send them the current track
    if (this.nowPlaying) {
      peer.send({
        name: 'playTrack',
        params: this.nowPlaying,
      });
    }
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
    if (this.djs.length >= MAX_DJS) {
      return {error: true, message: 'too many djs, not enough mics'};
    }
    if (this.djs.findIndex(dj => dj.id === peer.id) !== -1) {
      return {error: true, message: 'already a dj'};
    }

    this.djs.push(peer);
    this.broadcast({name: 'setDjs', params: {
      djs: this.djs.map(p => p.id),
    }});

    // They're the first DJ so let's spin up a track
    if (this.djs.length === 1) {
      this.spinDj();
    }

    return {success: true};
  }

  removeDj = ({peer}) => {
    const index = this.djs.indexOf(peer);
    if (index === -1) {
      return false;
    }

    this.djs.splice(index, 1);
    this.broadcast({name: 'setDjs', params: {
      djs: this.djs.map(p => p.id),
    }});

    if (this.activeDj && peer.id === this.activeDj.id) {
      this.setActiveDj({peer: null});
      this.endTrack();
    }

    return true;
  }

  setActiveDj = ({peer}) => {
    if (!peer) {
      this.broadcast({name: 'setActiveDj', params: {djId: null}});
      this.activeDj = null;
      return;
    }

    this.activeDj = peer;
    this.broadcast({name: 'setActiveDj', params: {djId: peer.id}});
  }

  spinDj = () => {
    // Select the next DJ
    if (this.djs.length === 0) {
      this.setActiveDj({peer: null});
      return;
    } else if (this.activeDj === null) {
      this.setActiveDj({peer: this.djs[0]});
    } else {
      const currentIndex = this.djs.indexOf(this.activeDj);
      const nextIndex = (currentIndex + 1) % this.djs.length;
      this.setActiveDj({peer: this.djs[nextIndex]});
    }

    // Request a track
    this.activeDj.send({
      name: 'requestTrack', 
      callback: ({track}) => {
        track.id = uuid();
        track.url = `${process.env.BUOY_HTTP_URL}/tracks/${track.id}`;
        this.server.tracks[track.id] = {...track};

        // We don't need to send out the full data URL to clients
        delete track.data;
        this.nowPlaying = {
          track,
          votes: {},
          startedAt: ((+ new Date()) / 1000) + 4,
        };

        // Blast it off to everybody else
        this.broadcast({
          name: 'playTrack',
          params: this.nowPlaying,
        });
      },
    });
  }

  endTrack = () => {
    if (!this.nowPlaying) {
      return false;
    }

    delete this.server.tracks[this.nowPlaying.track.id];

    this.nowPlaying = null;
    this.broadcast({name: 'stopTrack'});
    this.broadcast({name: 'setActiveDj', params: {djId: null}});
    this.spinDj();
    return true;
  }

  sendChat = ({message, from}) => {
    this.broadcast({
      name: 'newChatMsg',
      params: {
        id: uuid(),
        message,
        fromPeerId: from.id,
        timestamp: (+ new Date()),
      },
    });
  }

  setVote = ({peerId, direction}) => {
    if (!this.nowPlaying) {
      return {error: true, message: 'there is no track playing'};
    }

    this.nowPlaying.votes[peerId] = !!direction;

    this.broadcast({
      name: 'setVotes',
      params: {votes: this.nowPlaying.votes},
    });

    // Do we need to skip the track?
    const {ups, downs} = Object.keys(this.nowPlaying.votes).reduce(({ups, downs}, peerId) => {
      if (this.nowPlaying.votes[peerId]) {
        return {downs, ups: ups + 1};
      } else {
        return {ups, downs: downs + 1};
      }
    }, {ups: 0, downs: 0});

    const quorumPerc = (ups + downs) / this.peers.length;
    const downPerc = downs / (ups + downs);
    const shouldSkip = quorumPerc >= .3 && downPerc >= .5;
    if (!this.skipWarning && shouldSkip) {
      // If we have >= 30% quorum and >= 50% of the room is voting against we
      // should skip
      this.broadcast({name: 'setSkipWarning', params: {value: true}});
      this.skipWarning = true;
      this.skipTimeout = setTimeout(() => {
        this.skipWarning = false;
        this.broadcast({name: 'setSkipWarning', params: {value: false}});
        this.endTrack();
      }, 5000);
    } else if (this.skipWarning && !shouldSkip) {
      // We no longer have support to skip, so let's cancel the warning
      clearTimeout(this.skipTimeout);
      this.skipWarning = false;
      this.broadcast({name: 'setSkipWarning', params: {value: false}});
    }

    return {success: true};
  }

  ////
  // Helper functions
  //
  broadcast = ({name, params, excludeIds = []}) => {
    this.peers.forEach((peer) => {
      if (excludeIds.includes(peer.id)) return;
      peer.send({name, params})
    });
  }

  serialize = ({includePeers = false} = {}) => ({
    id: this.id,
    name: this.name,
    skipWarning: this.skipWarning,
    ...(includePeers ? {
      peers: this.peers.map(p => p.serialize()),
      djs: this.djs.map(p => p.id),
      activeDj: this.activeDj ? this.activeDj.id : null,
    } : {}),
  })
}

module.exports = Room;
