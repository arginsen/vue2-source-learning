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

```html
<div id="app">
  <div :class="class" @click="update">$[sum]</div>
  <balance></balance>
</div>
```

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
  },
  watch: {
    sum(val) {
      console.log('the newVal of sum is' + val)
    }
  },
  data() {
    return {
      class: 'date',
      base: 10
    }
  },
  computed: {
    sum() {
      return this.base * 10
    }
  },
  methods: {
    update() {
      this.base += 10
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

最后判断 vm.$options 配置上是否存在 el 属性，如有，则执行挂载操作。此 el 也就是我们例子中实例所配置的元素标签，而在组件中是不存在的，因为最后组件都会整合到实例上，一起挂载到 `#app` 上

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

如果用户传入了相关的配置，那么就会对响应的配置初始化，在处理数据 data 时，如果有传入，那么就按初始化走，如果没有，则直接将 vm._data 响应式化，也是作为根节点的数据

期间 props、data、computed、watch 均做了响应式处理

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

初始化 props

```js
// core/instance/state.js

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

初始化 methods, 先获取当前实例组件下的方法是否与 props 传入的变量同名，再检测该方法是否为函数，再检测该命名的方法是否与 Vue 实例固有的方法名冲突；若无问题，则将该方法直接挂载在当前实例下

```js
// core/instance/state.js

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[key]}" in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}
```

#### initData

初始化数据，这里在会判断当前实例是否定义了 data, 若无则初始化 _data 为一个空对象, 并使其响应式，标记为根数据；

若当前实例定义了 data, 则走 initData 流程, 判断 data 属性是一个函数, 还是一个对象, 若为函数，则通过 getData 获取函数的返回值，我们知道，data 一般都写成函数返回一个数据对象，所有 getData 做的工作即是将 data 的这个函数指向当前实例 vm , 再将结果返回到 vm._data ; 若 data 是个对象，那就直接返回 data（见下一级分析）

接着再检查返回的 data 是否是一个对象，如不是则抛出警告；

获取定义的 data 中的属性，与当前实例的 methods 的变量名进行比较，有冲突就警告；再与 props 进行检查，确保没有冲突变量；最后检测该 data 属性是否为 Vue 已有的变量名，如不是则对 vm._data 下新增该变量的代理，设置 _data 属性下获取各数据的 get 和 set 规则

注意上方是对 data 内的各个属性读写做了设定，在处理完这些后，调用 observe 将 _data 做响应式，同时设定为根数据，observe 走的即是响应式流程。（见下一级分析）

```js
// core/instance/state.js

function initData (vm: Component) {
  let data = vm.$options.data
  data = vm._data = typeof data === 'function' // 定义 data 必须为一个函数
    ? getData(data, vm)
    : data || {}
  if (!isPlainObject(data)) {
    data = {}
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key) // 在 Vue 下新增 _data 保存数据，并对该属性做响应式处理
    }
  }
  // observe data
  observe(data, true /* asRootData */) // 对数据本身做响应式处理
}
```

##### getData

可以看到 data 本身被定义为一个函数，该函数根据有无实例 vm 又返回 mergeDataOrFn 函数的执行结果，而 mergeDataOrFn 进一步根据有无实例，有无父子值返回不同的结果，在此是返回 mergedInstanceDataFn 函数，所以 data 函数本质上就是 mergedInstanceDataFn 函数；再将实例数据与默认数据合并后返回，默认数据是 parentVal 传入的值。

```js
// core/util/options.js

strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn(parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

// mergeDataOrFn
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this, this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this, this) : parentVal
      )
    }
  } else {
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function' // 获取实例的数据
        ? childVal.call(vm, vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm, vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}
```

##### observe

补充下上边的 observe 方法，这里是对实例传入的 data(也就是vm._data) 做响应式，首先判断 _data 上是否存在 `__ob__` 标识，有就说明已经响应式处理过了；

没有的话就接着判断是否满足创建 Observer 的条件，如 data 需要是对象、数组，是否是服务端渲染，是否应该响应式，该数据不是 vue 等，满足后创建一个新的 Observer 实例；

每个 Observer 也会对应一个依赖收集器 dep；接着给 data 对象添加 `__ob__` 属性，并将当前的 Observer 实例赋值给它；

接着判断当前响应式的对象 data 是数组还是对象，采用不同的方法进行响应式处理：

如是数组，再判断浏览器是否支持原型 `__proto__`，重新定义下数组原型增删排序等方法，如果数组中增加了数据，遍历新增的数据进行响应式处理（元素级别），在数组改变后调用 notify 方法 通知 Watcher 去更新视图；处理完数组原型上原有问题后，再调用 observeArray 方法对数组中的每个元素继续进行 observe 响应式处理。

如果是对象，则调用 walk 继续遍历每个属性用 defineReactive 进行响应式处理, 继续对每个属性创建自己的依赖收集器 dep，再递归调用 observe 看每个属性下是否还有子属性是对象或者数组，都给进行响应式处理，最后对象用 defineProperty 来实现具体的响应式更新，利用 defineProperty 给当前对象的某个属性限定其 get 和 set，一般在有 观察者 watcher 的情况下，获取 data 某个属性的值便会触发依赖收集，将当前的 watcher 放入依赖收集器，返回当前值；再在下次改动该值的情况下触发 notify 来通知各个观察者去修改对应的值

见下方定义：

```js
// core/observer/index.js
 
export function observe (value: any, asRootData: ?boolean): Observer | void {
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value) // 给数据新建响应式处理
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}
```

响应式时对数据中的数组和对象分别做了不同的处理，对象我们自然清楚，递归处理直到当前对象下没有子对象了，用 Object.defineProperty 来完成响应式的配置

那么对于数组的情况，想要控制到数组中每个元素的变动能响应式，数组并不能像对象那样拦截属性，因此只能在一些增删减排的操作中获取变动元素来处理其响应式，接着对变动的元素用 observeArray 处理，接着通知观察者更新

下边是对数组方法修改：

```js
// core/observer/array.js

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator (...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})
```

#### initComputed

初始化 vm._computedWatchers ，判断用户定义的计算属性是否为一个函数，采用不同的处理方式；再判断是不是服务端渲染期间，若是在此期间 computed 仅为一个 getter ，不是的话将会为当前计算属性创建一个观察者 watcher 挂载在 _computedWatchers 下。

接着会进入到 defineComputed ，与是否 ssr 相反来定义 shouldCache ， 判断用户定义的计算属性是否为函数，按 shouldCache 的布尔值来确定下一步，当前为 true ，则执行 createComputedGetter 返回 computedGetter 函数，通过观察者来获取该计算属性的值

当然我们在实际应用中也可以不设置为单纯的函数，可以拆成 set 和 get 来写，这样的话此处将会走另一种处理，set 为用户自定义的 set，get 则首先判断有没有，没有则默认 noop，有则进一步判断 shouldCache 和 userDef.cache 来确定使用何种方法的 get

随后对 set 进行拦截，set 是否是 noop，提示计算属性不能设置 set；接着将配置好的 get、set 传入 Object.defineProperty 对具体的计算属性进行限定

```js
// core/instance/state.js

