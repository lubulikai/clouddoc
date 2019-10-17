const {
    app,
    BrowserWindow,
    Menu,
    ipcMain,
    dialog
} = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const menuTemplate = require('./src/menuTemplate');
const AppWindow = require('./src/AppWindow');
const Store = require('electron-store');
const QiniuManager = require('./src/utils/QiniuManager');
const uuidv4 = require('uuid/v4');

const settingsStore = new Store({
    name: 'Settings'
});
const fileStore = new Store({
    name: 'Files Data'
})
let mainWindow, settingsWindow;

const createManager = () => {
    const accessKey = settingsStore.get('accessKey');
    const secretKey = settingsStore.get('secretKey');
    const bucketName = settingsStore.get('bucketName');
    return new QiniuManager(accessKey, secretKey, bucketName);
}
app.on('ready', () => {
    const mainWindowConfig = {
        width: 1440,
        height: 900,
    }
    const urlLocation = isDev ? 'http://localhost:3000' : `file://${path.join(__dirname,'./index.html')}`;
    mainWindow = new AppWindow(mainWindowConfig, urlLocation);
    mainWindow.on('closed', () => {
        mainWindow = null;
    })
    let menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);
    ipcMain.on('open-settings-window', () => {
        const settingsWindowConfig = {
            width: 500,
            height: 400,
            parent: mainWindow,
            maximizable: false,
            minimizable: false,
            fullscreenable: false,
            autoHideMenuBar: true
        }
        const settingsFileLocation = `file://${path.join(__dirname,'./settings/settings.html')}`;
        settingsWindow = new AppWindow(settingsWindowConfig, settingsFileLocation);
        settingsWindow.on('closed', () => {
            settingsWindow = null;
        })
    })
    ipcMain.on('upload-file', (event, data) => {
        const manager = createManager();
        manager.uploadFile(data.key, data.path).then(data => {
            console.log('上传成功', data);
            mainWindow.webContents.send('active-file-uploaded');
        }).catch((error) => {
            dialog.showErrorBox('同步失败', '请检查七牛云参数是否正确');
        })
    })

    ipcMain.on('delete-file', (event, data) => {
        const {
            key,
            id
        } = data;
        const manager = createManager();
        manager.deleteFile(key).then(res => {
            console.log('删除成功', res);
            mainWindow.webContents.send('active-file-deleted', id);
        }).catch(error => {
            console.log(error);
            dialog.showErrorBox('删除失败', error);
        })
    })

    ipcMain.on('rename-file', (event, data) => {
        const {
            oldTitle,
            newTitle
        } = data;
        const manager = createManager();
        manager.renameFile(`${oldTitle}.md`, `${newTitle}.md`).then(res => {
            console.log('修改成功', res);
            mainWindow.webContents.send('active-file-renamed', data);
        }).catch(error => {
            console.log(error);
            dialog.showErrorBox('重命名失败', '请检查七牛云参数是否正确');
        })
    })

    ipcMain.on('download-file', (event, data) => {
        const manager = createManager();
        const filesObj = fileStore.get('files');
        const {
            key,
            path,
            id
        } = data;
        manager.getStat(key).then(resp => {
            const serverUpdatedTime = Math.round(resp.putTime / 10000);
            const localUpdatedTime = filesObj[id].updatedAt;
            if (serverUpdatedTime > localUpdatedTime || !localUpdatedTime) {
                manager.downloadFile(key, path).then(() => {
                    mainWindow.webContents.send('file-downloaded', {
                        status: 'download-success',
                        id
                    })
                })
            } else {
                mainWindow.webContents.send('file-downloaded', {
                    status: 'no-new-file',
                    id
                })
            }
        }, error => {
            if (error.statusCode === 612) {
                mainWindow.webContents.send('file-downloaded', {
                    status: 'no-file',
                    id
                })
            }
        })
    })

    ipcMain.on('upload-all-to-qiniu', () => {
        mainWindow.webContents.send('loading-status', true);
        const manager = createManager();
        const filesObj = fileStore.get('files') || {};
        const uploadPromiseArr = Object.keys(filesObj).map(key => {
            const file = filesObj[key];
            return manager.uploadFile(`${file.title}.md`, file.path);
        })
        Promise.all(uploadPromiseArr).then(result => {
            console.log(result);
            dialog.showMessageBox({
                type: 'info',
                title: `成功上传了${result.length}个文件`,
                message: `成功上传了${result.length}个文件`
            })
            mainWindow.webContents.send('files-uploaded');
        }).catch(() => {
            dialog.showErrorBox('同步失败', '请检查七牛云参数是否正确');
        }).finally(() => {
            mainWindow.webContents.send('loading-status', false);
        })
        // setTimeout(() => {
        //     mainWindow.webContents.send('loading-status', false);
        // }, 2000);
    })

    ipcMain.on('down-all-to-local', () => {
        mainWindow.webContents.send('loading-status', true);
        const savedLocation = settingsStore.get('savedFileLocation');
        const filesObj = fileStore.get('files') || {}; //本地数据
        const manager = createManager();
        const downFiles = [];
        manager.getFileList().then(data => {
            const {
                items
            } = data;

            const downloadPromiseArr = items.map(item => {
                const {
                    key,
                    putTime
                } = item;
                const serverUpdatedTime = Math.round(putTime / 10000);
                let isNeedDownload = false; //是否需要下载
                let isLocalExist = false; //本地是否存在该文件
                let localObj; //本地的obj
                for (let obj of Object.keys(filesObj)) {
                    const {
                        title,
                        updatedAt
                    } = obj;
                    if (`${title}.md` === key && (serverUpdatedTime > updatedAt || !updatedAt)) {
                        localObj = obj
                        isLocalExist = true;
                        isNeedDownload = true;
                        break;
                    }
                }
                if (isNeedDownload || !isLocalExist) {
                    downFiles.push({
                        ...item,
                        updatedAt: serverUpdatedTime,
                        path: `${savedLocation}\\${item.key}`,
                        id: localObj ? localObj.id : null
                    });
                    return manager.downloadFile(item.key, `${savedLocation}\\${item.key}`);
                }
            })
            return Promise.all(downloadPromiseArr);
        }).then(arr => {
            dialog.showMessageBox({
                type: 'info',
                title: `成功下载了${arr.length}个文件`,
                message: `成功下载了${arr.length}个文件`
            })

            const finalFilesObj = downFiles.reduce((newFilesObj, qiniuFile) => {
                const {
                    key,
                    updatedAt,
                    path,
                    id
                } = qiniuFile;
                if (id !== null) {
                    const updateItem = {
                        ...filesObj[id],
                        isSynced: true,
                        updatedAt
                    }
                    return {
                        ...newFilesObj,
                        [id]: updateItem
                    }
                } else {
                    const newId = uuidv4();
                    const newItem = {
                        id: newId,
                        path,
                        createdAt: new Date().getTime(),
                        isSynced: true,
                        updatedAt,
                        title: key.substring(0, key.lastIndexOf('.'))
                    }
                    return {
                        ...newFilesObj,
                        [newId]: newItem
                    }
                }
            }, {
                ...filesObj
            });
            fileStore.set("files", finalFilesObj);
            mainWindow.webContents.send('active-file-all-downloaded', finalFilesObj);
        }).catch(() => {
            dialog.showErrorBox('下载失败', '请检查七牛云参数是否正确');
        }).finally(() => {
            mainWindow.webContents.send('loading-status', false);
        })
    })

    ipcMain.on('config-is-saved', () => {
        //mac和windows的index是不一样的
        let qiniuMenu = process.platform === 'darwin' ? menu.items[3] : menu.items[2];
        const switchItems = toggle => {
            [1, 2, 3].forEach(number => {
                qiniuMenu.submenu.items[number].enabled = toggle
            })
        }
        const qiniuIsConfiged = ['accessKey', 'secretKey', 'bucketName'].every(key => !!settingsStore.get(key));
        if (qiniuIsConfiged) {
            switchItems(true);
        } else {
            switchItems(false);
        }
    })

})