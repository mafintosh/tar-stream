var test = require('tape')
var tar = require('../index')
var fixtures = require('./fixtures')
var concat = require('concat-stream')
var fs = require('fs')
var stream = require('stream')
var zlib = require('zlib')

var clamp = function (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

test('one-file', function (t) {
  t.plan(3)

  var extract = tar.extract()
  var noEntries = false

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'test.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'hello world\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.ONE_FILE_TAR))
})

test('chunked-one-file', function (t) {
  t.plan(3)

  var extract = tar.extract()
  var noEntries = false

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'test.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'hello world\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  var b = fs.readFileSync(fixtures.ONE_FILE_TAR)

  for (var i = 0; i < b.length; i += 321) {
    extract.write(b.slice(i, clamp(i + 321, b.length, b.length)))
  }
  extract.end()
})

test('multi-file', function (t) {
  t.plan(5)

  var extract = tar.extract()
  var noEntries = false

  var onfile1 = function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'file-1.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    extract.on('entry', onfile2)
    stream.pipe(concat(function (data) {
      t.same(data.toString(), 'i am file-1\n')
      callback()
    }))
  }

  var onfile2 = function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'file-2.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'i am file-2\n')
      callback()
    }))
  }

  extract.once('entry', onfile1)

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.MULTI_FILE_TAR))
})

test('chunked-multi-file', function (t) {
  t.plan(5)

  var extract = tar.extract()
  var noEntries = false

  var onfile1 = function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'file-1.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    extract.on('entry', onfile2)
    stream.pipe(concat(function (data) {
      t.same(data.toString(), 'i am file-1\n')
      callback()
    }))
  }

  var onfile2 = function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'file-2.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'i am file-2\n')
      callback()
    }))
  }

  extract.once('entry', onfile1)

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  var b = fs.readFileSync(fixtures.MULTI_FILE_TAR)
  for (var i = 0; i < b.length; i += 321) {
    extract.write(b.slice(i, clamp(i + 321, b.length, b.length)))
  }
  extract.end()
})

test('pax', function (t) {
  t.plan(3)

  var extract = tar.extract()
  var noEntries = false

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'pax.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0,
      pax: { path: 'pax.txt', special: 'sauce' }
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'hello world\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.PAX_TAR))
})

test('types', function (t) {
  t.plan(3)

  var extract = tar.extract()
  var noEntries = false

  var ondir = function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'directory',
      mode: parseInt('755', 8),
      uid: 501,
      gid: 20,
      size: 0,
      mtime: new Date(1387580181000),
      type: 'directory',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })
    stream.on('data', function () {
      t.ok(false)
    })
    extract.once('entry', onlink)
    callback()
  }

  var onlink = function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'directory-link',
      mode: parseInt('755', 8),
      uid: 501,
      gid: 20,
      size: 0,
      mtime: new Date(1387580181000),
      type: 'symlink',
      linkname: 'directory',
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })
    stream.on('data', function () {
      t.ok(false)
    })
    noEntries = true
    callback()
  }

  extract.once('entry', ondir)

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.TYPES_TAR))
})

test('long-name', function (t) {
  t.plan(3)

  var extract = tar.extract()
  var noEntries = false

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'my/file/is/longer/than/100/characters/and/should/use/the/prefix/header/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/foobarbaz/filename.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 16,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'hello long name\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.LONG_NAME_TAR))
})

test('unicode-bsd', function (t) { // can unpack a bsdtar unicoded tarball
  t.plan(3)

  var extract = tar.extract()
  var noEntries = false

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'høllø.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 4,
      mtime: new Date(1387588646000),
      pax: {'SCHILY.dev': '16777217', 'SCHILY.ino': '3599143', 'SCHILY.nlink': '1', atime: '1387589077', ctime: '1387588646', path: 'høllø.txt'},
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'hej\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.UNICODE_BSD_TAR))
})

test('unicode', function (t) { // can unpack a bsdtar unicoded tarball
  t.plan(3)

  var extract = tar.extract()
  var noEntries = false

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'høstål.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 8,
      mtime: new Date(1387580181000),
      pax: {path: 'høstål.txt'},
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'høllø\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.UNICODE_TAR))
})

