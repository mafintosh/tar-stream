const bl = require('bl')
const { Writable, PassThrough } = require('streamx')
const headers = require('./headers')

const noop = function () {}

const overflow = function (size) {
  size &= 511
  return size && 512 - size
}

const emptyStream = function (self, offset) {
  const s = new Source(self, offset)
  s.end()
  return s
}

const mixinPax = function (header, pax) {
  if (pax.path) header.name = pax.path
  if (pax.linkpath) header.linkname = pax.linkpath
  if (pax.size) header.size = parseInt(pax.size, 10)
  header.pax = pax
  return header
}

class Source extends PassThrough {
  constructor (self, offset) {
    super()
    this._parent = self
    this.offset = offset
  }

  _predestroy () {
    this._parent.destroy()
  }
}

class Extract extends Writable {
  constructor (opts) {
    super(opts)

    opts = opts || {}

    this._offset = 0
    this._buffer = bl()
    this._missing = 0
    this._partial = false
    this._onparse = noop
    this._header = null
    this._stream = null
    this._overflow = null
    this._cb = null
    this._locked = false
    this._pax = null
    this._paxGlobal = null
    this._gnuLongPath = null
    this._gnuLongLinkPath = null

    const self = this
    const b = self._buffer

    const oncontinue = function () {
      self._continue()
    }

    const onunlock = function (err) {
      self._locked = false
      if (err) return self.destroy(err)
      if (!self._stream) oncontinue()
    }

    const onstreamend = function () {
      self._stream = null
      const drain = overflow(self._header.size)
      if (drain) self._parse(drain, ondrain)
      else self._parse(512, onheader)
      if (!self._locked) oncontinue()
    }

    const ondrain = function () {
      self._buffer.consume(overflow(self._header.size))
      self._parse(512, onheader)
      oncontinue()
    }

    const onpaxglobalheader = function () {
      const size = self._header.size
      self._paxGlobal = headers.decodePax(b.slice(0, size))
      b.consume(size)
      onstreamend()
    }

    const onpaxheader = function () {
      const size = self._header.size
      self._pax = headers.decodePax(b.slice(0, size))
      if (self._paxGlobal) self._pax = Object.assign({}, self._paxGlobal, self._pax)
      b.consume(size)
      onstreamend()
    }

    const ongnulongpath = function () {
      const size = self._header.size
      this._gnuLongPath = headers.decodeLongPath(b.slice(0, size), opts.filenameEncoding)
      b.consume(size)
      onstreamend()
    }

    const ongnulonglinkpath = function () {
      const size = self._header.size
      this._gnuLongLinkPath = headers.decodeLongPath(b.slice(0, size), opts.filenameEncoding)
      b.consume(size)
      onstreamend()
    }

    const onheader = function () {
      const offset = self._offset
      let header
      try {
        header = self._header = headers.decode(b.slice(0, 512), opts.filenameEncoding, opts.allowUnknownFormat)
      } catch (err) {
        self.destroy(err)
      }
      b.consume(512)

      if (!header) {
        self._parse(512, onheader)
        oncontinue()
        return
      }

      if (header.type === 'gnu-long-path') {
        self._parse(header.size, ongnulongpath)
        oncontinue()
        return
      }

      if (header.type === 'gnu-long-link-path') {
        self._parse(header.size, ongnulonglinkpath)
        oncontinue()
        return
      }

      if (header.type === 'pax-global-header') {
        self._parse(header.size, onpaxglobalheader)
        oncontinue()
        return
      }

      if (header.type === 'pax-header') {
        self._parse(header.size, onpaxheader)
        oncontinue()
        return
      }

      if (self._gnuLongPath) {
        header.name = self._gnuLongPath
        self._gnuLongPath = null
      }

      if (self._gnuLongLinkPath) {
        header.linkname = self._gnuLongLinkPath
        self._gnuLongLinkPath = null
      }

      if (self._pax) {
        self._header = header = mixinPax(header, self._pax)
        self._pax = null
      }

      self._locked = true

      if (!header.size || header.type === 'directory') {
        self._parse(512, onheader)
        self.emit('entry', header, emptyStream(self, offset), onunlock)
        return
      }

      self._stream = new Source(self, offset)

      self.emit('entry', header, self._stream, onunlock)
      self._parse(header.size, onstreamend)
      oncontinue()
    }

    this._onheader = onheader
    this._parse(512, onheader)
  }

  _parse (size, onparse) {
    this._offset += size
    this._missing = size
    if (onparse === this._onheader) this._partial = false
    this._onparse = onparse
  }

  _continue () {
    const cb = this._cb
    this._cb = noop
    if (this._overflow) this._write(this._overflow, cb)
    else cb()
  }

  _write (data, cb) {
    const s = this._stream
    const b = this._buffer
    const missing = this._missing
    if (data.byteLength) this._partial = true

    // we do not reach end-of-chunk now. just forward it
    if (data.byteLength < missing) {
      this._missing -= data.byteLength
      this._overflow = null
      if (s) {
        if (s.write(data, cb)) cb()
        else s.once('drain', cb)
        return
      }
      b.append(data)
      return cb()
    }

    // end-of-chunk. the parser should call cb.
    this._cb = cb
    this._missing = 0

    let overflow = null
    if (data.byteLength > missing) {
      overflow = data.subarray(missing)
      data = data.subarray(0, missing)
    }

    if (s) s.end(data)
    else b.append(data)

    this._overflow = overflow
    this._onparse()
  }

  _final (cb) {
    cb(this._partial ? new Error('Unexpected end of data') : null)
  }
}

module.exports = function extract (opts) {
  return new Extract(opts)
}
