const ErrorCode = {
  0: { errCode: 0, errMsg: '' },
  40001: { errMsg: 'invalid access token or secret' },
  40002: { errMsg: 'invalid token type' },
  40003: { errMsg: 'invalid openid' },
  40013: { errMsg: 'invalid appid' },
  40014: { errMsg: 'invalid access token' },
  40029: { errMsg: 'invalid oauth code' },
  40030: { errMsg: 'invalid refresh token' },
  40035: { errMsg: 'invalid param' },
  40125: { errMsg: 'invalid secret' },
  40163: { errMsg: 'oauth code has been used' },
  41001: { errMsg: 'access token is required' },
  41002: { errMsg: 'appid is required' },
  41003: { errMsg: 'refresh token is required' },
  41004: { errMsg: 'secret is required' },
  41008: { errMsg: 'oauth code is required' },
  41009: { errMsg: 'openid is required' },
  42001: { errMsg: 'access token expired' },
  42002: { errMsg: 'refresh token expired' },
  42003: { errMsg: 'oauth code expired' },
  42007: { errMsg: 'invalid access token and refresh token' },
}

class UniCloudError extends Error {
  constructor (options) {
	options.message = options.message || ErrorCode[options.code].errMsg;
	super(options.message)
    this.errMsg = options.message || ''
    Object.defineProperties(this, {
      message: {
        get () {
          return `errCode: ${options.code || ''} | errMsg: ` + this.errMsg
        },
        set (msg) {
          this.errMsg = msg
        }
      }
    })
  }
}

module.exports = {
  ErrorCode,
  UniCloudError
}