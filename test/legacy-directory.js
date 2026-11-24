const test = require('brittle')
const fs = require('fs')
const path = require('path')
const tar = require('..')

// Generated with Python's tarfile.USTAR_FORMAT: two names ending in '/'
// with AREGTYPE (NUL) and REGTYPE ('0'), a symlink ending in '/', then a file.
const archive = fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy-directories.tar'))
const expected = [
  ['nul-directory/', 'directory', ''],
  ['regular-directory/', 'directory', ''],
  ['directory-link/', 'symlink', ''],
  ['after.txt', 'file', 'after the directories\n']
]

for (const chunkSize of [archive.length, 321, 1]) {
  test('legacy trailing-slash directories with chunk size ' + chunkSize, function (t) {
    t.plan(expected.length + 1)
    const extract = tar.extract()
    let index = 0

    extract.on('error', t.fail)
    extract.on('entry', function (header, stream, next) {
      let body = ''
      stream.on('data', function (chunk) {
        body += chunk.toString()
      })
      stream.on('end', function () {
        t.alike([header.name, header.type, body], expected[index++])
        next()
      })
    })
    extract.on('finish', function () {
      t.is(index, expected.length)
    })

    for (let offset = 0; offset < archive.length; offset += chunkSize) {
      extract.write(archive.subarray(offset, offset + chunkSize))
    }
    extract.end()
  })
}
