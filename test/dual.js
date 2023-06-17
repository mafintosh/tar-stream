const test = require('brittle')
const { Readable } = require('streamx')
const tar = require('../')

test('write and read huge archive', function (t) {
  t.plan(2)

  const pack = tar.pack()
  const extract = tar.extract()

  extract.on('entry', function (header, stream, next) {
    let size = 0

    stream.on('data', function (data) {
      size += data.byteLength
    })

    stream.on('end', function () {
      t.is(size, header.size)
      next()
    })
  })

  pack.pipe(extract, function (err) {
    t.ok(!err, 'pipeline finished')
  })

  const entry = pack.entry({
    name: 'huge.txt',
    size: 10 * 1024 * 1024 * 1024
  })

  const buf = Buffer.alloc(1024 * 1024)

  let pushed = 0

  const rs = new Readable({
    read (cb) {
      this.push(buf)
      pushed += buf.byteLength
      if (pushed === entry.header.size) this.push(null)
      cb(null)
    }
  })

  rs.pipe(entry)
  pack.finalize()
})
