const test = require('brittle')
const concat = require('concat-stream')
const fs = require('fs')
const path = require('path')
const tar = require('..')

// Written with Python's tarfile.PAX_FORMAT and read back with tarfile.
// The path/size control has a zero ustar size with a recomputed checksum;
// its PAX size still describes the 12-byte body.
const archive = fs.readFileSync(path.join(__dirname, 'fixtures', 'pax-metadata.tar'))
const entries = [
  {
    name: 'plain.txt',
    uid: 12,
    gid: 34,
    uname: 'alice',
    gname: 'staff',
    size: 5,
    mtime: new Date(1000000),
    body: 'plain',
    pax: null
  },
  {
    name: 'extended.txt',
    uid: 34359738368,
    gid: 68719476736,
    uname: 'owner-'.repeat(8),
    gname: 'group-'.repeat(8),
    size: 8,
    mtime: new Date(1700000000125),
    body: 'metadata',
    pax: {
      uid: '34359738368',
      gid: '68719476736',
      uname: 'owner-'.repeat(8),
      gname: 'group-'.repeat(8),
      mtime: '1700000000.125'
    }
  },
  {
    name: 'zero.txt',
    uid: 0,
    gid: 0,
    uname: 'root',
    gname: 'wheel',
    size: 4,
    mtime: new Date(0),
    body: 'zero',
    pax: { uid: '0', gid: '0', uname: 'root', gname: 'wheel', mtime: '0' }
  },
  {
    name: 'negative-time.txt',
    uid: 7,
    gid: 8,
    uname: 'alice',
    gname: 'staff',
    size: 12,
    mtime: new Date(-250),
    body: 'before epoch',
    pax: { mtime: '-0.25' }
  },
  {
    name: 'time-only.txt',
    uid: 19,
    gid: 29,
    uname: 'carol',
    gname: 'team',
    size: 9,
    mtime: new Date(2000750),
    body: 'time only',
    pax: { mtime: '2000.75', 'VENDOR.note': 'keep this' }
  },
  {
    name: 'renamed.txt',
    uid: 23,
    gid: 31,
    uname: 'erin',
    gname: 'users',
    size: 12,
    mtime: new Date(2500000),
    body: 'path control',
    pax: { path: 'renamed.txt', size: '12' }
  },
  {
    name: 'after.txt',
    uid: 45,
    gid: 67,
    uname: 'dana',
    gname: 'users',
    size: 5,
    mtime: new Date(3000000),
    body: 'after',
    pax: null
  }
]

for (const chunkSize of [archive.length, 321, 1]) {
  test('PAX metadata overrides ustar fields, chunk size ' + chunkSize, function (t) {
    t.plan(entries.length * 3 + 1)

    const extract = tar.extract()
    let count = 0

    extract.on('entry', function (header, stream, next) {
      const { body, pax, ...expected } = entries[count++]
      const { name, uid, gid, uname, gname, size, mtime } = header
      t.alike({ name, uid, gid, uname, gname, size, mtime }, expected, name + ' metadata')
      t.alike(header.pax, pax, name + ' retains raw PAX values')

      stream.pipe(concat(function (data) {
        t.is(data.toString(), body, name + ' body')
        next()
      }))
    })

    extract.on('finish', function () {
      t.is(count, entries.length, 'all entries extracted')
    })

    for (let offset = 0; offset < archive.length; offset += chunkSize) {
      extract.write(archive.subarray(offset, offset + chunkSize))
    }
    extract.end()
  })
}
