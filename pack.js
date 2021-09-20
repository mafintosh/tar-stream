var constants = require('fs-constants')
var eos = require('end-of-stream')
var alloc = Buffer.alloc

var Readable = require('readable-stream').Readable
var Writable = require('readable-stream').Writable
var StringDecoder = require('string_decoder').StringDecoder

var headers = require('./headers')

var DMODE = parseInt('755', 8)
var FMODE = parseInt('644', 8)

var END_OF_TAR = alloc(1024)

var noop = function () {}

var overflow = function (self, size) {
  size &= 511
  if (size) self.push(END_OF_TAR.slice(0, 512 - size))
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
    this._destroyed = false
  }

  _write (data, enc, cb) {
    this.written += data.length
    if (this._to.push(data)) { return cb() }
    this._to._drain = cb
  }

  destroy () {
    if (this._destroyed) { return }
    this._destroyed = true
    this.emit('close')
  }
}

class LinkSink extends Writable {
  constructor () {
    super()

    this.linkname = ''
    this._decoder = new StringDecoder('utf-8')
    this._destroyed = false
  }
  _write (data, enc, cb) {
    this.linkname += this._decoder.write(data)
    cb()
  }
  destroy () {
    if (this._destroyed) { return }
    this._destroyed = true
    this.emit('close')
  }
}

class Void extends Writable {
  constructor () {
    super()
    this._destroyed = false
  }

  _write (data, enc, cb) {
    cb(new Error('No body allowed for this entry'))
  }

  destroy () {
    if (this._destroyed) { return }
    this._destroyed = true
    this.emit('close')
  }
}

class Pack extends Readable {
  constructor (opts) {
    super(opts)

    this._drain = noop
    this._finalized = false
    this._finalizing = false
    this._destroyed = false
    this._stream = null
  }

  entry (header, buffer, callback) {
    if (this._stream) { throw new Error('already piping an entry') }
    if (this._finalized || this._destroyed) { return }

    if (typeof buffer === 'function') {
      callback = buffer
      buffer = null
    }

    if (!callback) { callback = noop }

    var self = this

    if (!header.size || header.type === 'symlink') { header.size = 0 }
    if (!header.type) { header.type = modeToType(header.mode) }
    if (!header.mode) { header.mode = header.type === 'directory' ? DMODE : FMODE }
    if (!header.uid) { header.uid = 0 }
    if (!header.gid) { header.gid = 0 }
    if (!header.mtime) { header.mtime = new Date() }

    if (typeof buffer === 'string') { buffer = Buffer.from(buffer) }
    if (Buffer.isBuffer(buffer)) {
      header.size = buffer.length
      this._encode(header)
      var ok = this.push(buffer)
      overflow(self, header.size)
      if (ok) { process.nextTick(callback) } else { this._drain = callback }
      return new Void()
    }

    if (header.type === 'symlink' && !header.linkname) {
      var linkSink = new LinkSink()
      eos(linkSink, function (err) {
        if (err) { // stream was closed
          self.destroy()
          return callback(err)
        }

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

    var sink = new Sink(this)

    this._stream = sink

    eos(sink, function (err) {
      self._stream = null

      if (err) { // stream was closed
        self.destroy()
        return callback(err)
      }

      if (sink.written !== header.size) { // corrupting tar
        self.destroy()
        return callback(new Error('size mismatch'))
      }

      overflow(self, header.size)
      if (self._finalizing) { self.finalize() }
      callback()
    })

    return sink
  }

  finalize () {
    if (this._stream) {
      this._finalizing = true
      return
    }

    if (this._finalized) { return }
    this._finalized = true
    this.push(END_OF_TAR)
    this.push(null)
  }

  destroy (err) {
    if (this._destroyed) { return }
    this._destroyed = true

    if (err) { this.emit('error', err) }
    this.emit('close')
    if (this._stream && this._stream.destroy) { this._stream.destroy() }
  }

  _encode (header) {
    if (!header.pax) {
      var buf = headers.encode(header)
      if (buf) {
        this.push(buf)
        return
      }
    }
    this._encodePax(header)
  }

  _encodePax (header) {
    var paxHeader = headers.encodePax({
      name: header.name,
      linkname: header.linkname,
      pax: header.pax
    })

    var newHeader = {
      name: 'PaxHeader',
      mode: header.mode,
      uid: header.uid,
      gid: header.gid,
      size: paxHeader.length,
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
    overflow(this, paxHeader.length)

    newHeader.size = header.size
    newHeader.type = header.type
    this.push(headers.encode(newHeader))
  }

  _read (n) {
    var drain = this._drain
    this._drain = noop
    drain()
  }
}

module.exports = Pack
