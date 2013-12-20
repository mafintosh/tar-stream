# tar-stream

tar-stream is a streaming tar parser and generator and nothing else. It is streams2 and operates purely using streams which means you can easily extract/parse tarballs without ever hitting the file system.

	npm install tar-stream

# Usage

tar-stream exposes two streams, [pack](https://github.com/mafintosh/tar-stream#packing) which creates tarballs and [extract](https://github.com/mafintosh/tar-stream#extracting) which extracts tarballs. To [modify](https://github.com/mafintosh/tar-stream#modifying-existing-tarballs an existing tarball) use both.

## Packing

To create a pack stream use `tar.pack()` and call `pack.entry(header, [callback])` to add tar entries.

``` js
var tar = require('tar-stream');
var pack = tar.pack(); // p is a streams2 stream

// add a file called my-test.txt with the content "Hello World!"
pack.entry({ name: 'my-test.txt' }, 'Hello World!');

// add a file called my-stream-test.txt from a stream
myStream.pipe(pack.entry({ name: 'my-stream-test.txt' }, function(err) {
	// the stream was added
}));

// no more entries
pack.finalize();

// pipe the pack stream somewhere
pack.pipe(process.stdout);
```

## Extracting

To extract a stream use `tar.extract()` and listen for `extract.on('entry', header, stream, callback)`

``` js
var extract = tar.extract();

extract.on('entry', function(header, stream, callback) {
	// header is the tar header
	// stream is the content body (might be an empty stream)
	// call callback when you are done with this entry

	stream.resume(); // just auto drain the stream
	stream.on('end', function() {
		callback(); // ready for next entry
	});
});

extract.on('finish', function() {
	// all entries read
});

pack.pipe(extract);
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

## Modifying existing tarballs

Using tar-stream it is easy to rewrite paths / change modes etc in an existing tarball.

``` js
var extract = tar.extract();
var pack = tar.pack();
var path = require('path');

extract.on('entry', function(header, stream, callback) {
	// let's prefix all names with 'tmp'
	header.name = path.join('tmp', header.name);
	// write the new entry to the pack stream
	stream.pipe(pack.entry(header, callback));
});

extract.on('finish', function() {
	// all entries done - lets finalize it
	pack.finalize();
});

// pipe the old tarball to the extractor
oldTarball.pipe(extract);

// pipe the new tarball the another stream
pack.pipe(newTarball);
```

# License

MIT
