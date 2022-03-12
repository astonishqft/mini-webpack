# 手摸手实现一个webpack 

在平时的工作和学习过程中，`webpack` 是一个重要的知识点，本文通过分析 `webpack` 的打包原理，最终带大家实现一个简易版的 `webpack`。

## webpack模块加载机制

在弄明白 `webpack` 的模块加载机制之前，我们先看一下一个简单的工程经过 `webpack` 打包之后会变成什么样？

创建一个 `example` 目录，并且在该目录下创建三个文件 `a.js`、`b.js` 和 `index.js`，为了便于研究具体的打包的结果，所有的模块都采用了 `commonjs` 模块进行加载，采用 `es6` 模块原理也是大同小异。

**a.js:**

```js
module.exports = 'I am module a';
```

**b.js:**

```js
module.exports = 'I am module b';
```

**index.js:**

```js
const a = require('./a');
const b = require('./b');

function main() {
  console.log('I am entry module');
  console.log(a);
  console.log(b);
}

main();

module.exports = main;
```

**安装webpack和webpack-cli：**

⚠️注意：这里我们选择 `webpack4.x` 版本进行演示。

```bash
$ yarn add webpack@4.28.4 webpack-cli@3.3.0 -D
```

**新增一个webpack配置文件**

`webpack` 打包模式 `mode` 设置为 `development` 模式，这样可以使打包后的js代码便于观察。

webpack.config.js：

```js
const path = require('path');

module.exports = {
  entry: './src/index.js',
  mode: 'development',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  }
};
```

在项目的 `package.json` 中增加一条 `webpack` 编译命令，并指定 `webpack` 打包的配置文件。

package.json:

```json
{
  "scripts": {
    "build": "webpack --config webpack.config.js"
  }
}
```

现在执行 `$ yarn run build` 就会在 `dist` 目录下的 `bundle.js` 文件中生成打包后的结果。

删除掉注释和暂时用不到的代码，整个 `bundle.js` 可以进行如下简化：

```js
(function(modules) {
  // The module cache
  var installedModules = {};

  // The require function
  function __webpack_require__(moduleId) {
    // Check if module is in cache
    if(installedModules[moduleId]) {
        return installedModules[moduleId].exports;
    }
    // Create a new module (and put it into the cache)
    var module = installedModules[moduleId] = {
        i: moduleId,
        l: false,
        exports: {}
    };

    // Execute the module function
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

    // Flag the module as loaded
    module.l = true;

    // Return the exports of the module
    return module.exports;
  }

  return __webpack_require__(__webpack_require__.s = "./src/index.js");
})
({
  "./src/a.js": (function(module, exports) {
    eval("module.exports = 'I am module a';\n\n//# sourceURL=webpack:///./src/a.js?");
  }),
  "./src/b.js": (function(module, exports) {
    eval("module.exports = 'I am module b';\n\n//# sourceURL=webpack:///./src/b.js?");
  }),
  "./src/index.js": (function(module, exports, __webpack_require__) {
    eval("const a = __webpack_require__(/*! ./a */ \"./src/a.js\");\nconst b = __webpack_require__(/*! ./b */ \"./src/b.js\");\n\nfunction main() {\n  console.log('I am entry module');\n  console.log(a);\n  console.log(b);\n}\n\nmain();\n\nmodule.exports = main;\n\n\n//# sourceURL=webpack:///./src/index.js?");
  })
});
```

这个结构就很清晰了，所有的逻辑在一个立即执行函数里面，`webpack` 里面叫做 `webpackBootstrap`，结构如下：

```js
(function(modules){
  // body
})({
  "a.js": (function(){}),
  "b.js": (function(){}),
  // ...
});
```
立即执行函数的实参是一个对象，对象的 `key` 是文件的路径（这里的 key 其实就是一个全局唯一的标识，production模式下并不一定是文件路径），`value` 是文件的具体内容。

接下来看立即执行函数的函数体。整个函数体内部形成了一个闭包，定义了一个闭包变量 `installedModules`，用来缓存所有已经加载过的模块。

```js
var installedModules = {};
```

定义一个 `__webpack_require__` 函数用来辅助加载模块，函数接收一个模块id作为入参，接下来看一下 `__webpack_require__` 做了哪些事情。

