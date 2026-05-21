/**
 * 获取 Electron 渲染进程 preload 注入的安全系统操作工具集 (Bridge)
 * 包括 fs、path、spawn 进程唤起、DB 等底层 API
 */
export function getTools() {
    return window.hlw.tools
}

/**
 * 解析并定位微信开发者工具 CLI 的可执行文件路径
 *
 * 微信开发者工具在 Windows / macOS 系统下的 CLI 启动路径有所不同，
 * 该辅助函数用于智能判断路径是目录还是具体文件，并拼装出合适的 node 或 bat 启动路径。
 *
 * @param cliPath 用户配置的原始路径
 * @returns 返回最终执行的命令名/路径，以及追加的命令参数数组
 */
export function resolveWechatCli(cliPath: string): { command: string; args: string[] } {
    let command = cliPath
    let args: string[] = []
    
    const { fs, path } = getTools() || {}
    if (fs && path) {
        const normalized = cliPath.trim()
        // 判断用户输入的路径是否以 cli.bat / cli.js / cli.exe 结尾，如果是，则获取其父目录目录名
        const cliDir = normalized.endsWith('cli.bat') || normalized.endsWith('cli.js') || normalized.endsWith('cli.exe')
            ? path.dirname(normalized)
            : normalized
        
        const cliJs = path.join(cliDir, 'cli.js')
        const nodeExe = path.join(cliDir, 'node.exe')
        const cliBat = path.join(cliDir, 'cli.bat')

        // 优先使用工具自带的 node.exe 执行 cli.js 以获得更好的跨平台稳定性
        if (fs.existsSync(nodeExe) && fs.existsSync(cliJs)) {
            command = nodeExe
            args = [cliJs]
        } else if (fs.existsSync(cliBat)) {
            // 如果存在 cli.bat 批处理，则使用批处理启动
            command = cliBat
        }
    }
    return { command, args }
}

/**
 * 寻找包含 project.config.json 的小程序实际发布目录
 *
 * 在跨框架开发环境（如 uni-app 或 taro）下，编译出来的微信小程序产物可能并不直接在项目根目录下，
 * 而是被输出到了特定的子目录内。此函数会在多个可能的编译产物目录下检索，直到找到有效的 project.config.json。
 *
 * @param sourceDir 小程序源码根目录绝对路径
 * @param outputDir 用户手动指定的输出相对目录
 * @returns 返回最终包含 project.config.json 的项目实际绝对路径
 */
export function findProjectConfigDir(sourceDir: string, outputDir = ''): string {
    const { fs, path } = getTools() || {}
    if (!fs || !path) return sourceDir
    
    // 顺次尝试查找路径
    const pathsToTry = [
        sourceDir,                                       // 1. 项目根目录
        path.resolve(sourceDir, outputDir),              // 2. 用户自定义的产物输出目录
        path.resolve(sourceDir, 'dist/dev/mp-weixin'),   // 3. uni-app 开发版默认输出目录
        path.resolve(sourceDir, 'dist/build/mp-weixin')  // 4. uni-app 发行版默认输出目录
    ]
    for (const p of pathsToTry) {
        if (fs.existsSync(path.join(p, 'project.config.json'))) {
            return p
        }
    }
    return sourceDir
}

