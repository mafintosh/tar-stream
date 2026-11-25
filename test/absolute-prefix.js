const test = require('brittle')
const tar = require('..')

test('long absolute names retain their leading separator', async function (t) {
  const names = ['/' + 'a'.repeat(100), '/directory/' + 'b'.repeat(100), '//directory/' + 'c'.repeat(100)]
  const pack = tar.pack()
  const extract = tar.extract()

  for (const name of names) pack.entry({ name }, name)
  pack.finalize()
  pack.pipe(extract)

  const actual = []
  for await (const entry of extract) {
    actual.push(entry.header.name)
    let body = ''
    for await (const chunk of entry) body += chunk
    t.is(body, names[actual.length - 1])
  }
  t.alike(actual, names)
})

test('relative long names retain their separators', async function (t) {
  const name = 'directory//subdir/' + 'a'.repeat(100)
  const pack = tar.pack()
  const extract = tar.extract()
  pack.entry({ name }, 'body')
  pack.finalize()
  pack.pipe(extract)

  for await (const entry of extract) {
    t.is(entry.header.name, name)
    for await (const chunk of entry) t.is(chunk.toString(), 'body')
  }
})
