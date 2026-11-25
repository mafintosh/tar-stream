const test = require('brittle')
const concat = require('concat-stream')
const b4a = require('b4a')
const tar = require('..')
const constants = require('../constants')
const headers = require('../headers')

test('entries without bodies ignore stat sizes', async function (t) {
  const types = ['directory', 'link', 'character-device', 'block-device', 'fifo']
  const pack = tar.pack()
  const output = new Promise(resolve => pack.pipe(concat(resolve)))

  for (const type of types) {
    pack.entry({ name: type, type, size: 123, linkname: type === 'link' ? 'target' : undefined })
  }
  pack.entry({ name: 'after.txt' }, 'after')
  pack.finalize()

  const data = await output
  const expectedLength = (types.length + 4) * 512
  t.is(data.length, expectedLength, 'only the file body adds a padded block')
  if (data.length !== expectedLength) return

  const extract = tar.extract()
  const actual = []
  extract.end(data)
  for await (const entry of extract) {
    const chunks = []
    for await (const chunk of entry) chunks.push(chunk)
    actual.push({ type: entry.header.type, size: entry.header.size, body: b4a.toString(b4a.concat(chunks)) })
  }
  t.alike(actual, types.map(type => ({ type, size: 0, body: '' })).concat({ type: 'file', size: 5, body: 'after' }))
})

test('size normalization follows type inference from mode', async function (t) {
  const pack = tar.pack()
  const output = new Promise(resolve => pack.pipe(concat(resolve)))
  pack.entry({ name: 'directory', mode: constants.S_IFDIR | 0o755, size: 4096 })
  pack.entry({ name: 'link', mode: constants.S_IFLNK | 0o777, size: 6, linkname: 'target' })
  pack.finalize()

  const data = await output
  const directory = headers.decode(data.subarray(0, 512))
  const link = headers.decode(data.subarray(512, 1024))
  t.is(directory.type, 'directory')
  t.is(directory.size, 0)
  t.is(link.type, 'symlink')
  t.is(link.size, 0)
  t.is(data.length, 2048)
})
