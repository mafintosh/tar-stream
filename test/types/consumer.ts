import { Readable } from 'node:stream'
import { extract, pack } from 'tar-stream'

declare function acceptsNodeReadable(stream: NodeJS.ReadableStream): void

const archive = pack()
archive.entry({ name: 'hello.txt' }, 'hello')
archive.finalize()
acceptsNodeReadable(Readable.from(archive, { objectMode: false }))

// streamx does not implement Node's isPaused, unpipe and wrap methods.
// @ts-expect-error A native Node consumer needs the adapter above.
acceptsNodeReadable(archive)

extract().on('entry', (header, stream, next) => {
  const name: string = header.name
  stream.on('data', chunk => {
    const value: Uint8Array | string = chunk
    value.toString()
    if (typeof chunk !== 'string') Buffer.from(chunk)
  })
  stream.on('end', next)
  stream.on('error', (err: Error) => next(err))
  acceptsNodeReadable(Readable.from(stream, { objectMode: false }))

  const chunk: Uint8Array | string | null = stream.read()
  stream.setEncoding('utf8').on('data', value => {
    if (typeof value === 'string') value.toUpperCase()
  })
  void name
  void chunk
})

async function consumeEntries (): Promise<void> {
  for await (const entry of extract()) {
    const name: string = entry.header.name
    for await (const chunk of entry) {
      const value: Uint8Array | string = chunk
      value.toString()
    }
    void name
  }
}
void consumeEntries

// Pack's mapping callbacks can produce arbitrary data; keep that boundary unknown.
pack({ map: () => 1 }).on('data', chunk => {
  // @ts-expect-error A mapping callback does not promise byte output.
  const bytes: Uint8Array = chunk
  void bytes
})
