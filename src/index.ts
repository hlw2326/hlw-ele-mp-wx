/**
 * 微信小程序自动化编译与发布工具库
 * 统一导出所有子模块以供渲染进程和主进程引用
 */

// 导出类型定义模块（编译、上传及打开工具的配置选项接口）
export * from './types'

// 导出工具函数模块（环境路径解析、工具接口获取等）
export * from './utils'

// 导出自动化编译/构建逻辑
export * from './compile'

// 导出小程序上传发布逻辑（支持开发者工具 CLI 命令行上传和 miniprogram-ci 接口上传两种模式）
export * from './upload'

// 导出微信开发者工具项目自动打开逻辑
export * from './devtools'
