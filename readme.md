# sherer-wechat-utils

微信小程序和公众号便捷程序

### WechatSalon 的使用方法

```js
const { WechatSalon } = require('sherer-wechat-utils');

const token = "Your token"; // 小程序或公众号的令牌(Token)
const appid = "Your appid"; // 小程序或公众号的AppId(安全模式时必要)
const encodingAESKey = "Your encodingAESKey"; // 小程序或公众号的消息加解密密钥(encodingAESKey, 安全模式时必要)

let result;
let salon = new WechatSalon(event, { appid, token, encodingAESKey });
let check = await salon.run({
    subscribe: async res => { // 关注事件
        // 您的逻辑代码
        result = salon.getText("欢迎关注");
    },
    unsubscribe: async res => { // 取消关注事件
        // 您的逻辑代码
    },
    Scan: async res => { // 扫码事件
        // 您的逻辑代码
    },
    Location: async res => { // 上报地理位置事件
        // 您的逻辑代码
    },
    Click: async res => { // 自定义菜单点击事件
        // 您的逻辑代码
    },
    View: async res => { // 自定义菜单跳转事件
        // 您的逻辑代码
    },
    TemplateSendJobFinish: async res => { // 模板消息发送任务完成事件
        // 您的逻辑代码
    },
    ViewMiniProgram: async res => { // 跳转小程序事件
        // 您的逻辑代码
    },
    text: async res => { // 文本消息
        // 您的逻辑代码
        result = salon.getImage("图片 mediaId");
    },
    image: async res => { // 图片消息
        // 您的逻辑代码
    },
    voice: async res => { // 语音消息
        // 您的逻辑代码
    },
    video: async res => { // 视频消息
        // 您的逻辑代码
    },
    shortvideo: async res => { // 短视频消息
        // 您的逻辑代码
    },
    location: async res => { // 位置消息
        // 您的逻辑代码
    },
    link: async res => { // 链接消息
        // 您的逻辑代码
    },
});

return check || result;
```