function initComputed (vm: Component, computed: Object) {
  // $flow-disable-line
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  for (const key in computed) {
    const userDef = computed[key]
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

// defineComputed
export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  const shouldCache = !isServerRendering()
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}
```

#### initWatch

初始化用户书写的 watch , 判断我们写的 watch 下的变量是不是数组，如不是则直接创建 watcher，如是则遍历数组给每个元素都执行 createWatcher

接着判断是不是对象，是不是字符串，进行相应处理；最后返回 $watch 方法处理该观察的变量和操作的结果

在初始化 Vue 的 stateMixin 阶段，给 Vue 的原型上挂载了 $watch 方法

$watch 先判断用户定义的操作是否是个对象，如是则执行 createWatcher ，接着创建观察者 watcher，被观察的对象就是 watch 里写的变量，回调就是用户的操作，当该变量发生改变的时候，会通知各观察者更新变量，执行回调。

创建这个观察者时，会读取这个变量的值，此时的依赖收集目标 Dep.target 就是当前这个观察者；而例子中我们使用的是计算属性 sum，计算属性在上一步已经进行响应式处理，那么此时读取 sum 也会进入相应被拦截的步骤，在 get 计算属性时，又会将计算属性对应的观察者作为全局的 Dep.target , 然后观察者会将当前的依赖 dep 收集起来，同时将当前观察者添加到 dep.subs，并返回计算属性 sum 的值，此时弹出当前的 Dep.target，清除掉依赖收集；

那么此时 Dep.target 又回到 watch 对应的观察者，接着又将当前的依赖（该依赖与上个依赖一样，均是 sum 这个被观察者）进行收集，同时将观察者添加到 subs，那么此时该依赖下 subs 就有了两个观察者，
弹出当前的 Dep.target，清除掉当前的 deps，并返回获得的 sum 值。

如果 watch 的配置有 options.immediate，那么立刻触发当前的回调。最终 $watch 方法返回 unwatchFn 函数待执行，执行的过程即是将刚创建的 watcher 给 teardown 掉，也就是从实例下的 _watchers 中移除掉当前观察者，并且从各依赖收集器 dep 绑定的 subs 中移除

此时初始化 watch 就完成了

```js
// core/instance/state.js

function initWatch (vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

// createWatcher
function createWatcher (
  vm: Component,
  expOrFn: string | Function,
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}
```

```js
// core/instance/state.js

Vue.prototype.$watch = function (
  expOrFn: string | Function,
  cb: any,
  options?: Object
): Function {
  const vm: Component = this
  if (isPlainObject(cb)) {
    return createWatcher(vm, expOrFn, cb, options)
  }
  options = options || {}
  options.user = true
  const watcher = new Watcher(vm, expOrFn, cb, options)
  if (options.immediate) {
    try {
      cb.call(vm, watcher.value)
    } catch (error) {
      handleError(error, vm, `callback for immediate watcher "${watcher.expression}"`)
    }
  }
  return function unwatchFn () {
    watcher.teardown()
  }
}
```

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



## compile

在 init 的最后，会进入挂载阶段，倘若有定义 el ，那么就会执行挂载操作，对于组件则会直接跳过

```js
if (vm.$options.el) {
  vm.$mount(vm.$options.el) // 若当前组件参数中有节点，则执行挂载操作
}
```

### mount -- with compiler

由于这里跑的的 web-full-dev , 所以会有编译过程。这里的编译过程是拦截 mount 方法，在得到编译方法后挂载在 options 上再调用原来的 mount 方法执行真正的挂载过程

首先是查询传入的挂载点 el ，允许用户直接传入 dom 节点，如果传入的是字符串，那么就是获取 dom 节点再返回；接着排除掉 body 和 html 节点

接着检测用户是否有写入 render ，倘若有 render 则直接执行挂载操作；倘若无，
再判断用户是否有直接写入 template ，再判断 template 是否是字符串，或者 template 是有 nodeType 属性的，那就说明 template 直接是个 dom，这时获取 innerHTML ，或者传入无效的 template 就直接抛出警告；若用户没有写入 template ，那么就直接令 template 等于 el的 outerHtml，这个也没有就只能创建个 div 了

那么经上，template 便准备好了，接着提取 render, staticRenderFns 两个方法，绑在 Vue 的 $options 上

至此编译初始化就走完了，最后再用开头保存的原本 mount 进行挂载

```js
// platforms/web/entry-runtime-with-compiler.js

const mount = Vue.prototype.$mount

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
      // baseOptions 作为基本编译配置被传入到 compiler/index 文件中 createCompiler = createCompilerCreator(baseCompile) 函数执行后返回的 createCompiler 函数中
      // 也就是 createCompilerCreator 以 baseCompile 函数为参数执行 , 返回的函数被传入之前的配置 baseOptions , 后赋值给 createCompiler 函数

      // createCompiler 函数内定义的 compile 函数使用 baseCompile 函数来进行编译 , 并将结果返回
      // createCompiler 函数再将 compile 函数与 createCompileToFunctionFn(compile) 的执行结果 compileToFunctions 打包成对象一并返回
      // 而此处调用的 compileToFunctions 实际上就是 createCompileToFunctionFn(compile) 执行返回的同名函数 compileToFunctions , 接收以下三个参数
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters, // Vue 实例的配置
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
```

### 编译方法加载过程

#### compileToFunctions <- createCompiler

获取编译方法的过程比较复杂，被封装了很多层，主要针对不同的运行环境，浏览器、服务端，会有不同的编译参数配置，但也提取出了公共的部分，以此做到各自分离

首先来看，调用的 compileToFunctions 方法是从 './compiler/index' 当前目录下编译目录导入的，如下：

而此处的 baseOptions 也是 web 端对应的编译配置，被传入 createCompiler 

```js
// platforms/web/compiler/index.js

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
```

#### createCompiler <- createCompilerCreator

接着来看这个方法, 来自通用的编译方法 'compiler/index', 这里查看导入的路径很重要，因为断点会直接执行到 return 返回的函数中

可以看到，这里的 createCompiler 函数是 createCompilerCreator 函数传入 baseCompile 函数后执行返回的函数

而此处需要注意的是，baseCompile 函数是编译的关键步骤，涉及模板的解析，优化，最终生成代码

```js
// compiler/index.js

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options) // 将属性，标签解析出，生成 AST 树
  if (options.optimize !== false) {
    optimize(ast, options) // 优化语法树
  }
  const code = generate(ast, options) // 生成代码
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
```

#### createCompilerCreator

首先可以注意到 createCompilerCreator 函数接受 baseCompile 函数执行后返回的就是上一级 createCompiler 函数；

而 createCompiler 函数其内则将 基本的编译配置 baseOptions 合并后联通 template 传入 baseCompile 函数进行实质上的编译

最终 createCompiler 函数返回的对象就有我们一开始看到的 compileToFunctions ，而这个函数实际上又是 createCompileToFunctionFn 函数传入 createCompiler 内定义的 compile 函数执行后返回的函数

```js
// compiler/create-compiler.js
import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

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
```

#### createCompileToFunctionFn

该函数返回的 compileToFunctions 便是我们编译的开始，核心也就是 compile 执行的步骤，给 compile 传入的 options 会与之前 createCompiler 函数传入 baseOptions 合并形成最终的编译配置项，再由 baseCompile 来完成编译

```js
// compiler/to-function.js

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

// 定义了 createCompileToFunctionFn(compile) 函数，返回 compileToFunctions 函数，在 $mount 时被调用
export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)

  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = extend({}, options) // 将 options 的属性混入一个空对象
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // compile
    const compiled = compile(template, options) // 将模板与编译配置传入 compile 函数

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
              generateCodeFrame(template, e.start, e.end),
              vm
            )
          })
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
            compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
            vm
          )
        }
      }
      if (compiled.tips && compiled.tips.length) {
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm))
        } else {
          compiled.tips.forEach(msg => tip(msg, vm))
        }
      }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    return (cache[key] = res)
  }
}
```

### compileToFunctions

接上编译过程，执行到 compileToFunctions ，传入 template、编译配置、Vue

compileToFunctions 在得到生成的代码 render 后，又将代码转换为 函数与 staticRenderFns 合并为对象保存在缓存 cache 里并返回

```js
const { render, staticRenderFns } = compileToFunctions(template, {
  outputSourceRange: process.env.NODE_ENV !== 'production',
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref,
  delimiters: options.delimiters, // Vue 实例的配置
  comments: options.comments
}, this) // 传入编译的配置
options.render = render
options.staticRenderFns = staticRenderFns
```

再来看 compileToFunctions 方法

首先将传入的 options 保存, 再将模板与编译配置传入 compile 函数，结果保存为 compiled

```js
// compiler/to-function.js

