declare namespace tarstream {
  interface Header {
    name: string
    size: number
    mode: number
    mtime: Date
    type: 'file' | 'link' | 'symlink' | 'directory' | 'block-device' | 'character-device' | 'fifo' | 'contiguous-file'
    linkname: string
    uid: number
    gid: number
    uname: string
    gname: string
    devmajor: number
    devminor: number
    pax?: object
  }

  type HeaderForPack = Partial<Header> & {
    name: string
  }

  interface Pack extends NodeJS.ReadableStream {
    entry(header: HeaderForPack, callback?: (error?: Error) => void): Sink
    entry(
      header: HeaderForPack,
      buffer: string | Buffer,
      callback?: (error?: Error) => void
    ): Sink
    destroy(): void
    finalize(): void
  }

  interface Sink extends NodeJS.WritableStream {
    destroy(): void
  }

  interface ExtractOptions {
    filenameEncoding?: string
  }

  interface Extract extends NodeJS.WritableStream {
    on(
      event: 'entry',
      callback: (
        header: Header,
        stream: NodeJS.ReadableStream,
        next: () => void
      ) => void
    ): void
    on(event: 'close', callback: () => void)
    on(event: 'finish', callback: () => void)
    on(event: 'error', callback: (error: Error) => void)
    destroy(error?: Error): void
  }

  interface Module {
    pack(): Pack
    extract(options?: ExtractOptions): Extract
  }

  export function pack(): Pack
  export function extract(options?: ExtractOptions): Extract
}
