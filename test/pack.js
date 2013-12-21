var test = require('tap').test;
var tar = require('../index');
var fixtures = require('./fixtures');
var concat = require('concat-stream');
var fs = require('fs');

test('one-file', function(t) {
	t.plan(1);

	var pack = tar.pack();

	pack.entry({
		name:'test.txt',
		mtime:new Date(1387580181000),
		mode:0644,
		uname:'maf',
		gname:'staff',
		uid:501,
		gid:20
	}, 'hello world\n');

	pack.finalize();

	pack.pipe(concat(function(data) {
		t.deepEqual(data, fs.readFileSync(fixtures.ONE_FILE_TAR));
	}));
});