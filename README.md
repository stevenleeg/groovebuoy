# 🌊🛥️ Groovebuoy
_Minimal server side so that boats can groove_

# What's this?

If you don't know, you better check out what's
[Grooveboat](https://github.com/stevenleeg/grooveboat).

# Getting started

To run this, you'll need a recent version of
[node](https://nodejs.org/)
and
[yarn](https://yarnpkg.com/) (or npm) installed.

Clone the repo:

```
$ git clone https://github.com/stevenleeg/groovebuoy.git
```

Install dependencies:

```
$ yarn install
```

Set up needed environment variables:

```
cp .env.example .env
"${EDITOR:-vi}" .env # You may want to change the defaults, otherwise skip this
```

Spin up a local webserver:

```
$ yarn start
```

The buoy will be spun up and a *seed invite* will be available for you
in the console, you can share it with your friends so they can join this buoy.

The main piece of information contained in the seed invite is the URL to this
server, so you should make sure that this URL is reachable by the peers.

# API Reference
If you're interested in creating a bot (or alternative client) for Grooveboat,
this reference should provide you with all of the information necessary to do
so. In addition, you may wish to browse through [Groovebot](https://github.com/stevenleeg/groovebot) to see an example of what this could look like in practice with a Node.js bot.

## Connecting
Buoys expose an RPC API using [socket.io](https://socket.io/) as the
communication medium. Socket.io has libraries in a variety of different
languages (see [python](https://github.com/miguelgrinberg/python-socketio), 
[golang](https://github.com/googollee/go-socket.io), etc.) that can be used to
develop first-class clients with buoys.

For the sake of simplicity, this guide will be written using the standard [Node client library](https://www.npmjs.com/package/socket.io-client).

Connecting to a buoy looks more or less like this:

```javascript
const io = require('socket.io-client');

// (Assuming you're running a buoy locally)
const socket = io('ws://localhost:8000');

socket.on('connect', () => {
    console.log('connected to buoy!');
});
```

Once you're connected you'll have access to an RPC API, which can be used to make API calls like so:

```javascript
socket.emit('call', {name: 'methodName', params: {some: 'params', go: 'here'}});
```

It's usually wise to set up a helper function to wrap this, eg:

```javascript
const callRPC = ({name, params}) => {
  return new Promise((resolve, reject) => {
    this.socket.emit('call', {name, params}, (resp) => {
      resolve(resp);
    });
  });
};
```

This will allow you to use the async/await syntax:

```
const resp = await callRPC({name: 'someMethod', params: {some: 'params'}});
console.log(resp);
```

The remainder of this guide will assume you have access to the `callRPC` function.

**TODO:** At some point in the future we'll write a nice node wrapper to build bots with, but for now this guide will have to do.

## Authentication
Once you've connected to a buoy, your client has ~5 seconds to authenticate. The authentication process requires an **invite code** in the form of a [JSON Web Token](https://jwt.io/) signed by the buoy. As of now the only way to get one of these tokens is by looking at the logs of the buoy as it starts, which should look like this:

```
yarn run v1.6.0
$ babel-node index.js --presets es2015,stage-2
Seed invite:
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJnIjoxNTYyNzA3NDQ2LCJ1Ijoid3M6Ly8xMC4wLjEzLjgwOjgwMDAvIiwibiI6InllZXQgcGFsYWNlIiwiaWF0IjoxNTYyNzA3NDQ2fQ.fHo1mCwexgnBADzHshI_LHz3J-yLudHCAvtp3G-82zo

Server is listening on port 8000
```

**YIKES:** The infrastructure around invite codes will be changing shortly, as this quite obviously sucks and needs some rethinking.

This invite code will allow a client to join a server and receive an authentication token, which can then be used to authenticate in subsequent connections.

----

Joining a server:

```javascript
const INVITE_CODE = '...';

socket.on('connect', async () => {
  const resp = await callRPC({name: 'join', params: {jwt: INVITE_CODE});
  if (resp.error) {
    console.log('could not join server:', resp.message);
    return;
  }
  
  const {token, peerId} = resp;
  console.log('joined buoy with peerId', peerId);
  console.log('received auth token:', token);
  
  // ... the client should store the auth token in a safe place.
});
```

After joining, the client can authenticate with the auth token like so:

```javascript
const authToken = fetchAuthTokenFromStorage();

socket.on('connect', () => {
  const resp = await callRPC({name: 'authenticate', params: {jwt: authToken}});
  if (resp.error) {
    console.log('could not join server:', resp.message);
    return;
  }
  
  const {peerId} = resp;
  console.log('connected to buoy with peerId', peerId);
});
```

Note that the `join` method will both join the server *and* authenticate the client, meaning you do not need to join and then authenticate on the first connection to a buoy.

Once you've successfully authenticated you have access to the full suite of RPC methods, all of which are listed below.

## Server RPC Methods

### `authenticate`
Authenticate to the server using an auth token. The auth token is a JWT with the following schema:

```javascript
{
    "u": "ws://localhost:8000", // The URL of the buoy
    "n": "some buoy",           // The name of the buoy
    "i": "[uuid]"               // The UUID of the authenticated peer
}
```

**Params:**

* `jwt`: The auth token used to authenticate

**Response:**

* `peerId`: The ID of the peer that was authenticated. This should match the `i` field of the auth token.

### `becomeDj`
Attempt to become a DJ in the room. This method will fail if there are 5 or more DJs already present, or if the peer has yet to join a room.

Note that, if successful, the server will immediately call `setDjs` on the client to update the DJ list. The client *should not* update its internal DJ list after receiving a successful response from this RPC call.

**Params:**

None

**Response:**

* `success`: A boolean representing whether or not the operation was a success.

### `createRoom`
Creates a new room on the buoy.

**Params:**

* `name`: The name of the room

**Response:**

* `id`: The ID of the room

### `fetchRooms`
Fetches the current list of rooms on the buoy

**Params:**

None

**Response:**

An array of [serialized rooms](#room).

### `join`
Join the buoy, exchanging an invite code for an authentication token that can be used to authenticate a given peer in future connections.

**Params:**
* `jwt`: The invite code

**Response**:
* `token`: The auth token that can be used in future connections (presented to the `authenticate` method).
* `peerId`: The ID of the new peer. This identifier will be reused between connections if the client uses the `token` to authenticate.

### `joinRoom`
Joins a room on the buoy, also subscribing the client to any events that take place within that room.

**Params:**

`id`: The ID of the room to join

**Response:**

A serialized [room object](#room).

### `leaveRoom`
Leaves the peer's current room. This method will also unsubscribe the peer from any events that take place within the room.

**Params:**

None

**Response:**

* `success`: A boolean representing that the operation was successful.

### `sendChat`
Sends a chat message to the peer's current room.

**Params:**

* `message`: The text message to be sent to the room.

**Response:**

* `success`: A boolean representing that the operation was successful.

### `setProfile`
Sets the profile of the peer. A profile is an object that can contain whatever values, though the default Grooveboat client currently recognizes the following schema:

```javascript
{
  "handle": "coolkid42", // The display name of the peer
  "emoji": "🐧"          // An emoji associated with the peer (their "avatar")
}
```

**Params:**

* `profile`: A profile object, as defined in the description above.

**Response:**

* `success`: A boolean representing that the operation was successful.

### `skipTurn`
Skips the peer's turn if they are the active DJ of a room, otherwise fails.

**Params:**

None

**Response:**

* `success`: A boolean representing that the operation was successful.

### `stepDown`
Steps down from being a DJ in the room, ie returning to the audience. Fails if the peer is not currently a DJ.

**Params:**

None

**Response:**

* `success`: A boolean representing that the operation was successful.

### `trackEnded`
Alerts the buoy that the current track is over, allowing the next DJ to begin their turn. Fails if the peer is not the currently active DJ in the room.

Note that, yes, you can technically be a jerk and not call this method if it is your turn and cause the room to freeze. Generally people will vote you down and cause the song to skip if this happens, so it's best to be a good citizen and call this method as soon as your track has ended.

### `updatedQueue`
Notifies the buoy that your currently active queue has been updated. This allows the buoy to intelligently preload tracks from DJs in the room, responding to upcoming DJs changing their queues as necessary. *This method should only be called if the peer updates their active queue while being a DJ*.

Note that this has no params, as the server will call `requestTrack` on the client if it decides it wishes to preload a track off of the peer's freshly updated queue.

**Params:**

None

**Response:**

* `success`: A boolean representing that the operation was successful.

### `vote`
Sets the peer's vote for the currently playing track. Will fail if the user is not currently in a room or there is no track playing.

Note that there is currently no way to revoke a vote, you can only change to the other direction by calling this method again on the same track.

**Params:**

* `direction`: A boolean deciding the direction of the vote. `true` means up, `false` means down.

**Response:**

* `success`: A boolean representing that the operation was successful.

## Client RPC methods

### `cycleSelectedQueue`
Causes the client to cycle the first track of their active queue to the end of the queue. This is used after a peer has completed their turn as DJ in order to prevent the same track from playing on their next turn (assuming they have more than one track in their queue).

**Params:**

None

**Response:**

None

### `newChatMsg`
Causes the client to append the associated chat message onto their chat log.

**Params:**

* `id`: ID of the message
* `message`: Text of the message
* `fromPeerId`: The peer ID of who sent the message.
* `timestamp`: A timestamp in UNIX epoch time.

**Response:**

None

### `playTrack`
Causes the client to begin to play the specified chat. Before loading the track, the client should check the current value of the track on deck. If the on deck track ID matches the provided track ID of this method, it should use the preloaded track rather than reloading the URL from this method.

**Params:**

* `track`: A [track](#track) object
* `votes`: An object of votes on the track. The keys will be peer IDs and the values will be vote directions (see [vote](#vote)).
* `startedAt`: The timestamp, in UNIX epoch, that this track should begin playing and have the playhead synced up to. Note that this may be in the future, in which case the client should wait before starting playback.

**Response:**

None

### `requestTrack`
Requests a track from the client's queue, generally the first track.

**Params:**

None

**Response:**

* `filename`: The name of the track's source file.
* `artist`: The name of the track artists (if present in the file's ID3 data).
* `album`: The name of the album (if present in the file's ID3 data).
* `title`: The name of the track (if present in the file's ID3 data).
* `contentType`: The MIME content type associted with the file.
* `data`: A base64 encoded string representing the binary data of the file.

### `setActiveDj`
Sets the active DJ in a room

**Params:**

* `djId`: The ID of the peer that is now the active DJ. This value will also be contained by the set of the room's current DJs.


**Response:**

None

### `setDjs`
Sets the set of peers that are considered DJs in the room.

**Params:**

* `djs`: An array of peer IDs

**Response:**

None

### `setOnDeck`
Provides the client with a track that should be assumed to be the next track after the current track completes playback. The client should begin to preload this track in order to reduce dead airspace due to loading times after the current track is completed.

**Params:**

* `track`: A [track](#track) object.

**Response:**

None

### `setPeers`
Sets the current peers in the room.

**Params:**

* `peers`: An array of [peer objects](#peer)

**Response:**

None

### `setRooms`
Sets the array of rooms currently available on the buoy. This is only called on the client if they are not currently associated with a room (ie they're in the room selector screen on the default Grooveboat client). It is called every time there is a new room, a room's current track is updated, or its peer count changes.

**Params:**

* `rooms`: An array of [room objects](#room)

**Response:**

None

### `setSkipWarning`
Sets the skip warning for a track to `true` or `false`. The skip warning is activated when a song has been downvoted by the room's peers and is about to be skipped. When this is set to true, clients should show a warning that the track will be skipped unless peers change their vote to up.

**Params:**

* `value`: A boolean representing whether or not the skip warning is active.

**Response:**

None

### `setVotes`
Sets the `votes` object for the currently playing track.

**Params:**

* `votes`: An object of votes on the track. See [playTrack](#playtrack) for schema.

**Response:**

None

### `stopTrack`
Stop playback of the currently playing track. This should also reset any UI the client has displaying the currently playing track to an "awaiting track" state.

**Params:**

None

**Response:**

None

## Object schemas

### Room
* `id`: ID of the room
* `name`: Name of the room
* `peerCount`: The number of peers in the room
* `nowPlaying`: The currently playing track or `null`

If the `nowPlaying` key is not null, it will be a [Track](#track) object

### Track
* `id`: ID of the track
* `filename`: The name of the track's source file
* `artist`: The name of the track artists (if present in the file's ID3 data)
* `album`: The name of the album (if present in the file's ID3 data)
* `title`: The name of the track (if present in the file's ID3 data)
* `url`: (optional) An HTTP(S) URL that can be used to download the file.

When presenting this information to an end user, you should generally fall back to using the `filename` key if the `artist`, `album`, or `title` keys are `null`.

### Peer
* `id`: The ID of the peer.
* `profile`: The [profile object](#setprofile) of the peer.
