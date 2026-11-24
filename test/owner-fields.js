const test = require('brittle')
const tar = require('..')

const cases = [
  { label: 'long user name', uname: 'u'.repeat(80), gname: '', expectedUser: 'u'.repeat(32), expectedGroup: '' },
  { label: 'long group name', uname: 'user', gname: 'g'.repeat(80), expectedUser: 'user', expectedGroup: 'g'.repeat(32) },
  { label: 'full-width fields', uname: 'u'.repeat(32), gname: 'g'.repeat(32), expectedUser: 'u'.repeat(32), expectedGroup: 'g'.repeat(32) },
  { label: 'UTF-8 boundary', uname: 'u'.repeat(30) + '😀', gname: 'g'.repeat(31) + 'é', expectedUser: 'u'.repeat(30), expectedGroup: 'g'.repeat(31) }
]

for (const name of ['file.txt', 'parent/'.repeat(20) + 'file.txt']) {
  for (const c of cases) {
    test(c.label + ' preserves surrounding header fields: ' + name, function (t) {
      t.plan(3)
      const pack = tar.pack()
      const extract = tar.extract()
      let entries = 0

      pack.on('error', t.fail)
      extract.on('error', t.fail)
      extract.on('entry', function (header, stream, next) {
        entries++
        t.alike([header.name, header.uname, header.gname, header.devmajor, header.devminor],
          [name, c.expectedUser, c.expectedGroup, 12, 34])
        let body = ''
        stream.on('data', function (chunk) {
          body += chunk.toString()
        })
        stream.on('end', function () {
          t.is(body, 'contents')
          next()
        })
      })
      extract.on('finish', function () {
        t.is(entries, 1)
      })

      pack.pipe(extract)
      pack.entry({ name, uname: c.uname, gname: c.gname, devmajor: 12, devminor: 34 }, 'contents')
      pack.finalize()
    })
  }
}