test('name-is-100', function (t) {
  t.plan(3)

  var extract = tar.extract()

  extract.on('entry', function (header, stream, callback) {
    t.same(header.name.length, 100)

    stream.pipe(concat(function (data) {
      t.same(data.toString(), 'hello\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(true)
  })

  extract.end(fs.readFileSync(fixtures.NAME_IS_100_TAR))
})

test('invalid-file', function (t) {
  t.plan(1)

  var extract = tar.extract()

  extract.on('error', function (err) {
    t.ok(!!err)
    extract.destroy()
  })

  extract.end(fs.readFileSync(fixtures.INVALID_TGZ))
})

test('space prefixed', function (t) {
  t.plan(5)

  var extract = tar.extract()

  extract.on('entry', function (header, stream, callback) {
    t.ok(true)
    callback()
  })

  extract.on('finish', function () {
    t.ok(true)
  })

  extract.end(fs.readFileSync(fixtures.SPACE_TAR_GZ))
})

test('gnu long path', function (t) {
  t.plan(2)

  var extract = tar.extract()

  extract.on('entry', function (header, stream, callback) {
    t.ok(header.name.length > 100)
    callback()
  })

  extract.on('finish', function () {
    t.ok(true)
  })

  extract.end(fs.readFileSync(fixtures.GNU_LONG_PATH))
})

test('base 256 uid and gid', function (t) {
  t.plan(2)
  var extract = tar.extract()

  extract.on('entry', function (header, stream, callback) {
    t.ok(header.uid === 116435139)
    t.ok(header.gid === 1876110778)
    callback()
  })

  extract.end(fs.readFileSync(fixtures.BASE_256_UID_GID))
})

test('base 256 size', function (t) {
  t.plan(2)

  var extract = tar.extract()

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'test.txt',
      mode: parseInt('644', 8),
      uid: 501,
      gid: 20,
      size: 12,
      mtime: new Date(1387580181000),
      type: 'file',
      linkname: null,
      uname: 'maf',
      gname: 'staff',
      devmajor: 0,
      devminor: 0
    })
    callback()
  })

  extract.on('finish', function () {
    t.ok(true)
  })

  extract.end(fs.readFileSync(fixtures.BASE_256_SIZE))
})

test('huge', function (t) {
  t.plan(1)

  var extract = tar.extract()
  var noEntries = false
  var hugeFileSize = 8804630528  // ~8.2GB
  var dataLength = 0

  var countStream = new stream.Writable()
  countStream._write = function (chunk, encoding, done) {
    dataLength += chunk.length
    done()
  }

  // Make sure we read the correct pax size entry for a file larger than 8GB.
  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
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
  })

  extract.on('finish', function () {
    t.ok(noEntries)
    t.equal(dataLength, hugeFileSize)
  })

  var gunzip = zlib.createGunzip()
  var reader = fs.createReadStream(fixtures.HUGE)
  reader.pipe(gunzip).pipe(extract)
})

test('latin-1', function (t) { // can unpack filenames encoded in latin-1
  t.plan(3)

  // This is the older name for the "latin1" encoding in Node
  var extract = tar.extract({ filenameEncoding: 'binary' })
  var noEntries = false

  extract.on('entry', function (header, stream, callback) {
    t.deepEqual(header, {
      name: 'En français, s\'il vous plaît?.txt',
      mode: parseInt('644', 8),
      uid: 0,
      gid: 0,
      size: 14,
      mtime: new Date(1495941034000),
      type: 'file',
      linkname: null,
      uname: 'root',
      gname: 'root',
      devmajor: 0,
      devminor: 0
    })

    stream.pipe(concat(function (data) {
      noEntries = true
      t.same(data.toString(), 'Hello, world!\n')
      callback()
    }))
  })

  extract.on('finish', function () {
    t.ok(noEntries)
  })

  extract.end(fs.readFileSync(fixtures.LATIN1_TAR))
})
