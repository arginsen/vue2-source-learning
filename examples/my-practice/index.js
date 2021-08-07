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
