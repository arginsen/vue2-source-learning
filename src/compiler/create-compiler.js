/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

// 定义的函数 createCompilerCreator(baseCompile) 返回 createCompiler(baseOptions) 函数
// createCompiler 继续返回一个对象，包含 [其内定义的 compile 函数] 以及 [createCompileToFunctionFn(compile) 执行结果 compileToFunctions ]
export function createCompilerCreator (baseCompile: Function): Function { // 创建一个编译器构造器，用于传递
  return function createCompiler (baseOptions: CompilerOptions) {
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      const finalOptions = Object.create(baseOptions) // 创建 finalOptions 用来合并 base 的和挂载时传入的 options
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      if (options) {
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules) // 合并 baseOptions x options 里模块部分
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend( //  // 合并 baseOptions x options 里指令部分
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        for (const key in options) { //  // 合并 options 里其他配置
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn

      // 实际进行编译的步骤 ，此时 finalOptions 为最终的编译配置
      const compiled = baseCompile(template.trim(), finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        detectErrors(compiled.ast, warn)
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
