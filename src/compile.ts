import type { BuildOptions } from './types'
import { getTools } from './utils'

/**
 * 自动化执行小程序构建命令
 * 
 * 通过调用底层 spawn API 唤起一个系统 shell 进程，在小程序源码目录内执行构建指令
 * （例如 `npm run build:mp-weixin`），并通过回调函数将控制台的标准输出与标准错误流式重定向。
 *
 * @param options 构建配置参数，见 BuildOptions 接口
 * @returns 返回一个 Promise，构建成功且退出码为 0 时 resolve(true)，其他失败情况 resolve(false)
 */
export async function compileMp(options: BuildOptions): Promise<boolean> {
    const { spawn } = getTools() || {}
    if (!spawn) {
        throw new Error('System spawn API is not available')
    }

    const { buildCommand, sourceDir, onStdout, onStderr, onProcessStarted } = options

    return new Promise<boolean>((resolve) => {
        try {
            // 唤起子进程执行打包命令
            const child = spawn(buildCommand, {
                cwd: sourceDir,
                shell: true,          // 启用 shell 环境以兼容用户配置的复杂 npm scripts
                windowsHide: true     // 在 Windows 下隐藏子进程的 CMD 弹窗
            })
            
            // 如果上层提供了回调，则将子进程句柄传回（用于任务手动取消时杀死进程）
            onProcessStarted?.(child)

            // 流式接收标准输出并触发 stdout 回调
            child.stdout?.on('data', (chunk: any) => {
                const output = chunk.toString('utf8').trim()
                if (output) onStdout?.(output)
            })

            // 流式接收标准错误并触发 stderr 回调
            child.stderr?.on('data', (chunk: any) => {
                const output = chunk.toString('utf8').trim()
                if (output) onStderr?.(output)
            })

            // 监听进程启动错误
            child.on('error', (err: any) => {
                onStderr?.(`构建出错: ${err.message || err}`)
                resolve(false)
            })

            // 监听进程结束事件
            child.on('close', (code: number) => {
                if (code === 0) {
                    onStdout?.('构建成功！')
                    resolve(true)
                } else {
                    onStderr?.(`构建失败，退出码: ${code}`)
                    resolve(false)
                }
            })
        } catch (e: any) {
            onStderr?.(`启动构建命令失败: ${e.message || e}`)
            resolve(false)
        }
    })
}

