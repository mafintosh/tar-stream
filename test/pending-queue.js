const test = require('brittle')
const concat = require('concat-stream')
const tar = require('..')

test('a large pending queue preserves every entry without overflowing the stack', async function (t) {
  const pack = tar.pack()
  const result = collect(pack)
  const first = pack.entry({ name: 'first', size: 4 })
  const expected = [{ name: 'first', body: 'head' }]
  let callbacks = 0

  for (let i = 0; i < 5000; i++) {
    const name = 'directory-' + i
    expected.push({ name, body: '' })
    pack.entry({ name, type: 'directory' }, function (err) {
      if (err) throw err
      callbacks++
    })
  }

  pack.entry({ name: 'last' }, 'tail')
  expected.push({ name: 'last', body: 'tail' })
  pack.finalize()
  setImmediate(() => first.end('head'))

  t.alike(await result, expected, 'queued headers and file bodies round-trip in order')
  t.is(callbacks, 5000, 'each queued entry completes once')
})

test('entries added by a pending entry callback keep FIFO order', async function (t) {
  const pack = tar.pack()
  const result = collect(pack)
  const first = pack.entry({ name: 'first', size: 1 })

  pack.entry({ name: 'directory-a', type: 'directory' }, function (err) {
    t.absent(err)
    pack.entry({ name: 'last' }, 'tail', function (err) {
      t.absent(err)
      pack.finalize()
    })
  })
  pack.entry({ name: 'directory-b', type: 'directory' })
  setImmediate(() => first.end('x'))

  t.alike(await result, [
    { name: 'first', body: 'x' },
    { name: 'directory-a', body: '' },
    { name: 'directory-b', body: '' },
    { name: 'last', body: 'tail' }
  ])
})

function collect (pack) {
  return new Promise((resolve, reject) => {
    const entries = []
    const extract = tar.extract()
    pack.on('error', reject)
    extract.on('error', reject)
    extract.on('entry', function (header, stream, next) {
      stream.pipe(concat(function (body) {
        entries.push({ name: header.name, body: body.toString() })
        next()
      }))
    })
    extract.on('finish', () => resolve(entries))
    pack.pipe(extract)
  })
}
