Vue.mixin({
  created() {
    console.log('parent created')
  }
})

let app = new Vue({
  el: '#app',
  delimiters: ['$[', ']'],
  watch: {
    sum(val) {
      console.log('the newVal of sum is' + val)
    }
  },
  data() {
    return {
      bindClass: 'date',
      base: 10,
      arr: ['num1', {'num2': 2}, ['num3', 3]],
      show: true,
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
  },
  computed: {
    sum() {
      return this.base * 10
    }
  },
  methods: {
    update() {
      this.base += 10
    },
    switchShow() {
      this.show = !this.show
      console.log(this.show ? '打开面板' : '关闭面板')
    }
  }
})
