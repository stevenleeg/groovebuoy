require('dotenv').config();

const express = require('express');
const http = require('http');
const SocketIO = require('socket.io');
const PeerServer = require('./models/peer-server');
const IPFSFactory = require('ipfsd-ctl');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const {promisify} = require('util');

const repoPath = path.join(os.homedir(), '.groovebuoy');
const bootIPFS = async () => {
  const factory = IPFSFactory.create()

  const callSpawn = promisify(factory.spawn.bind(factory));
  const ipfsd = await callSpawn({repoPath, disposable: false});
  global.ipfsd = ipfsd;

  // Promisify some things
  const callInit = promisify(ipfsd.init.bind(ipfsd));
  const callStart = promisify(ipfsd.start.bind(ipfsd));
  const callStop = promisify(ipfsd.stop.bind(ipfsd));

  // Init and boot the IPFS node
  if (!fs.existsSync(repoPath)) {
    await callInit();
  }
  await callStart();

  // Is the swarm address exposed publically?
  let addresses;
  try {
    addresses = await ipfsd.api.config.get('Addresses.Swarm');
  } catch (e) {
    if (e.errno !== 'ECONNREFUSED') {
      console.log('ipfs error:', e);
      process.exit(1);
    }

    // Let's try reiniting our ipfs repository
    await promisify(fs.remove)(repoPath);
    bootIPFS();
    return;
  }

  if (addresses.indexOf('/ip4/0.0.0.0/tcp/5921') !== -1) {
    console.log('ipfs node is running');
    return;
  }

  await ipfsd.api.config.set('Addresses.Swarm', ['/ip4/0.0.0.0/tcp/5921']);
  await ipfsd.api.config.set('Addresses.API', '/ip4/127.0.0.1/tcp/59211');
  await callStop();
  await callStart();

  console.log('ipfsd node is configured and running');
};

bootIPFS();

// Spin up our webserver
const app = express();
const server = http.createServer(app);
const io = SocketIO(server);
const peerServer = new PeerServer({socket: io});

server.listen(8000, () => {
  console.log('Server is listening on port 8000');
});
