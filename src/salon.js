const crypto = require('crypto');
const { sha1, getNonceStr, toJson } = require('./util');

class WechatSalon {
    constructor(event, config = {}) {
        this.event = event || {}; // 参数
        this.token = config.token || ''; // 必要
        this.appid = config.appid || ''; // 安全模式时必要
        let encodingAESKey = config.encodingAESKey || ''; // 安全模式时必要

        this.IV = encodingAESKey.slice(0, 16);
        this.aesKey = new Buffer.from(encodingAESKey + '=', 'base64');
    }

    async run(options = {}) {
        //#region 处理参数
        let event = this.event;
        const headers = event.headers;
        let body = event.body || "{}";
        const parameters = event.queryStringParameters || {};
        if (event.isBase64Encoded) body = Buffer.from(body, 'base64').toString();
        const requestId = event.requestId || event.requestContext.requestId;
        //#endregion

        //#region 获取公共参数
        console.log('数据', body);
        let nonce = event.queryStringParameters.nonce; // 随机字符串
        let openid = event.queryStringParameters.openid; // 用户Openid
        let echostr = event.queryStringParameters.echostr; // 随机字符串（验证服务器时返回）
        let timestamp = event.queryStringParameters.timestamp; // 时间戳
        let signature = event.queryStringParameters.signature; // 签名
        let msg_signature = event.queryStringParameters.msg_signature; // 签名（安全模式时返回）
        //#endregion

        //#region 验证签名
        let sign = sha1([this.token, timestamp, nonce].sort().join("")); // 生成签名
        if (sign != signature) return "签名错误"; // 检测签名
        if (echostr) return echostr; // 验证服务器
        //#endregion

        //#region 判断消息是否解密
        this.isEncrypt = false; // 是否加密文
        let queryData = toJson(body); // XML转换JSON
        if (queryData.Encrypt && msg_signature) {
            sign = sha1([this.token, timestamp, nonce, queryData.Encrypt].sort().join("")); // 计算签名
            if (sign != msg_signature) return "签名错误"; // 检测签名
            queryData = toJson(this.decrypt(queryData.Encrypt)); // 解密
            this.isEncrypt = true;
        }
        //#endregion

        //#region 获取消息公共参数
        console.log('最终数据', queryData);
        let msgType = queryData.MsgType; // 消息类型，event
        let toUserName = queryData.ToUserName; // 开发者微信号
        let createTime = queryData.CreateTime; // 消息创建时间 （整型）
        let fromUserName = queryData.FromUserName; // 发送方帐号（一个OpenID）
        this.resultData = { nonce, timestamp, isEncrypt: this.isEncrypt, toUserName, openid, fromUserName, createTime }; // 返回数据
        //#endregion

        //#region 判断消息类型
        const qrscene = 'qrscene_';
        switch (msgType) {
            case "event": { // 接受事件消息
                let queryEvent = queryData.Event; // 事件类型，subscribe(订阅)、unsubscribe(取消订阅)
                this.resultData.event = queryEvent; // 事件类型

                switch (queryEvent) {
                    case "unsubscribe": { // 取消订阅事件
                        console.log('取消订阅事件');
                        if (options.unsubscribe && options.unsubscribe instanceof Function) await options.unsubscribe(this.resultData);
                        break;
                    }
                    case "subscribe": { // 订阅事件
                        let ticket = queryData.Ticket; // 二维码的ticket，可用来换取二维码图片
                        let eventKey = queryData.EventKey; // 事件 KEY 值，qrscene_为前缀，后面为二维码的参数值
                        if (eventKey && eventKey.indexOf(qrscene) == 0) eventKey = eventKey.substr(qrscene.length); // 去除前缀

                        console.log('订阅事件', { eventKey, ticket });
                        if (options.subscribe && options.subscribe instanceof Function) await options.subscribe({ ...this.resultData, eventKey, ticket });
                        break;
                    }
                    case "SCAN": { // 扫描带参数二维码事件
                        let ticket = queryData.Ticket; // 二维码的ticket，可用来换取二维码图片
                        let eventKey = queryData.EventKey; // 事件 KEY 值，qrscene_为前缀，后面为二维码的参数值
                        if (eventKey && eventKey.indexOf(qrscene) == 0) eventKey = eventKey.substr(qrscene.length); // 去除前缀

                        console.log('扫描带参数二维码事件', { eventKey, ticket });
                        if (options.Scan && options.Scan instanceof Function) await options.Scan({ ...this.resultData, eventKey, ticket });
                        break;
                    }
                    case "LOCATION": { // 上报地理位置事件
                        let latitude = queryData.Latitude; // 地理位置纬度
                        let longitude = queryData.Longitude; // 地理位置经度
                        let precision = queryData.Precision; // 地理位置精度

                        console.log('上报地理位置事件', { latitude, longitude, precision });
                        if (options.Location && options.Location instanceof Function) await options.Location({ ...this.resultData, latitude, longitude, precision });
                        break;
                    }
                    case "CLICK": { // 自定义菜单事件
                        let eventKey = queryData.EventKey; // 事件 KEY 值，与自定义菜单接口中 KEY 值对应

                        console.log('自定义菜单事件', { eventKey });
                        if (options.Click && options.Click instanceof Function) await options.Click({ ...this.resultData, eventKey });
                        break;
                    }
                    case "VIEW": { // 点击菜单跳转链接时的事件推送
                        let eventKey = queryData.EventKey; // 事件 KEY 值，设置的跳转URL

                        console.log('点击菜单跳转链接时的事件推送', { eventKey });
                        if (options.View && options.View instanceof Function) await options.View({ ...this.resultData, eventKey });
                        break;
                    }
                    case "TEMPLATESENDJOBFINISH": { // 模板消息发送结果事件
                        let msgID = queryData.MsgID; // 模板消息ID
                        let status = queryData.Status; // 发送状态，成功success，用户拒绝failed:user block，其他原因发送失败failed: system failed

                        console.log('模板消息发送结果事件', { msgID, status });
                        if (options.TemplateSendJobFinish && options.TemplateSendJobFinish instanceof Function) await options.TemplateSendJobFinish({ ...this.resultData, msgID, status });
                        break;
                    }
                    case "view_miniprogram": { // 点击菜单跳转小程序时的事件推送
                        let eventKey = queryData.EventKey; // 事件 KEY 值，设置的跳转小程序的路径
                        let menuId = queryData.MenuId; // 菜单ID，可以用这个字段来唯一标识一个类型的跳转小程序

                        console.log('点击菜单跳转小程序时的事件推送', { eventKey, menuId });
                        if (options.ViewMiniProgram && options.ViewMiniProgram instanceof Function) await options.ViewMiniProgram({ ...this.resultData, eventKey, menuId });
                        break;
                    }
                    case "scancode_push": { // 扫码推事件
                        break;
                    }
                    case "scancode_waitmsg": { // 扫码推事件且弹出“消息接收中”提示框
                        break;
                    }
                    case "pic_sysphoto": { // 弹出系统拍照发图
                        break;
                    }
                    case "pic_photo_or_album": { // 弹出拍照或者相册发图
                        break;
                    }
                    case "pic_weixin": { // 弹出微信相册发图器
                        break;
                    }
                    case "location_select": { // 弹出地理位置选择器
                        break;
                    }
                    case "media_id": { // 下发消息（除文本消息）
                        break;
                    }
                    case "view_limited": { // 跳转图文消息URL
                        break;
                    }
                    case "MASSSENDJOBFINISH": { // 群发消息结果事件
                        break;
                    }
                    case "kf_create_session": { // 多客服接入会话事件
                        break;
                    }
                    case "kf_close_session": { // 多客服关闭会话事件
                        break;
                    }
                    case "kf_switch_session": { // 多客服转接会话事件
                        break;
                    }
                    case "poi_check_notify": { // 审核结果事件推送
                        break;
                    }
                    case "WifiConnected": { // Wifi连网成功事件
                        break;
                    }
                    case "user_consume_card": { // 卡券核销事件
                        break;
                    }
                    case "user_view_card": { // 卡券进入会员卡事件
                        break;
                    }
                    case "user_enter_session_from_card": { // 卡券进入会员卡事件
                        break;
                    }
                    case "card_pass_check": { // 卡券通过审核事件
                        break;
                    }
                    case "card_not_pass_check": { // 卡券未通过审核事件
                        break;
                    }
                    case "user_get_card": { // 领取卡券事件
                        break;
                    }
                    case "user_del_card": { // 删除卡券事件
                        break;
                    }
                    default: console.log('未识别事件', queryEvent); break;
                }
                break;
            }
            case "text": { // 接受文本消息
                let content = queryData.Content; // 文本消息内容
                let msgId = queryData.MsgId; // 消息id，64位整型
                let msgDataId = queryData.MsgDataId; // 消息的数据ID（消息如果来自文章时才有）
                let idx = queryData.Idx; // Idx	多图文时第几篇文章，从1开始（消息如果来自文章时才有）

                console.log('接受文本消息', { content, msgId, msgDataId, idx });
                if (options.text && options.text instanceof Function) await options.text({ ...this.resultData, content, msgId, msgDataId, idx });
                break;
            }
            case "image": { // 接受图片消息
                let picUrl = queryData.PicUrl; // 图片链接（由系统生成）
                let mediaId = queryData.MediaId; // 图片消息媒体id，可以调用获取临时素材接口拉取数据。
                let msgId = queryData.MsgId; // 消息id，64位整型
                let msgDataId = queryData.MsgDataId; // 消息的数据ID（消息如果来自文章时才有）
                let idx = queryData.Idx; // 多图文时第几篇文章，从1开始（消息如果来自文章时才有

                console.log('接受图片消息', { picUrl, mediaId, msgId, msgDataId, idx });
                if (options.image && options.image instanceof Function) await options.image({ ...this.resultData, picUrl, mediaId, msgId, msgDataId, idx });
                break;
            }
            case "voice": { // 接受语音消息
                let mediaId = queryData.MediaId; // 语音消息媒体id，可以调用获取临时素材接口拉取数据。
                let format = queryData.Format; // 语音格式，如amr，speex等
                let msgId = queryData.MsgId; // 消息id，64位整型
                let msgDataId = queryData.MsgDataId; // 消息的数据ID（消息如果来自文章时才有）
                let idx = queryData.Idx; // 多图文时第几篇文章，从1开始（消息如果来自文章时才有）

                console.log('接受语音消息', { format, mediaId, msgId, msgDataId, idx });
                if (options.voice && options.voice instanceof Function) await options.voice({ ...this.resultData, mediaId, format, msgId, msgDataId, idx });
                break;
            }
            case "video": { // 接受视频消息
                let mediaId = queryData.MediaId; // 视频消息媒体id，可以调用获取临时素材接口拉取数据。
                let thumbMediaId = queryData.ThumbMediaId; // 视频消息缩略图的媒体id，可以调用获取临时素材接口拉取数据。
                let msgId = queryData.MsgId; // 消息id，64位整型
                let msgDataId = queryData.MsgDataId; // 消息的数据ID（消息如果来自文章时才有）
                let idx = queryData.Idx; // 多图文时第几篇文章，从1开始（消息如果来自文章时才有）

                console.log('接受视频消息', { mediaId, thumbMediaId, msgId, msgDataId, idx });
                if (options.video && options.video instanceof Function) await options.video({ ...this.resultData, mediaId, thumbMediaId, msgId, msgDataId, idx });
                break;
            }
            case "shortvideo": { // 接受小视频消息
                let mediaId = queryData.MediaId; // 小视频消息媒体id，可以调用获取临时素材接口拉取数据。
                let thumbMediaId = queryData.ThumbMediaId; // 小视频消息缩略图的媒体id，可以调用获取临时素材接口拉取数据。
                let msgId = queryData.MsgId; // 消息id，64位整型
                let msgDataId = queryData.MsgDataId; // 消息的数据ID（消息如果来自文章时才有）
                let idx = queryData.Idx; // 多图文时第几篇文章，从1开始（消息如果来自文章时才有）

                console.log('接受小视频消息', { mediaId, thumbMediaId, msgId, msgDataId, idx });
                if (options.shortvideo && options.shortvideo instanceof Function) await options.shortvideo({ ...this.resultData, mediaId, thumbMediaId, msgId, msgDataId, idx });
                break;
            }
            case "location": { // 接受地理位置消息
                let location_X = queryData.Location_X; // 地理位置维度
                let location_Y = queryData.Location_Y; // 地理位置经度
                let scale = queryData.Scale; // 地图缩放大小
                let label = queryData.Label; // 地理位置信息
                let msgId = queryData.MsgId; // 消息id，64位整型
                let msgDataId = queryData.MsgDataId; // 消息的数据ID（消息如果来自文章时才有）
                let idx = queryData.Idx; // 多图文时第几篇文章，从1开始（消息如果来自文章时才有）

                console.log('接受地理位置消息', { location_X, location_Y, scale, label, msgId, msgDataId, idx });
                if (options.location && options.location instanceof Function) await options.location({ ...this.resultData, location_X, location_Y, scale, label, msgId, msgDataId, idx });
                break;
            }
            case "link": { // 接受链接消息
                let title = queryData.Title; // 消息标题
                let description = queryData.Description; // 消息描述
                let url = queryData.Url; // 消息链接
                let msgId = queryData.MsgId; // 消息id，64位整型
                let msgDataId = queryData.MsgDataId; // 消息的数据ID（消息如果来自文章时才有）
                let idx = queryData.Idx; // 多图文时第几篇文章，从1开始（消息如果来自文章时才有）

                console.log('接受链接消息', { title, description, url, msgId, msgDataId, idx });
                if (options.link && options.link instanceof Function) await options.link({ ...this.resultData, title, description, url, msgId, msgDataId, idx });
                break;
            }
            default: break;
        }
        //#endregion
    }

