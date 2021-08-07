# 介绍

阅读 vue 2.6.12 版本源码，作以记录

# 准备

## package.json

需要 package.json 中的 dev 指令后加 sourcemap, 方便我们直接看到未打包的源代码，否则就直接在 dist/vue 里直接跑，不利于我们理解代码结构

```
"dev": "rollup -w -c scripts/config.js --environment TARGET:web-full-dev --sourcemap"
```

继而直接命令行根目录直接执行 npm run dev，或者直接在 package.json 中 "scripts" 上边 debug 第一个命令

## launch.json

配置在 vscode 中调试，新建一个调试环境

```json
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "file": "${workspaceFolder}/examples/my-practice/index.html"
    }
  ]
}
```

可以直接在源码中打断点，run 起来在 vscode 中跑整个流程

也可以在浏览器打开我们的测试例子 examples/my-practice 里边的 index.html ，打开浏览器 console 就可以打断点了。


# 断点调试整个流程

可以配置你想要调试的 vue 功能，比如你想要了解响应式，那么就加入 data，然后按步骤看源码里 vue 怎么将拿到的 data 转换成响应式，又在挂载的过程中加入观察者，将其渲染到页面，后续对数据再做出改动，看又会触发哪些功能来实现数据的更新

又或者你想了解 vue 的指令，那么就可以直接写 v-for、v-model 等来进行调试

又或者想了解 vue 的组件，虚拟节点，那就可以写几个子组件，边调边看

下边给出一个例子

```js
// index.js

Vue.mixin({
  created() {
    console.log('parent created')
  }
})

let app = new Vue({
  el: '#app',
  delimiters: ['$[', ']'],
  components: {
    balance: {
      template: `
          <div>
            <show @show-balance="show_balance"></show>
            <div v-if="show">
              <ul>
                <li v-for="food in foodList" :key="food.name">$[food.name]：￥ $[food.price]</li>
              </ul>
            </div>
            <div><input v-model="text" /></div>
          </div> 
      `,
      methods: {
        show_balance: function (data) {
          this.show = !this.show
          console.log(data)
        }
      },
      data: function () {
        return {
          show: false,
          foodList: [{
              name: '葱',
              price: '10',
              discount: .8
            },
            {
              name: '姜',
              price: '8',
              discount: .6
            },
            {
              name: '蒜',
              price: '8',
              discount: null
            }
          ],
          logo: '查询菜单',
          text: ''
        }
      }
    },
    show: {
      template: `
          <button @click="on_click">$[logo]</button>
          <div>$[tips]</div>
      `,
      props: ['logo'],
      created() {
        console.log('lifecycle created')
        this.tips = '点击上方'
      },
      mounted() {
        console.log('mounted')
      },
      data() {
        return {
          tips: ''
        }
      },
      methods: {
        on_click() {
          // $emit 触发事件，传递数据
          this.$emit('show-balance', {
            bad: 1,
            ass: 2
          })
        }
      }
    }
  }
})
```

## init

我们将自己写的配置传入 Vue 函数后，下一步就进入到 Vue 的实例初始化阶段

```js
// core/instance/index.js

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
```

初始化阶段, 首先会合并传入的配置, 这里会进行判断，当前的实例是组件还是根实例，组件会在根实例处理 children 时被遍历，判断是组件了则会打上 `_isComponent` 标记，组件初始化时有组件的合并机制，根实例则有根实例的合并机制。

配置 proxy 代理环境，如果为开发环境则初始化一个代理，否则指向vue实例本身

接着保存当前的实例为 _self

之后就进入一连串的初始化，在 beforeCreate 之前，执行了 initLifecycle、initEvents、initRender 三者的初始化，具体可查看下一级标题；此前并没有初始化到数据内容 state，那么 beforeCreate 的钩子函数中就不能获取到 props、data 中定义的值，也不能调用 methods 中定义的函数。

在 beforeCreate 和 created 之间，初始化了 initInjections、initState、initProvide ，其中 provide/inject 需要一起使用，由祖先组件提供了一个 provide，provide 里的属性可供所有的后代组件通过 inject 注入并调用，具体可查看下一级标题；
那么此时 created 钩子函数就可以读取到 data、props、methods、computed 等属性；此外在这俩个钩子函数执行的时候，并没有渲染 DOM，所以不能够访问 DOM，一般来说，如果组件在加载的时候需要和后端有交互，放在这俩个钩子函数执行都可以


