var ZEROS = '0000000000000000000';
var ZERO_OFFSET = '0'.charCodeAt(0);
var USTAR = 'ustar00';

var toType = function(flag) {
	switch (flag) {
		case 1:
		return 'link';
		case 3:
		return 'character';
		case 4:
		return 'block';
		case 5:
		return 'directory';
		case 6:
		return 'fifo';
	}
	return 'file';
};

var toTypeflag = function(flag) {
	switch (flag) {
		case 'link':
		return 1;
		case 'character':
		return 3;
		case 'block':
		return 4;
		case 'directory':
		return 5;
		case 'fifo':
		return 6;
	}

	return 0;
};

var alloc = function(size) {
	var buf = new Buffer(size);
	buf.fill(0);
	return buf;
};

var indexOf = function(block, num, offset) {
	for (; offset < block.length; offset++) {
		if (block[offset] === num) return offset;
	}
	return -1;
};

var cksum = function(block) {
	var sum = 8 * 32;
	for (var i = 0; i < 148; i++)   sum += block[i];
	for (var i = 156; i < 512; i++) sum += block[i];
	return sum;
};

var encodeOct = function(val, n) {
	val = val.toString(8);
	return ZEROS.slice(0, n-val.length)+val+' ';
};

var decodeOct = function(val, offset) {
	return parseInt(val.slice(offset, indexOf(val, 32, offset)).toString(), 8);
};

var decodeStr = function(val, offset) {
	return val.slice(offset, indexOf(val, 0, offset)).toString();
};

exports.encode = function(opts) {
	var buf = alloc(512);
	var name = opts.name;
	var prefix = '';

	if (opts.typeflag === 5 && name[name.length-1] !== '/') name += '/';

	while (Buffer.byteLength(name) > 100) {
		var i = name.indexOf('/');
		prefix += prefix ? '/' + name.slice(0, i) : name.slice(0, i);
		name = name.slice(i+1);
	}

	buf.write(name);
	buf.write(encodeOct(opts.mode, 6), 100);
	buf.write(encodeOct(opts.uid, 6), 108);
	buf.write(encodeOct(opts.gid, 6), 116);
	buf.write(encodeOct(opts.size, 11), 124);
	buf.write(encodeOct((opts.mtime.getTime() / 1000) | 0, 11), 136);

	buf[156] = ZERO_OFFSET + toTypeflag(opts.type);

	if (opts.linkname) buf.write(opts.linkname, 157);

	buf.write(USTAR, 257);
	if (opts.uname) buf.write(opts.uname, 265);
	if (opts.gname) buf.write(opts.gname, 297);
	buf.write(encodeOct(0, 6), 329);
	buf.write(encodeOct(0, 6), 337);

	if (prefix) buf.write(prefix, 345);

	buf.write(encodeOct(cksum(buf), 6), 148);

	return buf;
};

exports.decode = function(buf) {
	var name = decodeStr(buf, 0);
	var mode = decodeOct(buf, 100);
	var uid = decodeOct(buf, 108);
	var gid = decodeOct(buf, 116);
	var size = decodeOct(buf, 124);
	var mtime = decodeOct(buf, 136);
	var typeflag = buf[156] - ZERO_OFFSET;
	var linkname = buf[157] === 0 ? null : decodeStr(buf, 157);
	var uname = decodeStr(buf, 265);
	var gname = decodeStr(buf, 297);

	if (buf[345]) name = decodeStr(buf, 345)+'/'+name;

	if (cksum(buf) !== decodeOct(buf, 148)) return null;

	return {
		name: name,
		mode: mode,
		uid: uid,
		gid: gid,
		size: size,
		mtime: new Date(1000 * mtime),
		type: toType(typeflag),
		linkname: linkname,
		uname: uname,
		gname: gname
	};
};