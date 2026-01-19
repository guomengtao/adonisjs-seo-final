/*
|--------------------------------------------------------------------------
| Ace entry point
|--------------------------------------------------------------------------
| The "console.ts" file is the entrypoint for booting the AdonisJS
| command-line framework and executing commands.
| Commands do not boot the application, unless the currently running command
| has "options.startApp" flag set to true.
|*/

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import http from 'http'

// 启动一个虚假的 Web 服务，专门给 HF 的健康检查看
const server = http.createServer((_req, res) => {
  res.write('I am alive and processing data...')
  res.end()
})

server.listen(7860, () => {
  console.log('🚀 HF 的健康检查已启动，开始处理 2.6 万条数据...')
}).on('error', (err: Error & { code?: string }) => {
  if (err.code === 'EADDRINUSE') {
    console.log('🚀 HF 的健康检查服务已在运行中，继续处理 2.6 万条数据...')
  } else {
    console.error('❌ 启动 HF 健康检查服务失败:', err)
  }
})

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .ace()
  .handle(process.argv.splice(2))
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })