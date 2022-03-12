const a = require('./a');
const b = require('./b');

function main() {
  console.log('I am entry module');
  console.log(a);
  console.log(b);
}

main();

module.exports = main;