    /**
     * 加密数据
     * @param {String} xmlMsg 格式化后的 xml 字符串
     * @returns 加密后的字符串 填入到 Encrypt 节点中
     * 参照官方文档 需要返回一个buf: 随机16字节 + xmlMsg.length(4字节）+xmlMsg+appid。
     * buf的字节长度需要填充到 32的整数，填充长度为 32-buf.length%32, 每一个字节为 32-buf.length%32
     */
    encrypt(xmlMsg, aesKey, iv, appid) {
        let msg = new Buffer(xmlMsg);
        let msgLength = new Buffer(4);
        msgLength.writeUInt32BE(msg.length, 0);
        let random16 = crypto.pseudoRandomBytes(16);

        let corpId = new Buffer(appid || this.appid);
        let raw_msg = Buffer.concat([random16, msgLength, msg, corpId]);
        let cipher = crypto.createCipheriv('aes-256-cbc', aesKey || this.aesKey, iv || this.IV);
        cipher.setAutoPadding(false);//重要，autopadding填充的内容无法正常解密
        raw_msg = this.PKCS7Encode(raw_msg);

        let cipheredMsg = Buffer.concat([cipher.update(/*encoded*/raw_msg), cipher.final()]);

        return cipheredMsg.toString('base64');
    }
    /**
     * 解密数据
     * @param {String} text 需要解密的字段（Encrypt节点中的内容）
     * @returns 返回消息内容（xml字符串）
     */
    decrypt(text, aesKey, iv) {
        let decipher = crypto.Decipheriv('aes-256-cbc', aesKey || this.aesKey, iv || this.IV)
        // crypto.Decipheriv == crypto.createDecipheriv 两个方法是一样的
        decipher.setAutoPadding(false);//重要

        let decipheredBuff = Buffer.concat([decipher.update(text, 'base64'), decipher.final()])
        decipheredBuff = this.PKCS7Decode(decipheredBuff)

        let len_netOrder_corpid = decipheredBuff.slice(16)
        //切割掉16个随机字符，剩余为 (4字节的 msg_len) + msg_content(长度为 msg_len ) + msg_appId 
        let msg_len = len_netOrder_corpid.slice(0, 4).readUInt32BE(0)
        let msg_content = len_netOrder_corpid.slice(4, msg_len + 4).toString('utf-8')
        //  let msg_appId =len_netOrder_corpid.slice(msg_len+4).toString('utf-8')

        return msg_content
    }

