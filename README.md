# 介绍

阅读 vue 2.6.12 版本源码，作以记录

# 准备

## package.json

需要 package.json 中的 dev 指令后加 sourcemap, 方便我们直接看到未打包的源代码，否则就直接在 dist/vue 里直接跑，不利于我们理解代码结构

```
"dev": "rollup -w -c scripts/config.js --environment TARGET:web-full-dev --sourcemap"
```

继而直接命令行根目录直接执行 npm run dev，或者直接在 package.json 中 "scripts" 上边 debug 第一个命令

# launch.json

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