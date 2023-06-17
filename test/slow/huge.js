const test = require('brittle')
const zlib = require('zlib')
const fs = require('fs')
const { Writable } = require('streamx')
const tar = require('../..')
const fixtures = require('../fixtures')

test('huge', function (t) {
  t.plan(3)

  const extract = tar.extract()
  let noEntries = false
  const hugeFileSize = 8804630528 // ~8.2GB
  let dataLength = 0

  const countStream = new Writable({
    write (data, cb) {
      dataLength += data.length
      cb()
    }
  })

  // Make sure we read the correct pax size entry for a file larger than 8GB.
  extract.on('entry', function (header, stream, callback) {
    t.alike(header, {
      devmajor: 0,
      devminor: 0,
      gid: 20,
      gname: 'staff',
      linkname: null,
      mode: 420,
      mtime: new Date(1521214967000),
      name: 'huge.txt',
      pax: {
        'LIBARCHIVE.creationtime': '1521214954',
        'SCHILY.dev': '16777218',
        'SCHILY.ino': '91584182',
        'SCHILY.nlink': '1',
        atime: '1521214969',
        ctime: '1521214967',
        size: hugeFileSize.toString()
      },
      size: hugeFileSize,
      type: 'file',
      uid: 502,
      uname: 'apd4n'
    })

    noEntries = true
    stream.pipe(countStream)
    callback()
  })

  extract.on('finish', function () {
    t.ok(noEntries)
    t.is(dataLength, hugeFileSize)
  })

  const gunzip = zlib.createGunzip()
  const reader = fs.createReadStream(fixtures.HUGE)
  reader.pipe(gunzip).pipe(extract)
})