    PKCS7Decode(buff) {
        /*
         *去除尾部自动填充的内容
         */
        let padContent = buff[buff.length - 1]
        if (padContent < 1 || padContent > 32) {
            padContent = 0
        }
        let padLen = padContent;//根据填充规则，填充长度 = 填充内容，这一步赋值可以省略
        return buff.slice(0, buff.length - padLen)
    }
    PKCS7Encode(buff) {
        let blockSize = 32;
        let needPadLen = 32 - buff.length % 32
        if (needPadLen == 0) {
            needPadLen = blockSize
        }
        let pad = new Buffer(needPadLen)
        pad.fill(needPadLen)
        let newBuff = Buffer.concat([buff, pad])
        return newBuff
    }

    /**
     * 获取最终结果
     * @param {String} data 数据
     */
    getResultData(data, isEncrypt = undefined, token = '', aesKey = '', iv = '', appid = '') {
        if (isEncrypt === undefined) isEncrypt = this.isEncrypt || false;

        if (isEncrypt) {
            let nonce = getNonceStr();
            token = token || this.token;
            let timestamp = new Date().getTime();
            let encrypt = this.encrypt(data, aesKey, iv, appid);

            return "<xml>\n" +
                "<Encrypt><![CDATA[" + encrypt + "]]></Encrypt>\n" +
                "<MsgSignature><![CDATA[" + sha1([token, timestamp, nonce, encrypt].sort().join("")) + "]]></MsgSignature>\n" +
                "<TimeStamp>" + timestamp + "</TimeStamp>\n" +
                "<Nonce><![CDATA[" + nonce + "]]></Nonce>\n" +
                "<xml>";
        } else {
            return data;
        }
    }

