const vm = new Vue({
    el: '#app',
    data(){
        return {
            text: 'first mount data: \n' + new Date(),
            data: 'confirm'
        }
    }
});

console.log(vm.$data.text); // 获取数据

document.getElementById('update').addEventListener('click', function(){
  vm.$data.text = 'second mount data: \n' + new Date();
})

console.log(vm.$data.text); // 获取数据