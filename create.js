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
};

util.inherits(Sink, stream.Writable);

Sink.prototype._write = function(data, enc, cb) {
	if (this._to.push(data)) return cb();
	this._to._drain = cb;
};

var Create = function(opts) {
	if (!(this instanceof Create)) return new Create(opts);
	stream.Readable.call(this, opts);

	this._sink = new Sink(this);
	this._drain = noop;
	this._finalized = false;
	this._shouldFinalize = false;
	this._destroyed = false;
	this._stream = null;
};

util.inherits(Create, stream.Readable);

Create.prototype.entry = function(header, stream, callback) {
	if (!callback) callback = noop;
	var self = this;

	if (!header.size)  header.size = 0;
	if (!header.type)  header.type = 'file';
	if (!header.mode)  header.mode = header.type === 'file' ? 420 : 493;
	if (!header.uid)   header.uid = 0;
	if (!header.gid)   header.gid = 0;
	if (!header.mtime) header.mtime = new Date();

	if (typeof stream === 'string') stream = new Buffer(stream);
	if (Buffer.isBuffer(stream)) {
		header.size = stream.length;
		this.push(headers.encode(header));
		this.push(stream);
		overflow(self, header.size);
		process.nextTick(callback);
		return;
	}

	if (this._stream) throw new Error('already piping an entry');

	this.push(headers.encode(header));
	this._stream = stream;

	stream.pipe(this._sink, {end:false});
	eos(stream, function(err) {
		self._stream = null;
		overflow(self, header.size);
		if (self._shouldFinalize) self.finalize();
		callback(err);
	});
};

Create.prototype.finalize = function() {
	if (this._stream) {
		this._shouldFinalize = true;
		return;
	}

	if (this._finalized) return;
	this._finalized = true;
	this.push(END_OF_TAR);
	this.push(null);
};

Create.prototype.destroy = function() {
	if (this._destroyed) return;
	this._destroyed = true;
	this.emit('close');
	if (this._stream && this._stream.destroy) this._stream.destroy();
};

Create.prototype._read = function(n) {
	var drain = this._drain;
	this._drain = noop;
	drain();
};

module.exports = Create;