const assert = require('node:assert/strict')
const { once } = require('node:events')
const { Readable, Writable } = require('node:stream')
const { pipeline } = require('node:stream/promises')
const test = require('node:test')
const { pack, extract } = require('tar-stream')

test('Node adapter delivers the archive to a native writable', async () => {
  const archive = pack()
  archive.entry({ name: 'hello.txt' }, 'hello')
  archive.finalize()

  const chunks = []
  await pipeline(Readable.from(archive, { objectMode: false }), new Writable({
    write (chunk, encoding, callback) {
      chunks.push(chunk)
      callback()
    }
  }))

  for (const encoding of [null, 'utf8']) {
    const unpack = extract()
    const finished = once(unpack, 'finish')
    const values = []
    unpack.on('entry', (header, entry, next) => {
      assert.equal(header.name, 'hello.txt')
      if (encoding) entry.setEncoding(encoding)
      entry.on('data', chunk => values.push(chunk))
      entry.on('end', next)
    })
    unpack.end(Buffer.concat(chunks))
    await finished
    assert.equal(values.map(chunk => chunk.toString()).join(''), 'hello')
    assert.equal(typeof values[0] === 'string', encoding === 'utf8')
    if (!encoding) assert.ok(values[0] instanceof Uint8Array)
  }
})

test('Node adapter forwards downstream failure and destroys the pack', async () => {
  const archive = pack()
  archive.entry({ name: 'hello.txt' }, 'hello')
  archive.finalize()
  const failure = new Error('destination failed')

  await assert.rejects(pipeline(Readable.from(archive, { objectMode: false }), new Writable({
    write (chunk, encoding, callback) {
      callback(failure)
    }
  })), failure)
  assert.equal(archive.destroyed, true)
})