    /**
     * 获取文本消息
     * @param {String} content // 回复的消息内容（换行：在 content 中能够换行，微信客户端就支持换行显示）
     * @param {String} toUserName // 接收方帐号（收到的OpenID）
     * @param {String} fromUserName // 开发者微信号
     */
    getText(content, toUserName = '', fromUserName = '', isEncrypt = false) {
        return this.getResultData("<xml>" +
            "<ToUserName><![CDATA[" + (toUserName || this.resultData.fromUserName) + "]]></ToUserName>" +
            "<FromUserName><![CDATA[" + (fromUserName || this.resultData.toUserName) + "]]></FromUserName>" +
            "<CreateTime>" + new Date().getTime() + "</CreateTime>" +
            "<MsgType><![CDATA[text]]></MsgType>" +
            "<Content><![CDATA[" + content + "]]></Content>" +
            "</xml>", isEncrypt);
    }

    /**
     * 获取图片消息
     * @param {String} mediaId 通过素材管理中的接口上传多媒体文件，得到的id
     * @param {String} toUserName // 接收方帐号（收到的OpenID）
     * @param {String} fromUserName // 开发者微信号
     */
    getImage(mediaId, toUserName, fromUserName, isEncrypt = false) {
        return this.getResultData("<xml>" +
            "<ToUserName><![CDATA[" + (toUserName || this.resultData.fromUserName) + "]]></ToUserName>" +
            "<FromUserName><![CDATA[" + (fromUserName || this.resultData.toUserName) + "]]></FromUserName>" +
            "<CreateTime>" + new Date().getTime() + "</CreateTime>" +
            "<MsgType><![CDATA[voice]]></MsgType>" +
            "<Image>" +
            "<MediaId><![CDATA[" + mediaId + "]]></MediaId>" +
            "</Image>" +
            "</xml>", isEncrypt);
    }

