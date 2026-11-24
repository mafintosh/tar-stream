const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { dirname, join, resolve } = require('node:path')

const root = resolve(__dirname, '../..')
const metadata = require('../../package.json')
const range = metadata.dependencies.streamx
const minimum = /^\^(\d+\.\d+\.\d+)$/.exec(range)
assert.ok(minimum, 'Update the type-test version selection for this streamx range')
assert.ok(process.env.npm_execpath, 'Run this check with npm run test:types')
const temporary = mkdtempSync(join(tmpdir(), 'tar-stream-types-'))

function npm (args, cwd, capture = false) {
  return execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit'
  })
}

try {
  const packed = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], root, true))[0]
  for (const [label, version] of [['minimum', minimum[1]], ['latest', range]]) {
    const consumer = join(temporary, label)
    mkdirSync(consumer)
    writeFileSync(join(consumer, 'package.json'), JSON.stringify({
      private: true,
      dependencies: {
        'tar-stream': 'file:' + join(temporary, packed.filename),
        streamx: version
      },
      overrides: { streamx: version },
      devDependencies: {
        typescript: metadata.devDependencies.typescript,
        '@types/node': metadata.devDependencies['@types/node']
      }
    }))
    writeFileSync(join(consumer, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        skipLibCheck: false,
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        types: ['node']
      },
      include: ['*.cts', '*.mts']
    }))
    copyFileSync(join(__dirname, 'consumer.ts'), join(consumer, 'consumer.cts'))
    copyFileSync(join(__dirname, 'consumer.ts'), join(consumer, 'consumer.mts'))
    copyFileSync(join(__dirname, 'runtime.cjs'), join(consumer, 'runtime.cjs'))
    npm(['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], consumer)
    const entry = require.resolve('streamx', { paths: [join(consumer, 'node_modules/tar-stream')] })
    const actual = JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8')).version
    if (label === 'minimum') assert.equal(actual, minimum[1])
    console.log('Checking packed tar-stream with ' + label + ' streamx ' + actual)
    execFileSync(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '-p', consumer], { stdio: 'inherit' })
    execFileSync(process.execPath, ['--test', join(consumer, 'runtime.cjs')], { stdio: 'inherit' })
  }
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