```js
// core/instance/init.js

Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    vm._isVue = true
    // merge options
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // vue 的构造器
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate')
    initInjections(vm) // resolve injections before data/props
    initState(vm) // 截至 created 函数前，vue 实例上的数据都准备好了
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created') // 此时执行 created 钩子函数，数据已准备好

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el) // 若当前组件参数中有节点，则执行挂载操作
    }
  }
```

### mergeOptions

此时走的流程是根实例合并配置，用 mergeOptions 将实例 vm 的构造函数的 options 和用户传入的 options 进行合并，首先会检查用户传入的配置中是否组件 components，有则继续确认组件的命名是否符合规范，那么我这里的两个组件 balance 和 show 都是没有问题滴

接着标准化根实例传入的 props、inject，directives；再将两者配置中的 extends、mixins 递归合并至 parent ，最后将 parent 和 child 各属性再合并在一起，返回 options 给 vm.$options


```js
// core/util/options.js

function mergeOptions (
  parent: Object, // Vue 构造函数的 option
  child: Object, // 用户传入的 option
  vm?: Component // vue 实例
): Object {
  if (process.env.NODE_ENV !== 'production') {
    checkComponents(child)
  }

  if (typeof child === 'function') {
    child = child.options
  }

  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // Apply extends and mixins on the child options,
  // but only if it is a raw options object that isn't
  // the result of another mergeOptions call.
  // Only merged options has the _base property.
  if (!child._base) {
    if (child.extends) {
      parent = mergeOptions(parent, child.extends, vm) // 递归将 extends 合并到 parent
    }
    if (child.mixins) {
      for (let i = 0, l = child.mixins.length; i < l; i++) {
        parent = mergeOptions(parent, child.mixins[i], vm) // 递归将 mixins 合并到 parent
      }
    }
  }

  // 将 parent 和 child 合并
  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  function mergeField (key) {
    const strat = strats[key] || defaultStrat
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}
```

### initProxy

配置 proxy 代理环境，如果为开发环境则初始化一个代理，否则指向vue实例本身；开发环境下若当前环境 proxy 可用，则根据 options 中是否配置 render 相关，来匹配给 vm 代理增加什么方法，在每次调用 vm 上的方法属性时，会依据此方法进行检测，不符合则会报错；若是当前环境不支持 proxy ，则直接令 _renderProxy 指向当前的实例 vm

其中 getHandler 方法，主要是针对读取代理对象的某个属性时进行的操作。当访问的属性不是string类型或者属性值在被代理的对象上不存在，则抛出错误提示。
hasHandler方法可以查看 vm 实例是否拥有某个属性 — 比如调用 for in 循环遍历 vm 实例属性时，会触发 hasHandler 方法，首先使用 in 操作符判断该属性是否在 vm 实例上存在，再通过 allowedGlobals 确定属性名称是否可用

```js
// core/instance/proxy.js

const hasProxy =
  typeof Proxy !== 'undefined' && isNative(Proxy)

if (hasProxy) {
  const isBuiltInModifier = makeMap('stop,prevent,self,ctrl,shift,alt,meta,exact')
  config.keyCodes = new Proxy(config.keyCodes, {
    set (target, key, value) {
      if (isBuiltInModifier(key)) {
        warn(`Avoid overwriting built-in modifier in config.keyCodes: .${key}`)
        return false
      } else {
        target[key] = value
        return true
      }
    }
  })
}

const hasHandler = {
  has (target, key) {
    const has = key in target
    const isAllowed = allowedGlobals(key) ||
      (typeof key === 'string' && key.charAt(0) === '_' && !(key in target.$data))
    if (!has && !isAllowed) {
      if (key in target.$data) warnReservedPrefix(target, key)
      else warnNonPresent(target, key)
    }
    return has || !isAllowed
  }
}

const getHandler = {
  get (target, key) {
    if (typeof key === 'string' && !(key in target)) {
      if (key in target.$data) warnReservedPrefix(target, key)
      else warnNonPresent(target, key)
    }
    return target[key]
  }
}

initProxy = function initProxy (vm) {
  if (hasProxy) {
    // determine which proxy handler to use
    const options = vm.$options
    const handlers = options.render && options.render._withStripped
      ? getHandler // 读取代理对象的某个属性
      : hasHandler // 查询代理对象的某个属性
    vm._renderProxy = new Proxy(vm, handlers)
  } else {
    vm._renderProxy = vm
  }
}
```

