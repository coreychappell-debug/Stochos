const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\corey\\.gemini\\antigravity\\brain\\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\\.system_generated\\steps\\9019\\content.md';
const content = fs.readFileSync(filePath, 'utf8');

const regex = /[^"'\s>=\\]+\.pdf/g;
let match;
const pdfs = new Set();
while ((match = regex.exec(content)) !== null) {
  pdfs.add(match[0]);
}

console.log("Found PDF references:");
console.log(Array.from(pdfs));
