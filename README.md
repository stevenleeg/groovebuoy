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

An array of serialized rooms with the following schema:

* `id`: ID of the room
* `name`: Name of the room
* `peerCount`: The number of peers in the room
* `nowPlaying`: The currently playing track or `null`

If the `nowPlaying` key is not null, it will be an object of the following schema:

* `id`: ID of the track
* `filename`: The name of the track's source file
* `artist`: The name of the track artists (if present in the file's ID3 data)
* `album`: The name of the album (if present in the file's ID3 data)
* `title`: The name of the track (if present in the file's ID3 data)

When presenting this information to an end user, you should generally fall back to using the `filename` key if the `artist`, `album`, or `title` keys are `null`.

### `join`
Coming soon....
