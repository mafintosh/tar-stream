const test = require('brittle')
const concat = require('concat-stream')
const fs = require('fs')
const b4a = require('b4a')
const { Writable } = require('streamx')
const tar = require('..')
const fixtures = require('./fixtures')

test('one-file', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({
    name: 'test.txt',
    mtime: new Date(1387580181000),
    mode: 0o644,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20
  }, 'hello world\n')

  pack.finalize()

  pack.pipe(concat(function (data) {
    t.is(data.length & 511, 0)
    t.alike(data, fs.readFileSync(fixtures.ONE_FILE_TAR))
  }))
})

test('multi-file', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({
    name: 'file-1.txt',
    mtime: new Date(1387580181000),
    mode: 0o644,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20
  }, 'i am file-1\n')

  pack.entry({
    name: 'file-2.txt',
    mtime: new Date(1387580181000),
    mode: 0o644,
    size: 12,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20
  }).end('i am file-2\n')

  pack.finalize()

  pack.pipe(concat(function (data) {
    t.is(data.length & 511, 0)
    t.alike(data, fs.readFileSync(fixtures.MULTI_FILE_TAR))
  }))
})

test('pax', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({
    name: 'pax.txt',
    mtime: new Date(1387580181000),
    mode: 0o644,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20,
    pax: { special: 'sauce' }
  }, 'hello world\n')

  pack.finalize()

  pack.pipe(concat(function (data) {
    t.is(data.length & 511, 0)
    t.alike(data, fs.readFileSync(fixtures.PAX_TAR))
  }))
})

test('types', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({
    name: 'directory',
    mtime: new Date(1387580181000),
    type: 'directory',
    mode: 0o755,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20
  })

  pack.entry({
    name: 'directory-link',
    mtime: new Date(1387580181000),
    type: 'symlink',
    linkname: 'directory',
    mode: 0o755,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20,
    size: 9 // Should convert to zero
  })

  pack.finalize()

  pack.pipe(concat(function (data) {
    t.is(data.length & 511, 0)
    t.alike(data, fs.readFileSync(fixtures.TYPES_TAR))
  }))
})

test('empty directory body is valid', function (t) {
  t.plan(1)

  const pack = tar.pack()

  pack.entry({
    name: 'directory',
    mtime: new Date(1387580181000),
    type: 'directory',
    mode: 0o755,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20
  }, '')

  pack.finalize()

  pack.resume()

  pack.on('error', () => t.fail('should not throw'))
  pack.on('close', () => t.pass('closed'))
})

test('long-name', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({
    name: 'my/file/is/longer/than/100/characters/and/should/use/the/prefix/header/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/filename.txt',
    mtime: new Date(1387580181000),
    type: 'file',
    mode: 0o644,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20
  }, 'hello long name\n')

  pack.finalize()

  pack.pipe(concat(function (data) {
    t.is(data.length & 511, 0)
    t.alike(data, fs.readFileSync(fixtures.LONG_NAME_TAR))
  }))
})

test('large-uid-gid', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({
    name: 'test.txt',
    mtime: new Date(1387580181000),
    mode: 0o644,
    uname: 'maf',
    gname: 'staff',
    uid: 1000000001,
    gid: 1000000002
  }, 'hello world\n')

  pack.finalize()

  pack.pipe(concat(function (data) {
    t.is(data.length & 511, 0)
    t.alike(data, fs.readFileSync(fixtures.LARGE_UID_GID))
  }))
})

test('unicode', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({
    name: 'høstål.txt',
    mtime: new Date(1387580181000),
    type: 'file',
    mode: 0o644,
    uname: 'maf',
    gname: 'staff',
    uid: 501,
    gid: 20
  }, 'høllø\n')

  pack.finalize()

  pack.pipe(concat(function (data) {
    t.is(data.length & 511, 0)
    t.alike(data, fs.readFileSync(fixtures.UNICODE_TAR))
  }))
})

test('backpressure', async function (t) {
  const end = t.test('end')
  end.plan(1)

  const slowStream = new Writable({
    highWaterMark: 1,

    write (data, cb) {
      setImmediate(cb)
    }
  })

  slowStream.on('finish', () => end.pass())

  const pack = tar.pack()

  let later = false

  setImmediate(() => { later = true })

  pack
    .on('end', () => t.ok(later))
    .pipe(slowStream)

  let i = 0
  const next = () => {
    if (++i < 25) {
      const header = {
        name: `file${i}.txt`,
        mtime: new Date(1387580181000),
        mode: 0o644,
        uname: 'maf',
        gname: 'staff',
        uid: 501,
        gid: 20
      }

      const buffer = b4a.alloc(1024)

      pack.entry(header, buffer, next)
    } else {
      pack.finalize()
    }
  }

  next()

  await end
})

test('mtime outside the 32-bit range', function (t) {
  t.plan(7)

  // (getTime() / 1000) | 0 used to truncate the seconds to a signed 32-bit
  // integer: 2039 became 2242, 2106 became 1970 and some later dates
  // produced headers no tar implementation could read.
  const pack = tar.pack()

  pack.entry({ name: 'y2039', mtime: new Date(2200000000 * 1000), mode: 0o644 }, 'a')
  pack.entry({ name: 'y2106', mtime: new Date(4294967296 * 1000), mode: 0o644 }, 'b')
  pack.entry({ name: 'y2242', mtime: new Date(8589934592 * 1000), mode: 0o644 }, 'c')
  pack.entry({ name: 'y1969', mtime: new Date(-1000), mode: 0o644 }, 'd')

  pack.finalize()

  pack.pipe(concat(function (data) {
    // 2200000000 still fits the 11-digit octal field
    t.is(b4a.toString(data.subarray(136, 148), 'latin1'), (2200000000).toString(8) + ' ')
    // 8589934592 does not: GNU base-256, 0x80 then the value big-endian
    t.alike(data.subarray(2 * 1024 + 136, 2 * 1024 + 148), b4a.from([0x80, 0, 0, 0, 0, 0, 0, 0x02, 0, 0, 0, 0]))
    // -1 is base-256 two's complement: 0xff followed by all ones
    t.alike(data.subarray(3 * 1024 + 136, 3 * 1024 + 148), b4a.alloc(12, 0xff))

    const extract = tar.extract()
    const mtimes = []

    extract.on('entry', function (header, stream, next) {
      mtimes.push(header.mtime.getTime())
      stream.resume()
      next()
    })

    extract.on('finish', function () {
      t.is(mtimes[0], 2200000000 * 1000)
      t.is(mtimes[1], 4294967296 * 1000)
      t.is(mtimes[2], 8589934592 * 1000)
      t.is(mtimes.length, 4)
    })

    extract.end(data)
  }))
})
