try {
  module.exports = require('fs').constants
} catch {
  module.exports = { // just for envs without fs
    S_IFMT: 61440,
    S_IFDIR: 16384,
    S_IFCHR: 8192,
    S_IFBLK: 24576,
    S_IFIFO: 4096,
    S_IFLNK: 40960
  }
}