    /**
     * 获取视频消息
     * @param {String} mediaId 通过素材管理中的接口上传多媒体文件，得到的id
     * @param {String} title 视频消息的标题
     * @param {String} description 视频消息的描述
     * @param {String} toUserName 接收方帐号（收到的OpenID）
     * @param {String} fromUserName 开发者微信号
     */
    getVideo(mediaId, title, description, toUserName, fromUserName, isEncrypt = false) {
        return this.getResultData("<xml>" +
            "<ToUserName><![CDATA[" + (toUserName || this.resultData.fromUserName) + "]]></ToUserName>" +
            "<FromUserName><![CDATA[" + (fromUserName || this.resultData.toUserName) + "]]></FromUserName>" +
            "<CreateTime>" + new Date().getTime() + "</CreateTime>" +
            "<MsgType><![CDATA[video]]></MsgType>" +
            "<Video>" +
            "<MediaId><![CDATA[" + mediaId + "]]></MediaId>" +
            "<Title><![CDATA[" + title + "]]></Title>" +
            "<Description><![CDATA[" + description + "]]></Description>" +
            "</Video>" +
            "</xml>", isEncrypt);
    }

    /**
     * 获取音乐消息
     * @param {String} title 音乐标题
     * @param {String} description 音乐描述
     * @param {String} musicURL 音乐链接
     * @param {String} hQMusicUrl 高质量音乐链接，WIFI环境优先使用该链接播放音乐
     * @param {String} thumbMediaId 缩略图的媒体id，通过素材管理中的接口上传多媒体文件，得到的id
     * @param {String} toUserName 接收方帐号（收到的OpenID）
     * @param {String} fromUserName 开发者微信号
     */
    getMusic(title, description, musicURL, hQMusicUrl, thumbMediaId, toUserName, fromUserName, isEncrypt = false) {
        return this.getResultData("<xml>" +
            "<ToUserName><![CDATA[" + (toUserName || this.resultData.fromUserName) + "]]></ToUserName>" +
            "<FromUserName><![CDATA[" + (fromUserName || this.resultData.toUserName) + "]]></FromUserName>" +
            "<CreateTime>" + new Date().getTime() + "</CreateTime>" +
            "<MsgType><![CDATA[music]]></MsgType>" +
            "<Music>" +
            "<Title><![CDATA[" + title + "]]></Title>" +
            "<Description><![CDATA[" + description + "]]></Description>" +
            "<MusicUrl><![CDATA[" + musicURL + "]]></MusicUrl>" +
            "<HQMusicUrl><![CDATA[" + hQMusicUrl + "]]></HQMusicUrl>" +
            "<ThumbMediaId><![CDATA[" + thumbMediaId + "]]></ThumbMediaId>" +
            "</Music>" +
            "</xml>", isEncrypt);
    }

