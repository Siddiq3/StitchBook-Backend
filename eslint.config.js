module.exports = [{
  files:['src/**/*.js','tests/**/*.js','scripts/**/*.js'],
  languageOptions:{ecmaVersion:2022,sourceType:'commonjs',globals:{process:'readonly',Buffer:'readonly',console:'readonly',__dirname:'readonly',__filename:'readonly',setTimeout:'readonly',clearTimeout:'readonly',setInterval:'readonly',clearInterval:'readonly',setImmediate:'readonly',URL:'readonly',URLSearchParams:'readonly',fetch:'readonly'}},
  rules:{'no-undef':'error','no-debugger':'error','no-unreachable':'error','no-constant-condition':'error'},
}];