### initLifecycle

初始化 $parent, $root, $children, $refs, 当前根实例没有 $parent, 所以就记为实例本身，接着再初始化生命周期系列内部属性

```js
// core/instance/lifecycle.js

function initLifecycle (vm: Component) {
  const options = vm.$options

  // locate first non-abstract parent
  let parent = options.parent
  if (parent && !options.abstract) { // 如果存在父级
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent // 定位至第一个不抽象的父级
    }
    parent.$children.push(vm) // 将当前组件作为该父级的子级
  }

  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm // 如无父级，则组件的根级就是自己

  // 初始化组件的子级组、ref
  vm.$children = []
  vm.$refs = {}

  // 初始化生命周期系列内部属性
  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}
```

### initEvents

根实例没有什么变动，只是初始化了 _events、_hasHookEvent 两个属性

```js
// core/instance/events.js

function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}
```

### initRender

initRender 初始化做了一些虚拟节点相关的工作，初始化了 _vnode、 $vnode, $vnode 这里也指向 parentVnode , 代表当前实例虚拟节点的父级节点，由于当前实例为根实例，那么自然时不存在的；_vnode 则表示当前实例的根虚拟节点

接着 vm._c、vm.$createElement 是很重要的方法，createElement 方法用来创建 VNode

最后给当前根实例添加 $attrs、$listeners 两个响应式属性

```js
// core/instance/render.js

function initRender (vm: Component) {
  vm._vnode = null // the root of the child tree
  vm._staticTrees = null // v-once cached trees
  const options = vm.$options
  const parentVnode = vm.$vnode = options._parentVnode // the placeholder node in parent tree
  const renderContext = parentVnode && parentVnode.context
  vm.$slots = resolveSlots(options._renderChildren, renderContext)
  vm.$scopedSlots = emptyObject
  // bind the createElement fn to this instance
  // so that we get proper render context inside it.
  // args order: tag, data, children, normalizationType, alwaysNormalize
  // internal version is used by render functions compiled from templates
  vm._c = (a, b, c, d) => createElement(vm, a, b, c, d, false)
  // normalization is always applied for the public version, used in
  // user-written render functions.
  vm.$createElement = (a, b, c, d) => createElement(vm, a, b, c, d, true)

  // $attrs & $listeners are exposed for easier HOC creation.
  // they need to be reactive so that HOCs using them are always updated
  const parentData = parentVnode && parentVnode.data

  /* istanbul ignore else */
  if (process.env.NODE_ENV !== 'production') {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$attrs is readonly.`, vm)
    }, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, () => {
      !isUpdatingChildComponent && warn(`$listeners is readonly.`, vm)
    }, true)
  } else {
    defineReactive(vm, '$attrs', parentData && parentData.attrs || emptyObject, null, true)
    defineReactive(vm, '$listeners', options._parentListeners || emptyObject, null, true)
  }
}
```

### __beforeCreate__

### initInjections

在初始化 data/props 之前被调用，对 inject 属性中的各个key进行遍历，然后沿着父组件链一直向上查找 provide 中和 inject 对应的属性，直到查找到根组件或者找到为止，然后返回结果。

```js
// core/instance/inject.js

function initInjections (vm: Component) {
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    const result = Object.create(null)
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      const provideKey = inject[key].from
      let source = vm
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      if (!source) {
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
```

### initState

initState 初始化了传入的配置 props、methods、data、computed、watch ，在此之后就算实例创建完成，可以调用这些属性

在初始化生命周期 initLifecycle 时，给 vm 增加了 watcher ，此时初始化 state 时，新增 _watchers ，表示实例下的观察者组

```js
// core/instance/state.js

function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options // 外界传入值的一些初始化
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) { // 有就初始化，没有先观察，看外界传入不传入
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}
```

#### initProps


```js
function initProps (vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (!isRoot && !isUpdatingChildComponent) {
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      defineReactive(props, key, value)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}
```

#### initMethods


#### initData


#### initComputed


#### initWatch



### initProvide

provide 初始化只是将当前实例上 $options 的 provide 保存在 vm._provided

```js
// core/instance/provide.js

function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}
```

### __created__