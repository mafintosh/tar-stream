# tar-stream

tar-stream is an alternative tar parser. It is streams2, does not have a fstream dependency and does not do any file io.

	npm install tar-stream

# Usage

tar-stream exposes two streams, `pack` and `extract`. `pack` will create a tarball and `extract` will extract it.

## Packing

To create a pack stream use `tar.pack()` and call `pack.entry(header, [callback])` to add tar entries.

``` js
var tar = require('tar-stream');
var p = tar.pack(); // p is a streams2 stream

// add a file called my-test.txt with the content "Hello World!"
p.entry({ name: 'my-test.txt' }, 'Hello World!');

// add a file called my-stream-test.txt from a stream
myStream.pipe(p.entry({ name: 'my-stream-test.txt' }, function(err) {
	// the stream was added
}));

// no more entries
p.finalize();

// pipe the pack stream somewhere
p.pipe(process.stdout);
```

## Extracting

To extract a stream use `tar.extract()` and listen for `extract.on('entry', header, stream, callback)`

``` js
var e = tar.extract();

e.on('entry', function(header, stream, callback) {
	// header is the tar header
	// stream is the content body (might be an empty stream)
	// call callback when you are done with this entry

	stream.resume(); // just auto drain the stream
	stream.on('end', function() {
		callback(); // ready for next entry
	});
});

e.on('finish', function() {
	// all entries read
});

packStream.pipe(e);
```

## Headers

The header object using in `entry` should contain the following properties.
Most of these values can be found by stating a file.

``` js
{
	name: 'path/to/this/entry.txt',
	size: 1314,        // entry size. defaults to 0
	mode: 0644,        // entry mode. defaults to to 0755 for dirs and 0644 otherwise
	mtime: new Date(), // last modified date for entry
	type: 'file',      // type of entry. can be file|directory|link|block|character|fifo
	linkname: 'path',  //
	uid: 0,            // uid of entry owner. defaults to 0
	gid: 0,            // gid of entry owner. defaults to 0
	uname: 'maf',      // uname of entry owner. defaults to null
	gname: 'wheel',    // gname of entry owner. defaults to null
}
```

# License

MIT