- 检查 `installedModules` 对象中是否已经存在缓存，如果存在缓存的话就直接返回已经缓存的模块。

```js
// Check if module is in cache
if(installedModules[moduleId]) {
  return installedModules[moduleId].exports;
}
```

- 如果缓存不存在，则定义一个对象挂载到 `installedModules` 对象中，`key` 为模块的id，`value` 是一个对象，包含 `i`、`l` 和 `exports` 三个值，分别用来记录模块的id、标记模块是否已经加载过的标志位和存储模块执行后的返回结果。

```js
// Create a new module (and put it into the cache)
var module = installedModules[moduleId] = {
    i: moduleId,
    l: false,
    exports: {}
};
```
- `modules[moduleId].call()` 执行模块。第一个参数 `module.exports` 指定了执行模块的上下文，并且传入默认参数，执行的结果会挂到 `module.exports` 上。

```js
// Execute the module function
modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
```

- 标记模块为已经加载过

```js
// Flag the module as loaded
module.l = true;
```

函数体最后返回 `__webpack_require__("./src/index.js")` 的执行结果，其中 `./src/index.js` 指定了整个模块加载的入口文件。

## 实现一个简易版的 webpack

明白了上面的模块加载机制之后，下面我们就来自己实现一个简易版的 `webpack`。

初步的想法是和 `webpack` 一样，提供一个 `mini-webpack` 命令行，通过 `--confg` 参数能够获取指定的 `webpack` 配置文件并进行打包。

### 初始化工程

创建一个工程 `mini-webpack`，并且初始化工程。

```bash
$ mkdir mini-webpack
$ cd mini-webpack
$ yarn init -y
```

新增 `src` 目录，在 `src` 目录下新建 `mini-webpack` 文件，定义一个 `Compiler` 类，提供一个构造函数和一个 `run` 方法。

```js
export default class Compiler {
  constructor() {}

  run() {
    console.log('webpack running...')
  }
}
```

为了能够使用 `typescript` 编写我们的代码，可以使用 `tsc` 对代码进行编译。

```bash
$ yarn add typescript @types/node -D
```

根目录下创建 `tsconfig.json` 配置文件。

```json
{
  "compilerOptions": {
    "target": "ES2015",
    "noImplicitAny": false,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "allowSyntheticDefaultImports": true,
    "experimentalDecorators": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "removeComments": false,
    "baseUrl": ".",
    "outDir": "dist",
    "rootDir": "./src",
    "module": "commonjs",
    "sourceMap": true,
    "skipLibCheck": true
  },
  "include": [
    "./src"
  ]
}
```

在 `package.json` 中增加一条编译命令，执行 `$ npm run build` 就可以对我们的 ts 代码进行编译，并输出到 `dist` 目录下了。

```json
{
  "scripts": {
    "build": "tsc"
  },
}
```

接下来就可以提供 `mini-webpack` 命令行了。

根目录下新建 `bin` 目录，在 `bin` 目录下创建 `mini-webpack` 文件，引用 `dist` 目录下的 `mini-webpack` 文件，实例化 `mini-webpack`，并执行 `run` 方法。

```js
#! /usr/bin/env node

const MiniWebpack = require('../dist/mini-webpack').default

new MiniWebpack().run();
```

在 `package.json` 文件中增加 `bin` 字段，指向 `bin/mini-webpack`。

```json
{
  "bin": {
    "mini-webpack": "bin/mini-webpack"
  },
}
```

在 `mini-webpack` 目录下执行 `$ ./bin/mini-webpack` 就可以调用 `mini-webpack` 的 `run` 方法并打印出日志了。

如果想使用 `mini-webpack` 命令行对 `example` 工程进行编译操作，可以在 `mini-webpack` 目录下执行 `npm link`，然后在 `example` 目录下执行 `npm link mini-webpack`，在 `example` 目录的 `package.json` 中增加一条编译指令。

```json
{
  "scripts": {
    "build": "mini-webpack --config webpack.config.js"
  },
}
```

这样，在 `example` 目录下执行 `$ npm run build` 就开始进行编译。

### 核心打包模块的实现

首先我们需要解析命令行传过来的参数，获取 `webpack` 的配置文件。

