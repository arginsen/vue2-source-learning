import attrs from './attrs'
import klass from './class'
import events from './events'
import domProps from './dom-props'
import style from './style'
import transition from './transition'

// 平台的一些模块，它们会在整个 patch 过程的不同阶段执行相应的钩子函数
export default [
  attrs,
  klass,
  events,
  domProps,
  style,
  transition
]
