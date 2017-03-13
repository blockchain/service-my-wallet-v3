var R = require('ramda')
var unicodeLength = require('unicode-length')

function boxMessage (lines, options) {
  options = options || {}
  var borderChar = options.borderChar || '*'
  var padding = options.padding || 4

  var lineWidth = lines.map(unicodeLength.get).reduce(R.max, 0)
  var fullWidth = padding * 2 + lineWidth
  var pad = R.compose(R.join(''), R.repeat(' '))
  var top = [R.join('', R.repeat(borderChar, fullWidth)), pad(fullWidth)]

  var formatLine = function (line) {
    return pad(padding) + line + pad(lineWidth - unicodeLength.get(line) + padding)
  }

  return []
    .concat(top, lines.map(formatLine), top.slice().reverse())
    .map(function (line) { return '\t' + borderChar + line + borderChar })
    .join('\n')
}

module.exports = {
  boxMessage: boxMessage
}
