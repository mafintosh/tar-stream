const test = require('brittle')
const tar = require('..')

for (const uid of [0, 501, 0o777777, 0o1000000, 0o7777777, 1000000001, 4294967294, -1, -65536]) {
  test('owner ids survive packing and extraction: ' + uid, async function (t) {
    const gid = uid + 1
    const pack = tar.pack()
    pack.entry({ name: 'owned.txt', uid, gid, mtime: new Date(0), mode: 0o640 }, 'contents')
    pack.finalize()
    const chunks = []
    for await (const chunk of pack) chunks.push(chunk)

    const extract = tar.extract()
    extract.end(Buffer.concat(chunks))
    let count = 0
    for await (const entry of extract) {
      count++
      t.alike([entry.header.uid, entry.header.gid], [uid, gid])
      t.alike([entry.header.name, entry.header.mode, entry.header.mtime.getTime()], ['owned.txt', 0o640, 0])
      let body = ''
      for await (const chunk of entry) body += chunk.toString()
      t.is(body, 'contents')
    }
    t.is(count, 1)
  })
}
