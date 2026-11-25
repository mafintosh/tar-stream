const test = require('brittle')
const tar = require('..')

test('next after returning from an unfinished iterator is done', async function (t) {
  const extract = tar.extract()
  const iterator = extract[Symbol.asyncIterator]()

  t.alike(await iterator.return(), { value: undefined, done: true })
  t.alike(await settledNext(iterator), { value: undefined, done: true })
  t.alike(await settledNext(iterator), { value: undefined, done: true })
})

test('next after the extraction stream closes is done', async function (t) {
  const extract = tar.extract()
  const iterator = extract[Symbol.asyncIterator]()
  const closed = new Promise(resolve => extract.once('close', resolve))
  extract.destroy()
  await closed

  t.alike(await settledNext(iterator), { value: undefined, done: true })
})

test('an iterator created after close is done', async function (t) {
  const extract = tar.extract()
  const closed = new Promise(resolve => extract.once('close', resolve))
  extract.destroy()
  await closed

  t.alike(await settledNext(extract[Symbol.asyncIterator]()), { value: undefined, done: true })
})

test('an iterator created after failure preserves the stream error', async function (t) {
  const extract = tar.extract()
  const error = new Error('source failed')
  const closed = new Promise(resolve => extract.once('close', resolve))
  extract.on('error', () => {})
  extract.destroy(error)
  await closed

  const iterator = extract[Symbol.asyncIterator]()
  t.is(await settledNext(iterator).catch(err => err), error)
})

function settledNext (iterator) {
  return Promise.race([
    iterator.next(),
    new Promise(resolve => setImmediate(() => resolve('still pending')))
  ])
}
