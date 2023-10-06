import { describe, before, after, it } from 'node:test'
import { spawn } from 'node:child_process'
import assert from 'node:assert'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0

const startServer = (port = 3000, props = {}) => {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['index.mjs'], { env: { ...process.env, ...props, H2P_PORT: port } })
    server.on('error', reject)
    server.stdout.on('data', (data) => {
      if (data.toString().includes('Listening')) {
        resolve(server)
      }
      console.log(`SERVER ${port}: ${data.toString()}`)
    })
    server.stderr.on('data', (data) => {
      console.log(`SERVER ${port} ERROR: ${data.toString()}`)
    })
  })
}

describe('hub2pub', { only: true }, () => {
  let child = null

  before(async () => {
    child = await startServer(3000)
  })

  after(() => {
    child.kill('SIGTERM')
  })

  it('has a root route', { only: true }, async () => {
    const res = await fetch('http://localhost:3000/')
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.id, 'http://localhost:3000/')
    assert.equal(json.type, 'Service')
    assert.equal(json.name, 'hub2pub')
  })

  it('can get Webfinger address for a GitHub user', { only: true }, async () => {
    const res = await fetch('http://localhost:3000/.well-known/webfinger?resource=acct:evanp%40localhost:3000')
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/jrd+json; charset=utf-8')
    const json = await res.json()
    assert.equal(json.subject, 'acct:evanp@localhost:3000')
    assert.equal(json.links[0].rel, 'self')
    assert.equal(json.links[0].type, 'application/activity+json')
    assert.equal(json.links[0].href, 'http://localhost:3000/user/evanp')
  })

  it('can get actor page for a Github user', { only: true }, async () => {
    const res = await fetch('http://localhost:3000/user/evanp')
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
    const json = await res.json()
    assert.equal(json.id, 'http://localhost:3000/user/evanp')
    assert.equal(json.type, 'Person')
    assert.equal(json.name, 'evanp')
    assert.equal(json.inbox, 'http://localhost:3000/user/evanp/inbox')
    assert.equal(json.outbox, 'http://localhost:3000/user/evanp/outbox')
  })
})
