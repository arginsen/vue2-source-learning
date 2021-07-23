# 介绍

阅读 vue 2.6.12 版本源码，作以记录

# 准备

个人调试用例在根目录的 my-practice 下。
下边调试方法均可，chrome 调试现在也挺舒服；vscode 中方便做笔记

## vscode 调试

使用 vscode 调试，方便做笔记，此时不用管下边 package.json 里的变更。
选择 launch chrome，vscode 的 launch.json 配置如下：

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

可以直接在源码中打断点，在 vscode 中跑整个流程

## 浏览器调试

需要 package.json 中的 dev 指令后加 sourcemap, 方便我们直接看到未打包的源代码，否则就直接在 dist/vue 里直接跑，不利于我们理解代码结构

```
"dev": "rollup -w -c scripts/config.js --environment TARGET:web-full-dev --sourcemap"
```

继而直接命令行根目录直接执行 npm run dev，或者直接在 package.json 中 "scripts" 上边 debug 第一个命令

在浏览器打开我们的测试例子 examples/my-practice 里边的 index.html ，打开浏览器 console 就可以打断点了。

完成 launch.json 或者 package.json 中的改动就可以调试了。