export function createCompileToFunctionFn (compile: Function): Function {
  const cache = Object.create(null)

  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    options = extend({}, options) // 将 options 的属性混入一个空对象
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // compile
    const compiled = compile(template, options) // 将模板与编译配置传入 compile 函数

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        if (options.outputSourceRange) {
          compiled.errors.forEach(e => {
            warn(
              `Error compiling template:\n\n${e.msg}\n\n` +
              generateCodeFrame(template, e.start, e.end),
              vm
            )
          })
        } else {
          warn(
            `Error compiling template:\n\n${template}\n\n` +
            compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
            vm
          )
        }
      }
      if (compiled.tips && compiled.tips.length) {
        if (options.outputSourceRange) {
          compiled.tips.forEach(e => tip(e.msg, vm))
        } else {
          compiled.tips.forEach(msg => tip(msg, vm))
        }
      }
    }

    // turn code into functions
    const res = {}
    const fnGenErrors = []
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    return (cache[key] = res)
  }
}
```

### compile

将 baseOptions 和 options 合并为 finalOptions ，将 template 和 finalOptions 传入 baseCompile 进行编译

```js
// compiler/create-compiler.js

function compile (
  template: string,
  options?: CompilerOptions
): CompiledResult {
  const finalOptions = Object.create(baseOptions) // 以 baseOptions 为原型创建 finalOptions
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
```

注意是以 baseOptions 为原型创建 finalOptions, finalOptions 再与 options 进行合并，所以合并后 baseOptions 的配置方法参数等会在 finalOptions 的原型中, 最终 finalOptions 如下

```js
finalOptions 
  comments:undefined
  delimiters:(2) ['$[', ']']
  outputSourceRange:true
  shouldDecodeNewlines:false
  shouldDecodeNewlinesForHref:false
  warn:ƒ (msg, range, tip) 
  [[prototype]]
    canBeLeftOpenTag:ƒ (val) 
    directives:{model: ƒ, text: ƒ, html: ƒ}
    expectHTML:true
    getTagNamespace:ƒ getTagNamespace (tag) 
    isPreTag:ƒ (tag) 
    isReservedTag:ƒ (tag) 
    isUnaryTag:ƒ (val) 
    modules:(3) [{…}, {…}, {…}]
      0:{staticKeys: Array(1), transformNode: ƒ, genData: ƒ}
      1:{staticKeys: Array(1), transformNode: ƒ, genData: ƒ}
      2:{preTransformNode: ƒ}
    mustUseProp:ƒ (tag, type, attr)
    staticKeys:'staticClass,staticStyle'
```

### baseCompile

baseCompile 是编译的核心，此时传入了模板和编译配置，开始编译

baseCompile 做了三件事：模板的解析，优化，最终生成代码

```js
// compiler/index.js

export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  const ast = parse(template.trim(), options) // 将属性，标签解析出，生成 AST 树
  if (options.optimize !== false) {
    optimize(ast, options) // 优化语法树
  }
  const code = generate(ast, options) // 生成代码
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
```

#### parse

获取一些前置的解析方法，接着进入到 parseHTML 解析 html，传入参数模板 template，以及各项配置，其中配置中带有 start、end、chars、comment 方法；

```js
// compiler/parser/index.js

function parse (
  template: string,
  options: CompilerOptions
): ASTElement | void {
  warn = options.warn || baseWarn

  platformIsPreTag = options.isPreTag || no
  platformMustUseProp = options.mustUseProp || no
  platformGetTagNamespace = options.getTagNamespace || no
  const isReservedTag = options.isReservedTag || no
  maybeComponent = (el: ASTElement) => !!el.component || !isReservedTag(el.tag)

  transforms = pluckModuleFunction(options.modules, 'transformNode')
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  delimiters = options.delimiters

  const stack = []
  const preserveWhitespace = options.preserveWhitespace !== false
  const whitespaceOption = options.whitespace
  let root
  let currentParent
  let inVPre = false
  let inPre = false
  let warned = false

    // 传入模板，以及一个配置对象
  parseHTML(template, {
    warn,
    expectHTML: options.expectHTML,
    isUnaryTag: options.isUnaryTag,
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    shouldKeepComment: options.comments,
    outputSourceRange: options.outputSourceRange,
    start (tag, attrs, unary, start, end) {
      // check namespace.
      // inherit parent ns if there is one
      const ns = (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // handle IE svg bug
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      let element: ASTElement = createASTElement(tag, attrs, currentParent) // 创建 AST 元素
      if (ns) {
        element.ns = ns
      }

      if (process.env.NODE_ENV !== 'production') {
        if (options.outputSourceRange) {
          element.start = start
          element.end = end
          element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
            cumulated[attr.name] = attr
            return cumulated
          }, {})
        }
        attrs.forEach(attr => {
          if (invalidAttributeRE.test(attr.name)) {
            warn(
              `Invalid dynamic argument expression: attribute names cannot contain ` +
              `spaces, quotes, <, >, / or =.`,
              {
                start: attr.start + attr.name.indexOf(`[`),
                end: attr.start + attr.name.length
              }
            )
          }
        })
      }

      // 处理 AST 元素
      // 判断是否为禁止的 tag 和服务端渲染
      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        process.env.NODE_ENV !== 'production' && warn(
          'Templates should only be responsible for mapping the state to the ' +
          'UI. Avoid placing tags with side-effects in your templates, such as ' +
          `<${tag}>` + ', as they will not be parsed.',
          { start: element.start }
        )
      }

      // apply pre-transforms
      // 对创建的 ASTElement 做预转换
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else if (!element.processed) {
        // structural directives
        // 构建以前命令
        processFor(element) // 从元素中拿到 v-for 指令的内容，然后分别解析出 for、alias、iterator1、iterator2 等属性的值添加到 AST 的元素
        processIf(element) // 从元素中拿 v-if 指令的内容
        processOnce(element)
      }

      // 如果不存在 root 则将新建的 element 作为 root ,在检查 root 的约束条件 , 有问题的 tag 及 属性 v-for 均不能在 root 存在
      if (!root) {
        root = element
        if (process.env.NODE_ENV !== 'production') {
          checkRootConstraints(root)
        }
      }

      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        closeElement(element)
      }
    },

    end (tag, start, end) {
      const element = stack[stack.length - 1]
      // pop stack
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        element.end = end
      }
      closeElement(element)
    },

    chars (text: string, start: number, end: number) {
      if (!currentParent) {
        if (process.env.NODE_ENV !== 'production') {
          if (text === template) {
            warnOnce(
              'Component template requires a root element, rather than just text.',
              { start }
            )
          } else if ((text = text.trim())) {
            warnOnce(
              `text "${text}" outside root element will be ignored.`,
              { start }
            )
          }
        }
        return
      }
      // IE textarea placeholder bug
      /* istanbul ignore if */
      if (isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      if (inPre || text.trim()) {
        text = isTextTag(currentParent) ? text : decodeHTMLCached(text)
      } else if (!children.length) {
        // remove the whitespace-only node right after an opening tag
        text = ''
      } else if (whitespaceOption) {
        if (whitespaceOption === 'condense') { // 如果此处文本样式 whitespace 配置为 condense，有换行符的取消，没有的单空格
          // in condense mode, remove the whitespace node if it contains
          // line break, otherwise condense to a single space
          text = lineBreakRE.test(text) ? '' : ' '
        } else {
          text = ' '
        }
      } else {
        text = preserveWhitespace ? ' ' : ''
      }
      if (text) {
        if (!inPre && whitespaceOption === 'condense') {
          // condense consecutive whitespaces into single space
          text = text.replace(whitespaceRE, ' ')
        }
        let res
        let child: ?ASTNode
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          child = {
            type: 2, // 有表达式
            expression: res.expression,
            tokens: res.tokens,
            text
          }
        } else if (text !== ' ' || !children.length || children[children.length - 1].text !== ' ') {
          child = {
            type: 3, // 纯文本
            text
          }
        }
        if (child) {
          if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
            child.start = start
            child.end = end
          }
          children.push(child)
        }
      }
    },
    comment (text: string, start, end) {
      // adding anything as a sibling to the root node is forbidden
      // comments should still be allowed, but ignored
      if (currentParent) {
        const child: ASTText = {
          type: 3,
          text,
          isComment: true
        }
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          child.start = start
          child.end = end
        }
        currentParent.children.push(child)
      }
    }
  })
