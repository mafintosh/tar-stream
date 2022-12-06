const { constants } = require('fs')
const { Readable, Writable } = require('streamx')
const { StringDecoder } = require('string_decoder')
const b4a = require('b4a')

const headers = require('./headers')

const DMODE = 0o755
const FMODE = 0o644

const END_OF_TAR = b4a.alloc(1024)

const noop = function () {}

const overflow = function (self, size) {
  size &= 511
  if (size) self.push(END_OF_TAR.subarray(0, 512 - size))
}

function modeToType (mode) {
  switch (mode & constants.S_IFMT) {
    case constants.S_IFBLK: return 'block-device'
    case constants.S_IFCHR: return 'character-device'
    case constants.S_IFDIR: return 'directory'
    case constants.S_IFIFO: return 'fifo'
    case constants.S_IFLNK: return 'symlink'
  }

  return 'file'
}

class Sink extends Writable {
  constructor (to) {
    super()
    this.written = 0
    this._to = to
  }

  _write (data, cb) {
    this.written += data.byteLength
    if (this._to.push(data)) return cb()
    this._to._drain = cb
  }
}

class LinkSink extends Writable {
  constructor () {
    super()
    this.linkname = ''
    this._decoder = new StringDecoder('utf-8')
  }

  _write (data, cb) {
    this.linkname += this._decoder.write(data)
    cb()
  }
}

class Void extends Writable {
  _write (data, cb) {
    cb(new Error('No body allowed for this entry'))
  }
}

class Pack extends Readable {
  constructor (opts) {
    super(opts)
    this._drain = noop
    this._finalized = false
    this._finalizing = false
    this._stream = null
  }

  entry (header, buffer, callback) {
    if (this._stream) throw new Error('already piping an entry')
    if (this._finalized || this.destroyed) return

    if (typeof buffer === 'function') {
      callback = buffer
      buffer = null
    }

    if (!callback) callback = noop

    const self = this

    if (!header.size || header.type === 'symlink') header.size = 0
    if (!header.type) header.type = modeToType(header.mode)
    if (!header.mode) header.mode = header.type === 'directory' ? DMODE : FMODE
    if (!header.uid) header.uid = 0
    if (!header.gid) header.gid = 0
    if (!header.mtime) header.mtime = new Date()

    if (typeof buffer === 'string') buffer = b4a.from(buffer)
    if (b4a.isBuffer(buffer)) {
      header.size = buffer.byteLength
      this._encode(header)
      const ok = this.push(buffer)
      overflow(self, header.size)
      if (ok) process.nextTick(callback)
      else this._drain = callback
      return new Void()
    }

    if (header.type === 'symlink' && !header.linkname) {
      const linkSink = new LinkSink()
      linkSink
        .on('error', function (err) {
          self.destroy()
          callback(err)
        })
        .on('close', function () {
          header.linkname = linkSink.linkname
          self._encode(header)
          callback()
        })

      return linkSink
    }

    this._encode(header)

    if (header.type !== 'file' && header.type !== 'contiguous-file') {
      process.nextTick(callback)
      return new Void()
    }

    const sink = new Sink(this)
    sink
      .on('error', function (err) {
        self._stream = null
        self.destroy()
        callback(err)
      })
      .on('close', function () {
        self._stream = null

        if (sink.written !== header.size) { // corrupting tar
        }

        overflow(self, header.size)
        if (self._finalizing) { self.finalize() }
        callback()
      })

    this._stream = sink

    return sink
  }

  finalize () {
    if (this._stream) {
      this._finalizing = true
      return
    }

    if (this._finalized) return
    this._finalized = true
    this.push(END_OF_TAR)
    this.push(null)
  }

  _encode (header) {
    if (!header.pax) {
      const buf = headers.encode(header)
      if (buf) {
        this.push(buf)
        return
      }
    }
    this._encodePax(header)
  }

  _encodePax (header) {
    const paxHeader = headers.encodePax({
      name: header.name,
      linkname: header.linkname,
      pax: header.pax
    })

    const newHeader = {
      name: 'PaxHeader',
      mode: header.mode,
      uid: header.uid,
      gid: header.gid,
      size: paxHeader.byteLength,
      mtime: header.mtime,
      type: 'pax-header',
      linkname: header.linkname && 'PaxHeader',
      uname: header.uname,
      gname: header.gname,
      devmajor: header.devmajor,
      devminor: header.devminor
    }

    this.push(headers.encode(newHeader))
    this.push(paxHeader)
    overflow(this, paxHeader.byteLength)

    newHeader.size = header.size
    newHeader.type = header.type
    this.push(headers.encode(newHeader))
  }

  _read (cb) {
    const drain = this._drain
    this._drain = noop
    drain()
    cb()
  }
}

module.exports = function pack (opts) {
  return new Pack(opts)
}
