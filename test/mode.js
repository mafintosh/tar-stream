const test = require('brittle')
const tar = require('..')

test('packing preserves zero permission modes', function (t) {
  t.plan(5)

  const entries = [
    { name: 'locked-file', type: 'file', mode: 0 },
    { name: 'locked-directory', type: 'directory', mode: 0 },
    { name: 'default-file', type: 'file' },
    { name: 'default-directory', type: 'directory' }
  ]
  const modes = [0, 0, 0o644, 0o755]
  const pack = tar.pack()
  const extract = tar.extract()
  let index = 0

  pack.on('error', t.fail)
  extract.on('error', t.fail)
  extract.on('entry', function (header, stream, next) {
    t.alike([header.name, header.type, header.mode], [entries[index].name, entries[index].type, modes[index]])
    index++
    stream.on('end', next)
    stream.resume()
  })
  extract.on('finish', function () {
    t.is(index, entries.length)
  })

  pack.pipe(extract)
  for (const entry of entries) pack.entry(entry, '')
  pack.finalize()
})
