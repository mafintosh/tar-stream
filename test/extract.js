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