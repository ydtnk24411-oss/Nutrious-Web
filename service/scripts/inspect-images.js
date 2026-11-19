const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '../../my-app/public/images/categories');
const files = fs.readdirSync(dir);
console.log('Category files in', dir);
files.forEach(f => {
  const stat = fs.statSync(path.join(dir, f));
  console.log(f, stat.size, 'bytes');
});

