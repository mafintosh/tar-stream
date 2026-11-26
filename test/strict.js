const test = require('brittle')
const b4a = require('b4a')
const concat = require('concat-stream')
const tar = require('..')

test('strict framing', function (t) {
  t.plan(8)

  const pack = tar.pack()

  pack.entry({ name: 'file.txt' }, 'hello')
  pack.finalize()
  pack.pipe(concat(function (data) {
    const padding = b4a.from(data)
    padding[512 + 5] = 1
    const end = b4a.from(data)
    end[1024 + 148] = 0x31 // still decodes as a null header

    run(data, { strict: true }, null)
    run(data.subarray(0, 1024), { strict: false }, null)
    run(data.subarray(0, 1024), { strict: true }, /Unexpected end of data/)
    run(data.subarray(0, 1536), { strict: true }, /Unexpected end of data/)
    run(b4a.concat([data, data]), { strict: false }, null)
    run(b4a.concat([data, data]), { strict: true }, /after end of archive/)
    run(padding, { strict: true }, /padding/)
    run(end, { strict: true }, /end of archive/)
  }))

  function run (data, opts, error) {
    const extract = tar.extract(opts)

    extract.on('entry', function (header, stream, cb) {
      stream.resume()
      cb()
    })

    extract.on('finish', function () {
      t.is(error, null)
    })

    extract.on('error', function (err) {
      t.ok(error && error.test(err.message), err.message)
    })

    extract.end(data)
  }
})
