const { Writable, PassThrough, getStreamError } = require('streamx')
const FIFO = require('fast-fifo')
const b4a = require('b4a')
const headers = require('./headers')

const EMPTY = b4a.alloc(0)

class BufferList {
  constructor () {
    this.buffered = 0
    this.shifted = 0
    this.queue = new FIFO()
  }

  push (buffer) {
    this.buffered += buffer.byteLength
    this.queue.push(buffer)
  }

  shift (size) {
    if (size > this.buffered) return null
    if (size === 0) return EMPTY

    let chunk = this._next(size)

    if (size === chunk.byteLength) return chunk // likely case

    const chunks = [chunk]

    while ((size -= chunk.byteLength) > 0) {
      chunk = this._next(size)
      chunks.push(chunk)
    }

    return b4a.concat(chunks)
  }

  _next (size) {
    const buf = this.queue.peek()
    const rem = buf.byteLength - this.shifted

    if (size >= rem) {
      const sub = this.shifted ? buf.subarray(this.shifted, buf.byteLength) : buf
      this.queue.shift()
      this.shifted = 0
      this.buffered -= rem
      return sub
    }

    this.buffered -= size
    return buf.subarray(this.shifted, (this.shifted += size))
  }
}

class Source extends PassThrough {
  constructor (self, offset) {
    super()
    this._parent = self
    this._continue = null
    this.offset = offset
    this.on('drain', this._ondrain)
  }

  _ondrain () {
    if (this._continue === null) return
    const cb = this._continue
    this._continue = null
    cb(null)
  }

  _forward (data, cb) {
    if (this.write(data, cb) === true) cb(null)
    this._continue = cb
  }

  _predestroy () {
    this._parent.destroy(getStreamError(this))
  }
}

class Extract extends Writable {
  constructor (opts) {
    super(opts)

    if (!opts) opts = {}

    this._offset = 0
    this._buffer = new BufferList()
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
      self._buffer.shift(overflow(self._header.size))
      self._parse(512, onheader)
      oncontinue()
    }

    const onpaxglobalheader = function () {
      const size = self._header.size
      self._paxGlobal = headers.decodePax(b.shift(size))
      onstreamend()
    }

    const onpaxheader = function () {
      const size = self._header.size
      self._pax = headers.decodePax(b.shift(size))
      if (self._paxGlobal) self._pax = Object.assign({}, self._paxGlobal, self._pax)
      onstreamend()
    }

    const ongnulongpath = function () {
      const size = self._header.size
      this._gnuLongPath = headers.decodeLongPath(b.shift(size), opts.filenameEncoding)
      onstreamend()
    }

    const ongnulonglinkpath = function () {
      const size = self._header.size
      this._gnuLongLinkPath = headers.decodeLongPath(b.shift(size), opts.filenameEncoding)
      onstreamend()
    }

    const onheader = function () {
      const offset = self._offset
      let header
      try {
        header = self._header = headers.decode(b.shift(512), opts.filenameEncoding, opts.allowUnknownFormat)
      } catch (err) {
        self.destroy(err)
      }

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
        s._forward(data, cb)
        return
      }
      b.push(data)
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

    if (s) s.end(data.byteLength === 0 ? null : data)
    else b.push(data)

    this._overflow = overflow
    this._onparse()
  }

  _final (cb) {
    cb(this._partial ? new Error('Unexpected end of data') : null)
  }

  _destroy (cb) {
    if (this._stream) this._stream.destroy(getStreamError(this))
    cb(null)
  }
}

module.exports = function extract (opts) {
  return new Extract(opts)
}

function noop () {}

function overflow (size) {
  size &= 511
  return size && 512 - size
}

function emptyStream (self, offset) {
  const s = new Source(self, offset)
  s.end()
  return s
}

function mixinPax (header, pax) {
  if (pax.path) header.name = pax.path
  if (pax.linkpath) header.linkname = pax.linkpath
  if (pax.size) header.size = parseInt(pax.size, 10)
  header.pax = pax
  return header
}
