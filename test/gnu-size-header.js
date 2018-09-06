var test = require('tape')
var headers = require('../headers')

var mtime = new Date(0)

test('it should not use gnu extension for size when is safe to encode in oct', function (t) {
  t.plan(3)

  var header = headers.encode({
    uid: 0,
    gid: 0,
    mtime: mtime,
    name: 'do not care',
    size: parseInt('12345671234', 8),
    allowGnuExtension: true
  })

  t.strictEqual(header.readUInt32BE(124 + 0), 0x31323334, '[ :4] should be 1234')
  t.strictEqual(header.readUInt32BE(124 + 4), 0x35363731, '[4:8] should be 5671')
  t.strictEqual(header.readUInt32BE(124 + 8), 0x32333420, '[8: ] should be 234 ')
})

test('it should not try to use gnu extension when allowGnuExtension is not specified', function (t) {
  t.plan(3)

  var header = headers.encode({
    uid: 0,
    gid: 0,
    mtime: mtime,
    name: 'do not care',
    size: 0x1FED01020304
  })

  t.strictEqual(header.readUInt32BE(124 + 0), 0x37373737, '[ :4] should be 7777')
  t.strictEqual(header.readUInt32BE(124 + 4), 0x37373737, '[4:8] should be 7777')
  t.strictEqual(header.readUInt32BE(124 + 8), 0x37373720, '[8: ] should be 777 ')
})

test('it should use gnu extension when allowGnuExtension is set to true for size 0x1FED01020304', function (t) {
  t.plan(3)

  var header = headers.encode({
    uid: 0,
    gid: 0,
    mtime: mtime,
    name: 'do not care',
    size: 0x1FED01020304,
    allowGnuExtension: true
  })

  t.strictEqual(header.readUInt32BE(124 + 0), 0x80000000, 'gnu extension flag set correctly')
  t.strictEqual(header.readUInt32BE(124 + 4), 0x00001FED, 'high 32 bit set correctly')
  t.strictEqual(header.readUInt32BE(124 + 8), 0x01020304, 'low  32 bit set correctly')
})

test('it should fall back to "77777777777 " when allowGnuExtension is false', function (t) {
  t.plan(3)

  var header = headers.encode({
    uid: 0,
    gid: 0,
    mtime: mtime,
    name: 'do not care',
    size: 0x1FED01020304,
    allowGnuExtension: false
  })

  t.strictEqual(header.readUInt32BE(124 + 0), 0x37373737, '[ :4] should be 7777')
  t.strictEqual(header.readUInt32BE(124 + 4), 0x37373737, '[4:8] should be 7777')
  t.strictEqual(header.readUInt32BE(124 + 8), 0x37373720, '[8: ] should be 777 ')
})

test('it should decode gnu extension size correctly (low.i32 is positive)', function (t) {
  t.plan(4)

  var header = headers.encode({
    uid: 0,
    gid: 0,
    mtime: mtime,
    name: 'do not care',
    size: 0x1FED01020304,
    allowGnuExtension: true
  })

  // Ensure we have the correct binary data first
  t.strictEqual(header.readUInt32BE(124 + 0), 0x80000000, 'gnu extension flag set correctly')
  t.strictEqual(header.readUInt32BE(124 + 4), 0x00001FED, 'high 32 bit set correctly')
  t.strictEqual(header.readUInt32BE(124 + 8), 0x01020304, 'low  32 bit set correctly')

  var decode = headers.decode(header)
  t.strictEqual(decode.size, 0x1FED01020304, 'size should equal 0x1FED01020304')
})

test('it should decode gnu extension size correctly (low.i32 is negative)', function (t) {
  t.plan(4)

  var header = headers.encode({
    uid: 0,
    gid: 0,
    mtime: mtime,
    name: 'do not care',
    size: 0x1FED81020304,
    allowGnuExtension: true
  })

  // Ensure we have the correct binary data first
  t.strictEqual(header.readUInt32BE(124 + 0), 0x80000000, 'gnu extension flag set correctly')
  t.strictEqual(header.readUInt32BE(124 + 4), 0x00001FED, 'high 32 bit set correctly')
  t.strictEqual(header.readUInt32BE(124 + 8), 0x81020304, 'low  32 bit set correctly')

  var decode = headers.decode(header)
  t.strictEqual(decode.size, 0x1FED81020304, 'size should equal 0x1FED81020304')
})

test('it should throw error if gnu extension size is too high (> Number.MAX_SAFE_INTEGER)', function (t) {
  t.plan(1)

  var header = headers.encode({
    uid: 0,
    gid: 0,
    mtime: mtime,
    name: 'do not care',
    size: 0,
    allowGnuExtension: true
  })

  // Set an unsafe value
  header.writeUInt32BE(0x80000000, 124 + 0)
  header.writeUInt32BE(0x7FFFFFFF, 124 + 4)
  header.writeUInt32BE(0xFFFFFFFF, 124 + 8)

  t.throws(function () {
    headers.decode(header)
  }, new Error('unsafe gnu extension size'), 'should throw error for unsafe gnu extension size')
})