定义一个 `parseArgs` 方法，并在构造函数里调用，通过 [minimist](https://github.com/substack/minimist) 解析出命令行参数，获取打包的入口、输出目录以及其他一些配置项。

```js
import * as minimist from 'minimist';
import * as path from 'path';

export default class Compiler {
  private config;
  private cwd;
  private entry;
  private outputDir;
  private outputFilename;
  constructor() {
    this.cwd = process.cwd();
    this.config = this.parseArgs();
    this.entry = this.config.entry;
    this.outputDir = this.config.output.path;
    this.outputFilename = this.config.output.filename || 'bundle.js';
  }

  parseArgs() {
    const args = minimist(process.argv.slice(2))
    const { config = 'webpack.config.js' } = args;
    const configPath =  path.resolve(this.cwd, config);
    return require(configPath);
  }

  run() {
    console.log('webpack running...')
  }
}
```

上一节 `webpack模块加载机制` 中已经介绍过，打包后的 `bundle.js` 的结构大概是这样：

```js
(function(modules){
  var installedModules = {};

  function __webpack_require__(moduleId) {
    // ...
  }

  return __webpack_require__("./src/index.js");
})({
  "a.js": (function(){}),
  "b.js": (function(){}),
  // ...
});
```

所以，接下来就要想办法生成这么一个字符串，输出到 `output` 指定的目录。这个字符串中有两部分是动态生成的，一个就是立即执行函数的入参，是一个资源清单，另一个是 `webpack` 打包的入口。为了方便生成格式化的字符串，这里我选择使用 [Handlebars](https://www.handlebarsjs.cn/guide/#%E4%BB%80%E4%B9%88%E6%98%AF-handlebars) 来生成模板。

定义一个 `generateCode` 方法，用来接收资源清单和打包入口，生成输出字符串。

安装 `handlebars`:

```bash
$ yarn add handlebars
```

入参 `sourceList` 是一个数组，结构如下：

```js
[
  {
    path: "./src/a.js",
    code: "module.exports = 'I am module a';",
  },
  {
    path: "./src/b.js",
    code: "module.exports = 'I am module b';",
  },
  {
    path: "./src/index.js",
    code: "const a = __webpack_require__(/*! ./a */ \"./src/a.js\");\nconst b = __webpack_require__(/*! ./b */ \"./src/b.js\");\n\nfunction main() {\n  console.log('I am entry module');\n  console.log(a);\n  console.log(b);\n}\n\nmain();\n\nmodule.exports = main;",
  },
]
```

`generateCode` 方法：

```js
import * as path from 'path';
import * as fs from 'fs';
import * as Handlebars from 'handlebars';

export default class Compiler {
  // ...
  generateCode(sourceList, entryPath) {
    const tplPath = path.join(__dirname, '../templates', 'bundle.hbs');
    const tpl = fs.readFileSync(tplPath, 'utf-8');
    const template = Handlebars.compile(tpl);

    const data = {
      entryPath,
      sourceList,
    };

    const bundleContent = template(data);

    fs.writeFileSync(path.join(this.outputDir, this.outputFilename), bundleContent, { encoding: 'utf8' });
  }
  // ...
}
```

`bundle.hbs` 模板文件：

```js
(function(modules) {
  // The module cache
  var installedModules = {};

  // The require function
  function __webpack_require__(moduleId) {
    // Check if module is in cache
    if(installedModules[moduleId]) {
        return installedModules[moduleId].exports;
    }
    // Create a new module (and put it into the cache)
    var module = installedModules[moduleId] = {
        i: moduleId,
        l: false,
        exports: {}
    };

    // Execute the module function
    modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

    // Flag the module as loaded
    module.l = true;

    // Return the exports of the module
    return module.exports;
  }

  return __webpack_require__(__webpack_require__.s = "{{{ entryPath }}}");
})
({
  {{#each sourceList}}
    "{{{path}}}": (function(module, exports, __webpack_require__) {
      eval(`{{{code}}}`);
    }),
  {{/each}}
});
```

有了前面的铺垫，接下来只需要获取到资源清单列表，整个 `webpack` 编译打包流程就可以跑通了。

`webpack` 打包通常是由一个入口作为切入点，作为构建其内部依赖图的开始，读取入口文件后，会找出入口文件依赖了哪些文件（通俗的理解就是找到该文件 `import` 或者 `require` 了哪些文件），找到这些依赖文件之后将其记录下来，接着再找依赖的依赖又依赖了哪些文件，一直到最后所有的依赖都已经被找完，生成完整的依赖图。

上面的过程中就会涉及到一个新的概念，如何分析文件，解析 `require` 或者 `import` 语法？

**答案就是 [babel](https://babeljs.io/)**。

这里主要用到了babel的三个包：

- *@babel/parser*：将代码解析成ast语法树
- *@babel/traverse*：可以用来遍历更新@babel/parser生成的ast语法树
- *@babel/generator*：根据ast生成代码
- *@babel/types*: 提供一些工具类方法

安装上述依赖包：

```bash
$ yarn add @babel/parser @babel/traverse @babel/generator @babel/types
```

定义一个 `build` 方法，该方法会先根据传入的模块路径读取取到源文件，然后调用 `this.parseModule` 方法，传入当前模块的源文件和父目录，获取通过 `@babel/generator` 重新生成的源码 `sourceCode`，和该文件中的依赖项列表 `moduleList`，然后将收集到的数据 push 到 `sourceList` 列表中，接着根据依赖项列表 `moduleList` 递归进行上述过程。

build 方法：

```js
build(modulePath) {
  const code = fs.readFileSync(modulePath, 'utf-8');

  const { sourceCode, moduleList } = this.parseModule(code, path.dirname(modulePath));

  this.sourceList.push({
    path: `./${path.relative(this.cwd, modulePath)}`,
    code: sourceCode,
  });

  if(moduleList.length !== 0) {
    moduleList.forEach(m => this.build(path.resolve(this.cwd, m)));
  }
}
```

`parseModule` 方法主要涉及到 `babel` 对源文件的一些处理。首先根据传入的源文件通过 `@babel/parser` 将源文件转换为ast语法树，然后通过 `@babel/traverse`，遍历ast语法树，找到 `require` 语句（import语句类似，这里暂时只考虑 require 一种），将 `require` 方法名替换为 `__webpack_require__` 方法名，函数参数的路径转换为以 `./src` 开头的相对路径。

parseModule 方法：

```js
parseModule(code, parentPath) {
  const relativePath = path.relative(this.cwd, parentPath);

  const ast = parser.parse(code);
  let moduleList: Array<string> = [];
  traverse(ast, {
    CallExpression({ node }) {
      if (node.callee.name === 'require') {
        node.callee.name = '__webpack_require__';
        let moduleName = node.arguments[0].value;

        moduleName = path.extname(moduleName) ?  moduleName : moduleName + '.js';
        moduleName = `./${path.join(relativePath, moduleName)}`;

        node.arguments = [types.stringLiteral(moduleName)];
        moduleList.push(moduleName);
      }
    }
  });

  const sourceCode = generator(ast).code;
  
  return {
    sourceCode,
    moduleList,
    }
}
```

最后在 `run` 方法里调用 `build` 和 `generateCode` 方法，重新编译 `mini-webpack` 后，在 example 目录下执行 `$ npm run build` 就完成了整个转换过程，会在 `dist` 目录下生成 `bundle.js` 文件。

```js
run() {
  this.build(path.join(this.cwd, this.entryPath));
  this.generateCode(this.sourceList);
}
```

### 总结

通过上述章节的介绍，可以看到 `webpack` 的打包原理并不是很复杂，明白了打包原理之后再去实现一个 `webpack` 打包工具就水到渠成了。当然，这里只是实现了一个最小化的 `webpack` 打包工具，真正的 `webpack` 打包还会涉及到 `loader`、插件系统等一系列复杂的工作，尤其是 `webpack` 的插件系统对于理解前端工程化还是大有裨益的，像业内比较有名的开源框架比如 `umi`、`taro` 等框架中都有借鉴，感兴趣的同学可以阅读下相关源码。

### 参考链接

- [webpack打包原理 ? 看完这篇你就懂了 !](https://zhuanlan.zhihu.com/p/101541041)
- [Webpack 是怎样运行的?](https://zhuanlan.zhihu.com/p/52826586)
- [深入理解 webpack 文件打包机制](https://github.com/happylindz/blog/issues/6)
