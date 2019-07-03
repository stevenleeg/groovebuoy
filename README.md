# 🌊🛥️ Groovebuoy
_Minimal server side so that boats can groove_

## What's this?

If you don't know, you better check out what's
[Grooveboat](https://github.com/stevenleeg/grooveboat).

## Getting started

To run this, you'll need a recent version of
[node](https://nodejs.org/)
and
[yarn](http://gitlab.com/stevenleeg/grooveboat) (or npm) installed.

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

The main piece of information cointained in the seed invite is the URL to this
server, so you should make sure that this URL is reachable by the peers.
