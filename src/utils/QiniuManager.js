const qiniu = require('qiniu');
const axios = require('axios');
const fs = require('fs');

class QiniuManager {
    constructor(accessKey, secretKey, bucket) {
        this.mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        this.bucket = bucket;
        //初始化配置类
        this.config = new qiniu.conf.Config();
        // 空间对应的机房
        this.config.zone = qiniu.zone.Zone_z0;

        this.bucketManager = new qiniu.rs.BucketManager(this.mac, this.config);
    }
    //上传方法
    uploadFile(key, localFilePath) {
        const options = {
            scope: this.bucket + ":" + key,
            expires: 7200
        };
        const putPolicy = new qiniu.rs.PutPolicy(options);
        const uploadToken = putPolicy.uploadToken(this.mac);
        var formUploader = new qiniu.form_up.FormUploader(this.config);
        var putExtra = new qiniu.form_up.PutExtra();
        return new Promise((resolve, reject) => {
            formUploader.putFile(uploadToken, key, localFilePath, putExtra, this._handleCallback(resolve, reject));
        })
    }
    //删除云上文件
    deleteFile(key) {
        return new Promise((resolve, reject) => {
            this.bucketManager.delete(this.bucket, key, this._handleCallback(resolve, reject));
        });
    }
    //获取云上的所有文件
    getFileList() {
        let options = {
            limit: 10,
            prefix: '',
        }
        return new Promise((resolve, reject) => {
            this.bucketManager.listPrefix(this.bucket, options, this._handleCallback(resolve, reject));
        })
    }
    //重命名文件
    renameFile(oldKey, newKey) {
        // 强制覆盖已有同名文件
        let options = {
            force: true
        }
        return new Promise((resolve, reject) => {
            this.bucketManager.move(this.bucket, oldKey, this.bucket, newKey, options, this._handleCallback(resolve, reject))
        })
    }
    getBucketDomain() {
        const reqURL = `http://api.qiniu.com/v6/domain/list?tbl=${this.bucket}`;
        const digest = qiniu.util.generateAccessToken(this.mac, reqURL);
        return new Promise((resolve, reject) => {
            qiniu.rpc.postWithoutForm(reqURL, digest, this._handleCallback(resolve, reject));
        })
    }
    //获取云上文件的基本信息
    getStat(key) {
        return new Promise((resolve, reject) => {
            this.bucketManager.stat(this.bucket, key, this._handleCallback(resolve, reject))
        })
    }
    //生产下载链接
    generateDownloadLink(key) {
        const domainPromise = this.publicBucketDomain ?
            Promise.resolve([this.publicBucketDomain]) : this.getBucketDomain();
        return domainPromise.then(data => {
            if (Array.isArray(data) && data.length > 0) {
                const pattern = /^https?/
                this.publicBucketDomain = pattern.test(data[0]) ? data[0] : `http://${data[0]}`;
                return this.bucketManager.publicDownloadUrl(this.publicBucketDomain, key);
            } else {
                throw Error('域名未找到,请查看储存空间是否已经过期');
            }
        })
    }
    downloadFile(key, downloadPath) {
        //1.获取下载链接
        //2.发送请求下载链接，返回可读流
        //3.创建一个可写流pipe到文件内
        //4.返回Promise
        return this.generateDownloadLink(key).then(link => {
            console.log(link);
            const timeStamp = new Date().getTime();
            const url = `${link}?timestamp=${timeStamp}`;
            return axios({
                url,
                method: 'GET',
                responseType: 'stream',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            })
        }).then(response => {
            const writer = fs.createWriteStream(downloadPath);
            response.data.pipe(writer);
            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            })
        }).catch(err => {
            return Promise.reject({
                err: err.response
            });
        })
    }
    _handleCallback(resolve, reject) {
        return (respErr, respBody, respInfo) => {
            if (respErr) {
                throw respErr;
            }
            if (respInfo.statusCode == 200) {
                resolve(respBody)
            } else {
                reject({
                    statusCode: respInfo.statusCode,
                    body: respBody
                })
            }
        }
    }
}

module.exports = QiniuManager;