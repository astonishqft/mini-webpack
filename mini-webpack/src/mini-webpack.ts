import * as minimist from 'minimist';
import * as path from 'path';
import * as fs from 'fs';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generator from '@babel/generator';
import * as types from '@babel/types';
import * as Handlebars from 'handlebars';

export default class Compiler {
  private config;
  private cwd;
  private entryPath;
  private outputDir;
  private outputFilename;
  private sourceList: Array<any> = [];
  constructor() {
    this.cwd = process.cwd();
    this.config = this.parseArgs();
    this.entryPath = this.config.entry;
    this.outputDir = this.config.output.path;
    this.outputFilename = this.config.output.filename || 'bundle.js';
  }

  parseArgs() {
    const args = minimist(process.argv.slice(2));
    const { config = 'webpack.config.js' } = args;
    const configPath =  path.resolve(this.cwd, config);
    return require(configPath);
  }

  generateCode(sourceList) {
    const tplPath = path.join(__dirname, '../templates', 'bundle.hbs');
    const tpl = fs.readFileSync(tplPath, 'utf-8');
    const template = Handlebars.compile(tpl);

    const data = {
      entryPath: this.entryPath,
      sourceList,
    };

    const bundleContent = template(data);

    fs.writeFileSync(path.join(this.outputDir, this.outputFilename), bundleContent, { encoding: 'utf8' });
  }

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

  /* 
   * modulePath: 模块的绝对路径
   * isEntry: 是否是入口模块
  */
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

  run() {
    this.build(path.join(this.cwd, this.entryPath));
    this.generateCode(this.sourceList);
    console.log('webpack running...')
  }
}