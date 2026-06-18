const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./app/(main)');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const updatedContent = content.replace(/(className=[\"\'\`][^\`\"\']*sticky top-0[^\`\"\']*)([\"\'\`])/g, (match, p1, p2) => {
    if (!p1.includes('pt-safe')) {
      return p1 + ' pt-safe' + p2;
    }
    return match;
  });
  
  if (updatedContent !== content) {
    fs.writeFileSync(file, updatedContent);
    console.log('Fixed safe-area in:', file);
  }
});