    /**
     * 发送文章
     * @param {String} title 图文消息标题
     * @param {String} description 图文消息描述
     * @param {String} picurl 图片链接，支持JPG、PNG格式，较好的效果为大图360*200，小图200*200
     * @param {String} url 点击图文消息跳转链接
     * @param {String} toUserName 接收方帐号（收到的OpenID）
     * @param {String} fromUserName 开发者微信号
     */
    getNews(title, description, picurl, url, toUserName, fromUserName, isEncrypt = false) {
        return this.getResultData("<xml>" +
            "<ToUserName><![CDATA[" + (toUserName || this.resultData.fromUserName) + "]]></ToUserName>" +
            "<FromUserName><![CDATA[" + (fromUserName || this.resultData.toUserName) + "]]></FromUserName>" +
            "<CreateTime>" + new Date().getTime() + "</CreateTime>" +
            "<MsgType><![CDATA[news]]></MsgType>" +
            "<ArticleCount>1</ArticleCount>" +
            "<Articles>" +
            "<item>" +
            "<Title><![CDATA[" + title + "]]></Title>" +
            "<Description><![CDATA[" + description + "]]></Description>" +
            "<PicUrl><![CDATA[" + picurl + "]]></PicUrl>" +
            "<Url><![CDATA[" + url + "]]></Url>" +
            "</item>" +
            "</Articles>" +
            "</xml>", isEncrypt);
    }

}

module.exports = {
    WechatSalon
}