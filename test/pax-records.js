const test = require('brittle')
const concat = require('concat-stream')
const tar = require('..')

test('malformed pax records are rejected', function (t) {
  t.plan(3)

  run('17 comment=hello\n', '17 comment=hellox') // no newline
  run('17 comment=hello\n', '17 comment_hello\n') // no separator
  run('17 comment=hello\n', '99 comment=hello\n') // length past the end

  function run (record, malformed) {
    const pack = tar.pack()

    pack.entry({ name: 'file.txt', pax: { comment: 'hello' } }, 'hello')
    pack.finalize()
    pack.pipe(concat(function (data) {
      data.write(malformed, data.indexOf(record))

      const extract = tar.extract()

      extract.on('entry', function () {
        t.fail('should not emit an entry')
      })

      extract.on('error', function (err) {
        t.ok(/malformed pax record/.test(err.message))
      })

      extract.end(data)
    }))
  }
})
