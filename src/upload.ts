import type { UploadOptions } from './types'
import { getTools, resolveWechatCli, findProjectConfigDir } from './utils'

/**
 * 微信小程序发布/上传入口函数
 * 
 * 整合并支持两种主流的微信小程序代码包上传发布模式：
 * 1. CLI 模式：通过启动本地安装的“微信开发者工具”提供的命令行工具进行上传。
 * 2. CI 模式：利用官方 `miniprogram-ci` 库，在不依赖微信开发者工具图形界面的情况下，使用上传密钥进行完全静默上传。
 * 
 * @param options 上传配置选项，见 UploadOptions 接口
 * @returns 返回一个 Promise，成功上传返回 true，失败返回 false
 */
export async function uploadMp(options: UploadOptions): Promise<boolean> {
    const { spawn, fs, path, getRemote } = getTools() || {}
    if (!spawn || !fs || !path) {
        throw new Error('System APIs are not available')
    }

    const {
        uploadMethod,
        sourceDir,
        outputDir,
        appid,
        name,
        version,
        desc,
        cred,
        settings,
        onProgress,
        onProcessStarted
    } = options

    // 辅助日志输出封装
    const log = (level: 'info' | 'success' | 'warning' | 'error', message: string) => {
        onProgress?.(level, message)
    }

    // 自动定位包含 project.config.json 的小程序真实输出发布目录
    const projectPath = findProjectConfigDir(sourceDir, outputDir)

    // ==========================================
    // 方式一：微信开发者工具 CLI 上传模式
    // ==========================================
    if (uploadMethod === 'cli') {
        const cli = settings.wxDevtoolsPath
        if (!cli) {
            log('error', '未配置微信开发者工具 CLI 路径，请在右上角“全局设置”中配置后再试。')
            return false
        }

        // 解析出可执行命令与基础参数
        const { command, args: baseArgs } = resolveWechatCli(cli)
        const args = [
            ...baseArgs,
            'upload',
            '--project', projectPath,
            '--version', version,
            '--desc', desc,
            '--lang', 'zh'
        ]

        log('info', `正在通过 CLI 上传小程序...`)
        log('info', `上传命令: ${command} ${args.join(' ')}`)
        log('warning', `提示：如果上传无响应或失败，请确保微信开发者工具内“设置 -> 安全设置 -> 服务端口”已保持开启！`)

        return new Promise<boolean>((resolve) => {
            try {
                // 唤起微信开发者工具命令行进程进行上传
                const child = spawn(command, args, {
                    shell: command.endsWith('.bat') || command.endsWith('.cmd'),
                    windowsHide: true
                })
                
                onProcessStarted?.(child)

                // 流式重定向微信工具的日志输出并美化特定的进度词汇
                child.stdout?.on('data', (chunk: any) => {
                    let output = chunk.toString('utf8').trim()
                    if (output) {
                        output = output.replace(/- 上传/g, '- 上传中')
                        log('info', `[微信工具] ${output}`)
                    }
                })

                child.stderr?.on('data', (chunk: any) => {
                    let output = chunk.toString('utf8').trim()
                    if (output) {
                        output = output.replace(/- 上传/g, '- 上传中')
                        log('warning', `[微信工具] ${output}`)
                    }
                })

                child.on('error', (err: any) => {
                    log('error', `上传启动失败: ${err.message || err}`)
                    resolve(false)
                })

                child.on('close', (code: number) => {
                    if (code === 0) {
                        log('success', `上传微信后台成功！`)
                        resolve(true)
                    } else {
                        log('error', `上传失败，退出码: ${code}`)
                        resolve(false)
                    }
                })
            } catch (e: any) {
                log('error', `启动上传失败: ${e.message || e}`)
                resolve(false)
            }
        })
    } 

    // ==========================================
    // 方式二：API 静默上传模式 (miniprogram-ci)
    // ==========================================
    log('info', `正在通过 API (miniprogram-ci) 上传...`)
    const credentials = cred as any
    
    if (!credentials.privateKeyPath && !credentials.privateKeyContent) {
        log('error', 'API 上传缺少私钥文件或私钥内容，请在编辑中配置。')
        return false
    }

    const outputPath = path.resolve(sourceDir, outputDir || '')
    if (!fs.existsSync(outputPath)) {
        log('error', `上传产物目录不存在：${outputPath}，请检查构建命令或输出路径设置。`)
        return false
    }

    // 创建临时目录用来隔离并安全组装即将上传的代码和修改后的 project.config.json
    const remote = getRemote?.()
    const tempRoot = path.join(remote?.app?.getPath('temp') || '', 'mp-upload', `${appid}-${Date.now()}`)
    const workerConfigPath = path.join(remote?.app?.getPath('temp') || '', `ci-upload-${appid}-${Date.now()}.json`)

    try {
        if (fs.existsSync(tempRoot)) {
            fs.rmSync(tempRoot, { recursive: true, force: true })
        }
        fs.mkdirSync(tempRoot, { recursive: true })

        log('info', `准备上传临时项目...`)
        // 使用 Node.js 原生的 fs.cpSync 进行快速递归复制目录
        fs.cpSync(outputPath, tempRoot, { recursive: true })

        // 读取、重写并规整临时目录下的 project.config.json，填入动态 AppID 并关闭不需要的本地编译项
        const configPath = path.join(tempRoot, 'project.config.json')
        const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {}
        config.appid = appid
        config.projectname = name
        config.compileType = config.compileType || 'miniprogram'
        config.setting = {
            ...config.setting,
            urlCheck: false,
            es6: false,
            es7: false,
            postcss: false,
            minified: false,
            minify: false,
            minifyJS: false,
            minifyWXML: false,
            minifyWXSS: false,
            autoPrefixWXSS: false,
            compileWorklet: false,
            enhance: false,
            swc: false,
            useCompilerPlugins: false
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

        // 定位 miniprogram-ci.cjs 辅助脚本路径
        const possiblePaths = [
            path.join(process.cwd(), 'packages', 'hlw-ele-mp-wx', 'scripts', 'miniprogram-ci.cjs'),
            path.join(process.cwd(), 'resources', 'app.asar.unpacked', 'packages', 'hlw-ele-mp-wx', 'scripts', 'miniprogram-ci.cjs'),
            path.join(process.cwd(), 'resources', 'app.asar', 'packages', 'hlw-ele-mp-wx', 'scripts', 'miniprogram-ci.cjs'),
            path.join(process.cwd(), 'scripts', 'miniprogram-ci.cjs')
        ]
        
        let scriptPath = ''
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                scriptPath = p
                break
            }
        }

        if (!scriptPath) {
            log('error', `CI 脚本不存在，已尝试路径:\n${possiblePaths.join('\n')}`)
            return false
        }

        // 拼装临时 CI 任务参数文件并写入本地，规避进程参数传递过长或敏感信息泄露的问题
        const workerConfig = {
            appid,
            projectPath: tempRoot,
            privateKeyPath: credentials.privateKeyPath || '',
            privateKeyContent: credentials.privateKeyContent || '',
            version,
            desc
        }
        fs.writeFileSync(workerConfigPath, JSON.stringify(workerConfig), 'utf8')

        log('info', `正在使用 miniprogram-ci 发起 API 上传...`)
        return new Promise<boolean>((resolve) => {
            try {
                // 调用 Node.js 后台执行脚本，执行 miniprogram-ci 上传
                const child = spawn('node', [scriptPath, workerConfigPath], {
                    cwd: process.cwd(),
                    windowsHide: true
                })
                
                onProcessStarted?.(child)

                // 接收 CI 脚本的标准输出，并解析为进度消息或结果
                child.stdout?.on('data', (chunk: any) => {
                    const text = chunk.toString('utf8').trim()
                    if (!text) return
                    try {
                        const msg = JSON.parse(text)
                        if (msg.type === 'progress') {
                            log('info', `${msg.payload.message || msg.payload.status}`)
                        } else if (msg.type === 'done') {
                            log('success', `CI 上传微信后台成功！`)
                        } else if (msg.type === 'error') {
                            log('error', `CI 上传失败: ${msg.payload.message || JSON.stringify(msg.payload)}`)
                        }
                    } catch {
                        log('info', `[CI] ${text}`)
                    }
                })

                child.stderr?.on('data', (chunk: any) => {
                    const text = chunk.toString('utf8').trim()
                    if (text) log('warning', `[CI] ${text}`)
                })

                child.on('error', (err: any) => {
                    log('error', `CI 执行进程启动失败: ${err.message || err}`)
                    resolve(false)
                })

                child.on('close', (code: number) => {
                    // 进程结束时清理临时配置文件与项目包
                    try { fs.unlinkSync(workerConfigPath) } catch {}
                    try { fs.rmSync(tempRoot, { recursive: true, force: true }) } catch {}
                    resolve(code === 0)
                })
            } catch (err: any) {
                log('error', `CI 执行启动出错: ${err.message || err}`)
                resolve(false)
            }
        })
    } catch (err: any) {
        log('error', `CI 准备过程出错: ${err.message || err}`)
        try { fs.unlinkSync(workerConfigPath) } catch {}
        try { fs.rmSync(tempRoot, { recursive: true, force: true }) } catch {}
        return false
    }
}