```

##### parseHTML

parseHTML 将传入的 template 虚幻遍历，解析出 AST 树

过程中会匹配注释的tag，doctype 的地方，结束tag，开始tag

首先肯定是开始 tag 的匹配，以栈的形式先压入开始的 tag，记录 tag 的名字，接着截取一下，循环匹配它对应的属性。接着进入 handleStartTag 处理开始标签，将之前分割开的属性按 name, value 的形式放入对象，按顺序存入 attrs 中。将非一元的标签压入栈中，再由 parseRndTag 弹出匹配结束标签

接着判断 parseHtml 中传入的配置是否有 start ，调用 start 处理刚才得到的 tag 名字，属性名字，开始结束的索引。

调用 createASTElement 函数创建 AST 树，接着处理生成的 AST 树，看属性中是否有禁止的属性，是否存在 v-pre ；然后继续构建 vue 的指令，从元素中拿到 v-for 指令的内容，然后分别解析出 for、alias、iterator1、iterator2 等属性的值添加到 AST 的元素；从元素中拿 v-if 指令的内容；从元素中拿 v-once 指令的内容。

然后判断是否存在 root ， 如果不存在 root 则将新建的 element 树作为 root ， 再检查 root 的约束条件 , 有问题的 tag 及 属性 v-for 均不能在 root 存在。

再判断是否是一元标签，如不是令 element 树作为当前的父级，并将 element 树入栈

之后重复上边的操作，遍历模板，匹配下一个开始标签 < , 用 advance 将模板不断裁剪，生成 AST 树，不断完善栈

如果遇到文本，则会在 chars 方法里边解析文本，获取用户定义的变量边框 delimiters 或者就是 vue 默认的 `{{...}}` ，匹配其中的变量，再用 _s() 来预置以便之后渲染变量

```js
// compiler/parser/html-parser.js

