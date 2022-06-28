// imports
const util = require('./util');
const { WechatSalon } = require('./salon');
const { UniCloudError } = require('./error');
const { generateApiResult, nomalizeError } = require('./result');

// constant variables
const GET_USERINFO = 'https://api.weixin.qq.com/sns/userinfo?access_token=';
const GET_USERINFO_OFFICIAL = 'https://api.weixin.qq.com/cgi-bin/user/info?access_token=';

/**
 * 获取用户信息
 * @param {String} token 网页授权接口调用凭证,注意：此access_token与基础支持的access_token不同
 * @param {String} openid 用户的唯一标识
 * @param {String} lang 返回国家地区语言版本，zh_CN 简体，zh_TW 繁体，en 英语
 */
async function getUserInfo(token, openid, lang = 'zh_CN') {
	if (!token) throw new UniCloudError({code: 41001});
	if (!openid) throw new UniCloudError({code: 41009});
	
	let res;
	try {
		res = await uniCloud.httpclient.request(`${GET_USERINFO + token}&openid=${openid}&lang=${lang}`, { dataType: 'json' });
	} catch(e) {
		return nomalizeError('getUserInfo', e);
	}
	
	return generateApiResult('getUserInfo', res.data);
}

/**
 * 获取公众号用户信息
 * @param {String} token 调用接口凭证
 * @param {String} openid 普通用户的标识，对当前公众号唯一
 * @param {String} lang 返回国家地区语言版本，zh_CN 简体，zh_TW 繁体，en 英语
 */
 async function getOfficialUserInfo(token, openid, lang = 'zh_CN') {
	if (!token) throw new UniCloudError({code: 41001});
	if (!openid) throw new UniCloudError({code: 41009});
	
	let res;
	try {
		res = await uniCloud.httpclient.request(`${GET_USERINFO_OFFICIAL + token}&openid=${openid}&lang=${lang}`, { dataType: 'json' });
	} catch(e) {
		return nomalizeError('getUserInfo', e);
	}
	
	return generateApiResult('getUserInfo', res.data);
}

module.exports = {
	...util,
	WechatSalon,
	getUserInfo,
	getOfficialUserInfo,
}
