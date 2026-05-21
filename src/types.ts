/**
 * 微信小程序构建/编译配置选项
 */
export interface BuildOptions {
    /** 小程序本地项目的构建命令（例如：npm run build:mp-weixin 或 uni build） */
    buildCommand: string
    /** 小程序项目根目录绝对路径 */
    sourceDir: string
    /** 构建标准输出日志回调函数 */
    onStdout?: (data: string) => void
    /** 构建标准错误或异常日志回调函数 */
    onStderr?: (data: string) => void
    /** 进程启动成功回调函数，用于在上层保存子进程实例以便取消/终止任务 */
    onProcessStarted?: (process: any) => void
}

/**
 * 微信小程序发布/上传配置选项
 */
export interface UploadOptions {
    /** 
     * 上传方式：
     * - 'cli': 调用本地微信开发者工具的 CLI 命令上传（需本地安装并开启安全端口）
     * - 'ci': 调用微信官方 miniprogram-ci 底层库在后台静默上传（需提供小程序上传私钥）
     */
    uploadMethod: 'cli' | 'ci'
    /** 小程序项目源码根目录路径 */
    sourceDir: string
    /** 小程序构建后产物的输出相对目录（例如：dist/build/mp-weixin） */
    outputDir?: string
    /** 小程序 AppID */
    appid: string
    /** 小程序项目名称 */
    name: string
    /** 本次上传的版本号 */
    version: string
    /** 本次上传的备注描述信息 */
    desc: string
    /** 
     * API 上传所需的安全凭证 (仅在 ci 模式下有效)
     */
    cred: {
        /** 小程序代码上传密钥文件 (.key) 在本地的绝对路径 */
        privateKeyPath?: string
        /** 小程序代码上传密钥文件的文本内容（直接传入私钥内容） */
        privateKeyContent?: string
    }
    /**
     * 全局环境与通用配置设置
     */
    settings: {
        /** 本地微信开发者工具的绝对安装路径（cli 模式下必须） */
        wxDevtoolsPath?: string
        /** 默认全局版本号 */
        version?: string
        /** 默认全局发布描述 */
        uploadDesc?: string
    }
    /** 上传状态与进度变更的回调通知 */
    onProgress?: (level: 'info' | 'success' | 'warning' | 'error', message: string) => void
    /** 进程启动成功回调函数，用于在上层保存子进程实例以便取消/终止任务 */
    onProcessStarted?: (process: any) => void
}

/**
 * 微信开发者工具打开配置选项
 */
export interface OpenDevtoolsOptions {
    /** 本地微信开发者工具的绝对安装路径 */
    wxDevtoolsPath: string
    /** 小程序项目源码根目录路径 */
    sourceDir: string
    /** 小程序构建产物的相对路径 */
    outputDir?: string
    /** 打开状态及错误消息通知回调 */
    onProgress?: (level: 'info' | 'success' | 'warning' | 'error', message: string) => void
}