export function parseHTML (html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        const startTagMatch = parseStartTag() // 解析开始的标签，把 template 转化成节点名和属性
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd) // 将结尾标签截出
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length) // 更新 index html
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()
  // ...
}
```

##### AST

例子中最后生成 AST 树如下:

```js
ast
  attrs:(1) [{…}]
    0:{name: 'id', value: '"app"', dynamic: undefined, start: 5, end: 13}
  attrsList:(1) [{…}]
    0:{name: 'id', value: 'app', start: 5, end: 13}
  attrsMap:{id: 'app'}
  start:0
  end:110
  parent:undefined
  plain:false
  rawAttrsMap:{id: {…}}
  children:(3) [{…}, {…}, {…}]
    0:{type: 1, tag: 'div', attrsList: Array(1), attrsMap: {…}, rawAttrsMap: {…}, …}
    1:{type: 3, text: ' ', start: 71, end: 80}
    2:{type: 1, tag: 'balance', attrsList: Array(0), attrsMap: {…} }
  tag:'div'
  type:1
```

#### optimize

Vue 是数据驱动，是响应式的，但是我们的模板并不是所有数据都是响应式的，也有很多数据是首次渲染后就永远不会变化的
遍历已生成的 AST 树，并侦测完全稳定的副树，而 dom 部分不需要改变
侦测副树我们可以提升它们到常量，以便于我们不需要在每个 re-render 时给它们创建新的节点；在打包过程中完全跳过它们

因此 optimize 环节也是优化 ast ， 标记 静态节点 和 静态根 的时候

会将生成好的 ast 树递归进行标记，判断当前节点 isStatic(node)

```js
// compiler/optimizer.js

