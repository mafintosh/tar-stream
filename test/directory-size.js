const test = require('brittle')
const concat = require('concat-stream')
const fs = require('fs')
const path = require('path')
const tar = require('..')

// Python tarfile.TarInfo.tobuf(USTAR_FORMAT): a directory with stat size 4096
// and no body, then after.txt containing "after". Python tarfile and libarchive
// both read the following file without treating the directory size as data.
const archive = fs.readFileSync(path.join(__dirname, 'fixtures/directory-stat-size.tar'))

function readBody (stream) {
  return new Promise(resolve => stream.pipe(concat(resolve)))
}

async function settle (extract, entries, promise) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('directory entry did not end')), 1000)
      })
    ])
  } finally {
    clearTimeout(timer)
    extract.destroy()
    for (const entry of entries) entry.destroy()
  }
}

function writeArchive (extract, chunked) {
  if (chunked) {
    for (let i = 0; i < archive.length; i += 137) extract.write(archive.subarray(i, i + 137))
    extract.end()
  } else {
    extract.end(archive)
  }
}

const expected = [
  { name: 'folder/', type: 'directory', size: 4096, body: '' },
  { name: 'after.txt', type: 'file', size: 5, body: 'after' }
]

for (const chunked of [false, true]) {
  test('directory stat size with entry callbacks, chunked=' + chunked, async function (t) {
    const extract = tar.extract()
    const entries = []
    const actual = []
    const complete = new Promise((resolve, reject) => {
      extract.on('error', reject)
      extract.on('finish', resolve)
      extract.on('entry', (header, stream, next) => {
        entries.push(stream)
        readBody(stream).then(body => {
          actual.push({ name: header.name, type: header.type, size: header.size, body: body.toString() })
          next()
        })
      })
    })

    writeArchive(extract, chunked)
    await settle(extract, entries, complete)
    t.alike(actual, expected)
  })

  test('directory stat size with an async iterator, chunked=' + chunked, async function (t) {
    const extract = tar.extract()
    const entries = []
    const complete = (async () => {
      const actual = []
      for await (const stream of extract) {
        entries.push(stream)
        const { header } = stream
        const body = await readBody(stream)
        actual.push({ name: header.name, type: header.type, size: header.size, body: body.toString() })
      }
      return actual
    })()

    writeArchive(extract, chunked)
    t.alike(await settle(extract, entries, complete), expected)
  })
}
