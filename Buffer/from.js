function bufferFrom (data, encoding) {
  // eslint-disable-next-line node/no-deprecated-api
  return new Buffer(data, encoding)
};

module.exports = Buffer.from || bufferFrom