export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root) // 标记静态节点
  // second pass: mark static roots.
  markStaticRoots(root, false) // 标记静态根
}

// 用来判断是否静态节点
function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { // expression
    return false
  }
  if (node.type === 3) { // text
    return true
  }
  return !!(node.pre || ( // 使用 v-for 指令是静态元素
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}
```

#### generate

传入优化好后的 ast 树与 options 传入 generate 用来生成 render 代码

先生成 el 的代码，根据各项有无生成 data，再生成子树的代码，拼接起来

```js
// compiler/codegen/index.js

export function generate (
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  const state = new CodegenState(options)
  const code = ast ? genElement(ast, state) : '_c("div")'
  return {
    render: `with(this){return ${code}}`,
    staticRenderFns: state.staticRenderFns
  }
}

// genElement
export function genElement (el: ASTElement, state: CodegenState): string {
  if (el.parent) {
    el.pre = el.pre || el.parent.pre
  }

  if (el.staticRoot && !el.staticProcessed) { // 将 optimize 里标记的静态节点先生成
    return genStatic(el, state)
  } else if (el.once && !el.onceProcessed) {
    return genOnce(el, state)
  } else if (el.for && !el.forProcessed) {
    return genFor(el, state)
  } else if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.tag === 'template' && !el.slotTarget && !state.pre) {
    return genChildren(el, state) || 'void 0'
  } else if (el.tag === 'slot') {
    return genSlot(el, state)
  } else {
    // component or element
    let code
    if (el.component) {
      code = genComponent(el.component, el, state)
    } else {
      let data
      if (!el.plain || (el.pre && state.maybeComponent(el))) {
        data = genData(el, state)
      }

      const children = el.inlineTemplate ? null : genChildren(el, state, true)
      code = `_c('${el.tag}'${
        data ? `,${data}` : '' // data
      }${
        children ? `,${children}` : '' // children
      })`
    }
    // module transforms
    for (let i = 0; i < state.transforms.length; i++) {
      code = state.transforms[i](el, code)
    }
    return code
  }
}

