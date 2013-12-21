var test = require('tap').test;
var tar = require('../index');
var fixtures = require('./fixtures');
var concat = require('concat-stream');
var fs = require('fs');

test('one-file', function(t) {
	t.plan(3);

	var extract = tar.extract();
	var noEntries = false;

	extract.on('entry', function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'test.txt',
			mode: 0644,
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
		});

		stream.pipe(concat(function(data) {
			noEntries = true;
			t.same(data.toString(), 'hello world\n');
			callback();
		}));
	});

	extract.on('finish', function() {
		t.ok(noEntries);
	});

	extract.end(fs.readFileSync(fixtures.ONE_FILE_TAR));
});

test('chunked-one-file', function(t) {
	t.plan(3);

	var extract = tar.extract();
	var noEntries = false;

	extract.on('entry', function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'test.txt',
			mode: 0644,
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
		});

		stream.pipe(concat(function(data) {
			noEntries = true;
			t.same(data.toString(), 'hello world\n');
			callback();
		}));
	});

	extract.on('finish', function() {
		t.ok(noEntries);
	});

	var b = fs.readFileSync(fixtures.ONE_FILE_TAR);

	for (var i = 0; i < b.length; i += 321) {
		extract.write(b.slice(i, i+321));
	}
	extract.end();
});


test('multi-file', function(t) {
	t.plan(5);

	var extract = tar.extract();
	var noEntries = false;

	var onfile1 = function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'file-1.txt',
			mode: 0644,
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
		});

		extract.on('entry', onfile2);
		stream.pipe(concat(function(data) {
			t.same(data.toString(), 'i am file-1\n');
			callback();
		}));
	};

	var onfile2 = function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'file-2.txt',
			mode: 0644,
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
		});

		stream.pipe(concat(function(data) {
			noEntries = true;
			t.same(data.toString(), 'i am file-2\n');
			callback();
		}));
	};

	extract.once('entry', onfile1);

	extract.on('finish', function() {
		t.ok(noEntries);
	});

	extract.end(fs.readFileSync(fixtures.MULTI_FILE_TAR));
});

test('chunked-multi-file', function(t) {
	t.plan(5);

	var extract = tar.extract();
	var noEntries = false;

	var onfile1 = function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'file-1.txt',
			mode: 0644,
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
		});

		extract.on('entry', onfile2);
		stream.pipe(concat(function(data) {
			t.same(data.toString(), 'i am file-1\n');
			callback();
		}));
	};

	var onfile2 = function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'file-2.txt',
			mode: 0644,
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
		});

		stream.pipe(concat(function(data) {
			noEntries = true;
			t.same(data.toString(), 'i am file-2\n');
			callback();
		}));
	};

	extract.once('entry', onfile1);

	extract.on('finish', function() {
		t.ok(noEntries);
	});

	var b = fs.readFileSync(fixtures.MULTI_FILE_TAR);
	for (var i = 0; i < b.length; i += 321) {
		extract.write(b.slice(i, i+321));
	}
	extract.end();
});

test('types', function(t) {
	t.plan(3);

	var extract = tar.extract();
	var noEntries = false;

	var ondir = function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'directory',
			mode: 0755,
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
		});
		stream.on('data', function() {
			t.ok(false);
		});
		extract.once('entry', onlink);
		callback();
	};

	var onlink = function(header, stream, callback) {
		t.deepEqual(header, {
			name: 'directory-link',
			mode: 0755,
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
		});
		stream.on('data', function() {
			t.ok(false);
		});
		noEntries = true;
		callback();
	};

	extract.once('entry', ondir);

	extract.on('finish', function() {
		t.ok(noEntries);
	});

	extract.end(fs.readFileSync(fixtures.TYPES_TAR));
});