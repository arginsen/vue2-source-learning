/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 先保留挂载方法 - 原型
const mount = Vue.prototype.$mount
// 对挂载方法拦截加入编译处理 temlpate => render，再调用 mount 执行挂载；可对比只有运行时的版本
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options // 为合并后的配置项
  // resolve template/el and convert to render function
  if (!options.render) {
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      // compileToFunctions 函数由 ./compiler/index 文件 createCompiler(baseOptions) 执行返回的对象中获取
      // baseOptions 作为基本编译配置被传入到 compiler/index 文件中 createCompiler = createCompilerCreator(baseCompile) 函数执行后返回的函数中
      // 也就是 createCompilerCreator 以 baseCompile 函数为参数执行 , 返回的函数被传入之前的配置 baseOptions , 后赋值给 createCompiler 函数
      // createCompiler 函数内定义的 compile 函数使用 baseCompile 函数来进行编译 , 并将结果返回
      // createCompiler 函数再将 compile 函数与 createCompileToFunctionFn(compile) 的执行结果 compileToFunctions 打包成对象一并返回
      // 而此处调用的 compileToFunctions 实际上就是 createCompileToFunctionFn(compile) 执行返回的同名函数 compileToFunctions , 接收以下三个参数
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this) // 传入编译的配置
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions // 保存编译函数到 Vue 构造函数上

export default Vue
