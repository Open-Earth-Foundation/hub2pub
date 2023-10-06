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

app.get('/', wrap((req, res) => {
    res.status(200)
    res.json({
        '@context': 'https://www.w3.org/ns/activitystreams',
        id: `${ORIGIN}/`,
        type: 'Service',
        name: NAME
    })
}))

// Root object

app.get('/.well-known/webfinger', wrap((req, res) => {
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
    res.status(200)
    res.contentType('application/jrd+json')
    res.json({
        "links" : [
            {
               "href" : `${ORIGIN}/user/${username}`,
               "rel" : "self",
               "type" : "application/activity+json"
            }
         ],
         "subject" : resource
    })
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
