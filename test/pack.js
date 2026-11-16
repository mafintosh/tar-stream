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

for (const target of ['target.txt', 'høst/文件.txt', 'path/'.repeat(24) + 'target.txt']) {
  test('streamed symlink target: ' + target, async function (t) {
    const pack = tar.pack()
    const output = new Promise(resolve => pack.pipe(concat(resolve)))
    let callbacks = 0

    const entry = pack.entry({ name: 'link', type: 'symlink' }, function (err) {
      t.absent(err, 'entry completed without an error')
      callbacks++
    })

    pack.entry({ name: 'after.txt' }, 'after')
    pack.finalize()

    const bytes = b4a.from(target)
    entry.write(bytes.subarray(0, 2))
    await new Promise(resolve => setImmediate(resolve))

    t.is(callbacks, 0, 'entry callback waits for the complete target')

    entry.end(bytes.subarray(2))
    const data = await output
    t.is(callbacks, 1, 'entry callback runs once')

    const entries = await new Promise((resolve, reject) => {
      const entries = []
      const extract = tar.extract()
      extract.on('error', reject)
      extract.on('entry', function (header, stream, next) {
        stream.pipe(concat(function (body) {
          entries.push({
            name: header.name,
            type: header.type,
            linkname: header.linkname,
            size: header.size,
            body: body.toString()
          })
          next()
        }))
      })
      extract.on('finish', () => resolve(entries))
      extract.end(data)
    })

    t.alike(entries, [{
      name: 'link',
      type: 'symlink',
      linkname: target,
      size: 0,
      body: ''
    }, {
      name: 'after.txt',
      type: 'file',
      linkname: null,
      size: 5,
      body: 'after'
    }], 'target and following entry round-trip in order')
  })
}

test('destroying an unfinished streamed symlink reports the error', async function (t) {
  const pack = tar.pack()
  const error = new Error('target source failed')
  const closed = new Promise(resolve => pack.on('close', resolve))
  const completed = new Promise(resolve => {
    const entry = pack.entry({ name: 'link', type: 'symlink' }, resolve)
    entry.on('error', err => t.is(err, error, 'entry reports the source error'))
    entry.write('partial')
    setImmediate(() => entry.destroy(error))
  })

  pack.on('error', err => t.is(err, error, 'pack reports the source error'))
  pack.resume()

  t.is(await completed, error, 'callback reports failure instead of early success')
  await closed
})
