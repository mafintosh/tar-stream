const test = require('brittle')
const fs = require('fs')
const path = require('path')
const tar = require('..')

// Generated with Python's tarfile.GNU_FORMAT, setting each empty entry's
// mtime, uid and gid to the integer used as its filename.
const values = [-1, -255, -256, -257, -65536, -1000000, -31536000, -4294967296, 0, 1, 255, 256, 8589934592]
const archive = fs.readFileSync(path.join(__dirname, 'fixtures', 'negative-base-256.tar'))

for (const chunkSize of [archive.length, 321, 1]) {
  test('signed base-256 fields with chunk size ' + chunkSize, function (t) {
    t.plan(values.length + 1)
    const extract = tar.extract()
    let index = 0

    extract.on('error', t.fail)
    extract.on('entry', function (header, stream, next) {
      const value = values[index++]
      t.alike([header.name, header.mtime.getTime() / 1000, header.uid, header.gid], [String(value), value, value, value])
      stream.on('end', next)
      stream.resume()
    })
    extract.on('finish', function () {
      t.is(index, values.length)
    })

    for (let offset = 0; offset < archive.length; offset += chunkSize) {
      extract.write(archive.subarray(offset, offset + chunkSize))
    }
    extract.end()
  })
}
