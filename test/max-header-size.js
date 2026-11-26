const test = require('brittle')
const concat = require('concat-stream')
const tar = require('..')

test('pax header larger than maxHeaderSize is rejected', function (t) {
  t.plan(2)

  const pack = tar.pack()

  pack.entry({ name: 'file.txt', pax: { comment: 'x'.repeat(2048) } }, 'hello')
  pack.finalize()
  pack.pipe(concat(function (data) {
    const extract = tar.extract({ maxHeaderSize: 1024 })

    extract.on('entry', function () {
      t.fail('should not emit an entry')
    })

    extract.on('error', function (err) {
      t.ok(/max size/.test(err.message))
    })

    extract.end(data)

    const accept = tar.extract({ maxHeaderSize: 4096 })

    accept.on('entry', function (header, stream, cb) {
      t.is(header.pax.comment.length, 2048)
      stream.resume()
      cb()
    })

    accept.end(data)
  }))
})
