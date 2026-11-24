import {
  Readable,
  Writable,
  type ReadableEvents,
  type ReadableOptions,
  type WritableEvents,
  type WritableOptions
} from 'streamx'

interface Header {
  name: string
  size: number
  mode: number
  mtime: Date
  type:
    | 'file'
    | 'link'
    | 'symlink'
    | 'directory'
    | 'block-device'
    | 'character-device'
    | 'fifo'
    | 'contiguous-file'
  linkname: string
  uid: number
  gid: number
  uname: string
  gname: string
  devmajor: number
  devminor: number
  pax?: unknown | null
}

type HeaderArgument = Partial<Header> & Pick<Header, 'name'>

interface Sink extends Writable {}

interface Pack extends Readable {
  entry(header: HeaderArgument, callback?: (err?: Error | null) => void): Sink
  entry(header: HeaderArgument, buffer: string | Uint8Array, callback?: (err?: Error | null) => void): Sink

  finalize(): void
}

declare function pack(opts?: ReadableOptions): Pack

interface SourceEvents extends ReadableEvents {
  data: [data: Uint8Array | string]
}

interface Source extends Readable<SourceEvents> {
  header: Header
  offset: number

  read(): Uint8Array | string | null
  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array | string>
}

interface ExtractEvents extends WritableEvents {
  entry: [header: Header, stream: Source, next: (err?: Error | null) => void]
}

interface Extract<M extends ExtractEvents = ExtractEvents>
  extends Writable<M>, AsyncIterable<Source> {}

declare function extract(opts?: WritableOptions): Extract

export { pack, type Header, type Pack, extract, type Extract, type ExtractEvents }
