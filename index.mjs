import express from 'express'
import wrap from 'express-async-handler'
import http from 'http'

const PORT = process.env.H2P_PORT || 3000
const ADDRESS = process.env.H2P_ADDRESS || 'localhost'
const ORIGIN = process.env.H2P_ORIGIN || `http://${ADDRESS}:${PORT}`
const NAME = process.env.H2P_NAME || 'hub2pub'

// Initialize Express

const app = express()

// Root object

app.get('/', wrap(async (req, res) => {
  res.status(200)
  res.json({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${ORIGIN}/`,
    type: 'Service',
    name: NAME
  })
}))

// Root object

app.get('/.well-known/webfinger', wrap(async (req, res) => {
  const resource = req.query.resource
  if (!resource) {
    res.status(400)
    res.json({
      error: 'invalid_request',
      error_description: 'The "resource" parameter is required'
    })
    return
  }
  const acct = resource.replace(/^acct:/, '')
  const [username, domain] = acct.split('@')
  if (domain !== (new URL(ORIGIN)).host) {
    res.status(404)
    res.json({
      error: 'invalid_request',
      error_description: 'The "resource" parameter must be a local user'
    })
    return
  }
  // TODO: check domain
  res.writeHead(200, {
    'Content-Type': 'application/jrd+json; charset=utf-8'
  })
  res.end(JSON.stringify({
    "links" : [
      {
        "href" : `${ORIGIN}/user/${username}`,
        "rel" : "self",
        "type" : "application/activity+json"
      }
    ],
    "subject" : resource
  }))
}))

app.get('/user/:username', wrap(async (req, res) => {
  const username = req.params.username
  res.writeHead(200, {
    'Content-Type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  })
  res.end(JSON.stringify({
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `${ORIGIN}/user/${username}`,
    "type": "Person",
    "name": username,
    "inbox": `${ORIGIN}/user/${username}/inbox`,
    "outbox": `${ORIGIN}/user/${username}/outbox`
  }))
}))

const eventToItem = (event) => {
  return {
    type: 'Create',
    id: `${ORIGIN}/event/${event.id}`,
    actor: {
      type: 'Person',
      id: `${ORIGIN}/user/${event.actor.login}`,
      name: event.actor.login
    },
    object: {
      type: 'Note',
      id: `${ORIGIN}/event/${event.id}/note`,
      content: `${event.actor.login} ${event.type} ${event.repo.name}`
    }
  }
}

app.get('/user/:username/outbox', wrap(async (req, res) => {
  const username = req.params.username
  const events = await (await fetch(`https://api.github.com/users/${username}/events/public`, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })).json()
  const items = events.map(eventToItem)
  res.writeHead(200, {
    'Content-Type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
  })
  res.end(JSON.stringify({
    "@context": "https://www.w3.org/ns/activitystreams",
    "id": `${ORIGIN}/user/${username}/outbox`,
    "type": "OrderedCollection",
    "nameMap": {
      "en": `Outbox for ${username}`
    },
    "first": {
      "id": `${ORIGIN}/user/${username}/outbox/latest`,
      "type": "OrderedCollectionPage",
      "items": items
    }
  }))
}))

// Start the server

const server = http.createServer(app)

server.listen(PORT, ADDRESS, () => {
  console.log(`Listening on ${ADDRESS}:${PORT}`)
})

// Define a function for cleanup tasks

const cleanup = () => {
  server.close(() => {
    process.exit(0)
  })
}

// Listen for SIGINT (Ctrl+C) and SIGTERM (Termination) signals

process.on('SIGINT', () => {
  cleanup()
})

process.on('SIGTERM', () => {
  cleanup()
})

process.on('exit', (code) => {
  console.log(`About to exit with code: ${code}`)
})
