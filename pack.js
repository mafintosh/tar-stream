var stream = require('stream');
var util = require('util');
var eos = require('end-of-stream');
var headers = require('./headers');

var END_OF_TAR = new Buffer(1024);
END_OF_TAR.fill(0);

var noop = function() {};

var overflow = function(self, size) {
	size &= 511;
	if (size) self.push(END_OF_TAR.slice(0, 512 - size));
};

var Sink = function(to) {
	stream.Writable.call(this);
	this._to = to;
	this._destroyed = false;
};

util.inherits(Sink, stream.Writable);

Sink.prototype._write = function(data, enc, cb) {
	if (this._to.push(data)) return cb();
	this._to._drain = cb;
};

Sink.prototype.destroy = function() {
	if (this._destroyed) return;
	this._destroyed = true;
	this.emit('close');
};

var Pack = function(opts) {
	if (!(this instanceof Pack)) return new Pack(opts);
	stream.Readable.call(this, opts);

	this._drain = noop;
	this._finalized = false;
	this._shouldFinalize = false;
	this._destroyed = false;
	this._stream = null;
};

util.inherits(Pack, stream.Readable);

Pack.prototype.entry = function(header, buffer, callback) {
	if (typeof buffer === 'function') {
		callback = buffer;
		buffer = null;
	}

	if (!callback) callback = noop;
	if (this._stream) throw new Error('already piping an entry');

	var self = this;

	if (!header.size)  header.size = 0;
	if (!header.type)  header.type = 'file';
	if (!header.mode)  header.mode = header.type === 'directory' ? 0755 : 0644;
	if (!header.uid)   header.uid = 0;
	if (!header.gid)   header.gid = 0;
	if (!header.mtime) header.mtime = new Date();

	if (typeof buffer === 'string') buffer = new Buffer(buffer);
	if (Buffer.isBuffer(buffer)) {
		header.size = buffer.length;
		this.push(headers.encode(header));
		this.push(buffer);
		overflow(self, header.size);
		process.nextTick(callback);
		return;
	}

	this.push(headers.encode(header));
	this._stream = stream;

	var sink = new Sink(this);

	eos(sink, function(err) {
		self._stream = null;
		overflow(self, header.size);
		if (self._shouldFinalize) self.finalize();
		if (err) self.destroy();
		callback(err);
	});

	return sink;
};

Pack.prototype.finalize = function() {
	if (this._stream) {
		this._shouldFinalize = true;
		return;
	}

	if (this._finalized) return;
	this._finalized = true;
	this.push(END_OF_TAR);
	this.push(null);
};

Pack.prototype.destroy = function() {
	if (this._destroyed) return;
	this._destroyed = true;
	this.emit('close');
	if (this._stream && this._stream.destroy) this._stream.destroy();
};

Pack.prototype._read = function(n) {
	var drain = this._drain;
	this._drain = noop;
	drain();
};

module.exports = Pack;