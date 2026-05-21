import type { OpenDevtoolsOptions } from './types'
import { getTools, resolveWechatCli, findProjectConfigDir } from './utils'

/**
 * 自动化拉起微信开发者工具打开小程序项目
 * 
 * 唤起本地已安装的微信开发者工具，并自动挂载/打开当前编译出来的微信小程序项目
 *
 * @param options 打开开发者工具选项，见 OpenDevtoolsOptions 接口
 */
export async function openDevtools(options: OpenDevtoolsOptions): Promise<void> {
    const { spawn } = getTools() || {}
    const { wxDevtoolsPath, sourceDir, outputDir, onProgress } = options

    const log = (level: 'info' | 'success' | 'warning' | 'error', msg: string) => onProgress?.(level, msg)

    if (!wxDevtoolsPath) {
        log('warning', '未配置微信开发者工具 CLI 路径，无法自动打开开发者工具。请在右上角“全局设置”中配置。')
        return
    }

    const projectPath = findProjectConfigDir(sourceDir, outputDir)
    
    log('info', `正在通过 CLI 打开微信开发者工具...`)
    log('info', `开发者工具打开目录: ${projectPath}`)
    log('warning', `提示：如果工具未能开启，请确保微信开发者工具内“设置 -> 安全设置 -> 服务端口”已保持开启！`)

    if (!spawn) return

    try {
        const { command, args: baseArgs } = resolveWechatCli(wxDevtoolsPath)
        const args = [...baseArgs, 'open', '--project', projectPath]

        log('info', `执行命令: ${command} ${args.join(' ')}`)

        const child = spawn(command, args, {
            shell: command.endsWith('.bat') || command.endsWith('.cmd'),
            windowsHide: true
        })

        child.stdout?.on('data', (chunk: any) => {
            const output = chunk.toString('utf8').trim()
            if (output) log('info', `[微信工具] ${output}`)
        })

        child.stderr?.on('data', (chunk: any) => {
            const output = chunk.toString('utf8').trim()
            if (output) log('warning', `[微信工具] ${output}`)
        })

        child.on('error', (err: any) => {
            log('error', `启动微信开发者工具失败: ${err.message || err}`)
        })
    } catch (e: any) {
        log('error', `启动微信开发者工具失败: ${e.message || e}`)
    }
}
