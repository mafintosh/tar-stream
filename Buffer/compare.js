var major = +process.versions.node.split('.')[0]

function compareOffset (source, target, targetStart, sourceStart, targetEnd,
  sourceEnd) {
  var sourceLength = sourceEnd - sourceStart
  var targetLength = targetEnd - targetStart
  var length = Math.min(sourceLength, targetLength)
  var sourceValue
  var targetValue

  for (var index = 0; index < length; index++) {
    sourceValue = source[sourceStart + index]
    targetValue = target[targetStart + index]
    if (sourceValue > targetValue) return 1
    else if (sourceValue < targetValue) return -1
  }
  return 0
}

function bufferComparePolyfill (source, target, targetStart, targetEnd, sourceStart, sourceEnd) {
  if (arguments.length === 1) return source.compare(target)
  if (targetStart === undefined) targetStart = 0
  if (targetEnd === undefined) targetEnd = target.length
  if (sourceStart === undefined) sourceStart = 0
  if (sourceEnd === undefined) sourceEnd = source.length
  if (sourceStart >= sourceEnd) return (targetStart >= targetEnd ? 0 : -1)
  if (targetStart >= targetEnd) return 1
  return compareOffset(source, target, targetStart, sourceStart, targetEnd, sourceEnd)
}

function bufferCompareNative (source, target, targetStart, targetEnd, sourceStart, sourceEnd) {
  return source.compare(target, targetStart, targetEnd, sourceStart, sourceEnd)
}

module.exports = major <= 4 ? bufferComparePolyfill : bufferCompareNative
