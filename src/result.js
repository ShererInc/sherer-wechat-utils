const { UniCloudError } = require('./error');

function generateApiResult (apiName, data) {
  if (data.errcode) {
    throw new UniCloudError({
      code: data.errcode || -2,
      message: data.errmsg || `${apiName} fail`
    })
  } else {
    delete data.errcode
    delete data.errmsg
    return {
      ...data,
      errMsg: `${apiName} ok`,
      errCode: 0
    }
  }
}

function nomalizeError (apiName, error) {
  throw new UniCloudError({
    code: error.code || -2,
    message: error.message || `${apiName} fail`
  })
}


module.exports = {
  generateApiResult,
  nomalizeError
}