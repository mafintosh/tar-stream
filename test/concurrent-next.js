const test = require('brittle')
const concat = require('concat-stream')
const fs = require('fs')
const tar = require('..')
const fixtures = require('./fixtures')

async function readEntry ({ value, done }) {
  if (done) return null
  const body = await new Promise(resolve => value.pipe(concat(resolve)))
  return { name: value.header.name, body: body.toString() }
}

async function settle (extract, promise) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('iterator reads did not settle')), 1000)
      })
    ])
  } finally {
    clearTimeout(timer)
    extract.destroy()
  }
}

test('concurrent next calls retain every entry and the end result', async function (t) {
  const extract = tar.extract()
  const iterator = extract[Symbol.asyncIterator]()
  const reads = [iterator.next(), iterator.next(), iterator.next()].map(read => read.then(readEntry))
  extract.end(fs.readFileSync(fixtures.MULTI_FILE_TAR))

  t.alike(await settle(extract, Promise.all(reads)), [
    { name: 'file-1.txt', body: 'i am file-1\n' },
    { name: 'file-2.txt', body: 'i am file-2\n' },
    null
  ])
})

test('concurrent next calls wait while the current entry is consumed', async function (t) {
  const extract = tar.extract()
  const iterator = extract[Symbol.asyncIterator]()
  extract.end(fs.readFileSync(fixtures.MULTI_FILE_TAR))
  const first = await iterator.next()
  const second = iterator.next().then(readEntry)
  const end = iterator.next().then(readEntry)

  t.alike(await settle(extract, Promise.all([readEntry(first), second, end])), [
    { name: 'file-1.txt', body: 'i am file-1\n' },
    { name: 'file-2.txt', body: 'i am file-2\n' },
    null
  ])
})

test('return settles every pending next call', async function (t) {
  const extract = tar.extract()
  const iterator = extract[Symbol.asyncIterator]()
  const reads = [iterator.next(), iterator.next(), iterator.next()]
  reads.push(iterator.return())

  t.alike(await settle(extract, Promise.all(reads)), Array.from({ length: 4 }, () => ({
    value: undefined, done: true
  })))
})

for (const cause of ['throw', 'destroy']) {
  test(cause + ' rejects every pending next call with the original error', async function (t) {
    const extract = tar.extract()
    const iterator = extract[Symbol.asyncIterator]()
    const failure = new Error('source failed')
    const reads = [iterator.next(), iterator.next(), iterator.next()]
    if (cause === 'throw') reads.push(iterator.throw(failure))
    else extract.destroy(failure)

    const results = await settle(extract, Promise.allSettled(reads))
    for (const result of results) {
      t.is(result.status, 'rejected')
      t.is(result.reason, failure)
    }
  })
}

test('invalid archive data rejects all queued iterator reads', async function (t) {
  const extract = tar.extract()
  const iterator = extract[Symbol.asyncIterator]()
  const reads = [iterator.next(), iterator.next(), iterator.next()]
  const results = Promise.allSettled(reads)
  extract.end(Buffer.alloc(512, 1))

  const settled = await settle(extract, results)
  for (const result of settled) {
    t.is(result.status, 'rejected')
    t.ok(/Invalid tar header/.test(result.reason.message))
    t.is(result.reason, settled[0].reason)
  }
})
