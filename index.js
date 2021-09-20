var Extract = require('./extract')
var Pack = require('./pack')

exports.extract = opts => new Extract(opts)
exports.pack = opts => new Pack(opts)
