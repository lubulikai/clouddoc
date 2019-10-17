const QiniuManager = require('./src/utils/QiniuManager');
const path = require('path');

//生成mac
const accessKey = '6DyyTRVCqQhmT27cLAAo_BchcIHF-e2Q48WAPx81';
const secretKey = '9s_rhufm8Op355wuOV5QdNTj2I1f9r16iBbBwNML';
const localFile = 'C:/Users/81228/Desktop/name2.md';
const key = '坐等国庆哈哈哈.md';
const downloadPath = path.join(__dirname, key);

//上传文件
const manager = new QiniuManager(accessKey, secretKey, 'lubulikai');
// manager.uploadFile(key, localFile).then(data=>{
//     console.log('上传成功',data);
//     return manager.deleteFile(key);
// }).then(data=>{
//     console.log('删除成功');
// })
// manager.deleteFile(key);

// manager.uploadFile(key, localFile).then(data=>{
//     console.log(data);
// })

//获取下载链接
// manager.getBucketDomain().then(data=>{
//     console.log(data);
// })

//下载文件
// manager.generateDownloadLink(key).then(data=>{
//     console.log(data);
// })

manager.downloadFile(key, downloadPath).then(data => {
    console.log(JSON.stringify(data));
}).catch(error => {
    console.log('error', error);
});

//获取文件列表
// manager.getFileList().then(res=>{
//     console.log(res);
// })

// //下载文件
// var bucketManager = new qiniu.rs.BucketManager(mac, config);
// var publicBucketDomain = 'http://py9hbni43.bkt.clouddn.com';
// // 公开空间访问链接
// var publicDownloadUrl = bucketManager.publicDownloadUrl(publicBucketDomain, key);
// console.log(publicDownloadUrl);