// genData
export function genData (el: ASTElement, state: CodegenState): string {
  let data = '{'

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  // key
  if (el.key) {
    data += `key:${el.key},`
  }
  // ref
  if (el.ref) {
    data += `ref:${el.ref},`
  }
  if (el.refInFor) {
    data += `refInFor:true,`
  }
  // pre
  if (el.pre) {
    data += `pre:true,`
  }
  // record original tag name for components using "is" attribute
  if (el.component) {
    data += `tag:"${el.tag}",`
  }
  // module data generation functions
  for (let i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el)
  }
  // attributes
  if (el.attrs) {
    data += `attrs:${genProps(el.attrs)},`
  }
  // DOM props
  if (el.props) {
    data += `domProps:${genProps(el.props)},`
  }
  // event handlers
  if (el.events) {
    data += `${genHandlers(el.events, false)},`
  }
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true)},`
  }
  // slot target
  // only for non-scoped slots
  if (el.slotTarget && !el.slotScope) {
    data += `slot:${el.slotTarget},`
  }
  // scoped slots
  if (el.scopedSlots) {
    data += `${genScopedSlots(el, el.scopedSlots, state)},`
  }
  // component v-model
  if (el.model) {
    data += `model:{value:${
      el.model.value
    },callback:${
      el.model.callback
    },expression:${
      el.model.expression
    }},`
  }
  // inline-template
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }
  data = data.replace(/,$/, '') + '}'
  // v-bind dynamic argument wrap
  // v-bind with dynamic arguments must be applied using the same v-bind object
  // merge helper so that class/style/mustUseProp attrs are handled correctly.
  if (el.dynamicAttrs) {
    data = `_b(${data},"${el.tag}",${genProps(el.dynamicAttrs)})`
  }
  // v-bind data wrap
  if (el.wrapData) {
    data = el.wrapData(data)
  }
  // v-on data wrap
  if (el.wrapListeners) {
    data = el.wrapListeners(data)
  }
  return data
}
```

经上此步骤，依次生成各部分 code，再进行拼接得到最后的 render

```js
// 根生成的 code ：
'{attrs:{"id":"app"}}'

// 子树生成的 code ：
'[_c('div',{class:class,on:{"click":update}},[_v(_s(sum))]),_v(" "),_c('balance')],1'

// 接着将两者拼接成 ：
'_c('div',{attrs:{"id":"app"}},[_c('div',{class:class,on:{"click":update}},[_v(_s(sum))]),_v(" "),_c('balance')],1)'

// 而最后输出的 render
'with(this){return _c('div',{attrs:{"id":"app"}},[_c('div',{class:class,on:{"click":update}},[_v(_s(sum))]),_v(" "),_c('balance')],1)}'
```

##### createFunction

根据上边生成的 render code，生成函数

```js
// compiler/to-function.js

function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}
```

## mount

在进行编译操作后，我们得到了 render 函数，那么此时才算真正进入到挂载阶段

在编译篇章，先保留了原来定义的 $mount 方法，在编译后接着调用 $mount 方法实现挂载

先查询到挂载节点 dom ，再调用 mountComponent 进行挂载

```js
// platforms/web/runtime/index.js

// public mount method
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined // 查找dom
  return mountComponent(this, el, hydrating) // 返回当前的vue实例
}
```

### mountComponent



```js
export function mountComponent (
  vm: Component,
  el: ?Element,
  hydrating?: boolean
): Component {
  vm.$el = el // 挂在组件时存储 $el
  if (!vm.$options.render) { // 如果人为配置没有传入的 render
    vm.$options.render = createEmptyVNode // 返回一个虚拟节点
    if (process.env.NODE_ENV !== 'production') {
      /* istanbul ignore if */
      if ((vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el || el) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
          'compiler is not available. Either pre-compile the templates into ' +
          'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  callHook(vm, 'beforeMount')

  let updateComponent
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render() // 生成虚拟节点
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating) // 更新虚拟节点至dom
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  // Watcher 在这里起到两个作用，一个是初始化的时候会执行回调函数（标记this.getter为回调函数，后执行this.get()中执行回调），
  // 另一个是当 vm 实例中的监测的数据发生变化的时候执行回调函数
  new Watcher(vm, updateComponent, noop, {
    before () {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }, true /* isRenderWatcher */)
  hydrating = false

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // $vnode 为父节点，为 null 那说明为根节点初始化
  // 不是组件的初始化，而是外边用户 new Vue 的初始化过程
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}
```