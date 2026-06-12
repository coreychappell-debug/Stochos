const fs = require('fs');

const filePath = 'C:\\Users\\corey\\.gemini\\antigravity\\brain\\dd232c1c-21fc-4d15-bb7f-6dd4c3567a2a\\.system_generated\\steps\\9019\\content.md';
const content = fs.readFileSync(filePath, 'utf8');

// Print first 1000 characters
console.log("FIRST 1000 CHARACTERS:");
console.log(content.substring(0, 1000));

// Find any anchor tags
const links = [];
const regex = /<a\s+[^>]*href="([^"]+)"[^>]*>/g;
let match;
while ((match = regex.exec(content)) !== null) {
  links.push(match[1]);
}
console.log(`Found ${links.length} total anchor links.`);
console.log("First 20 links:");
console.log(links.slice(0, 20));

// Search for keywords
console.log("Searching for keywords:");
const keywords = ['report', 'finance', 'annual', 'comprehensive', 'fiscal', 'audit'];
keywords.forEach(kw => {
  const matches = content.toLowerCase().includes(kw);
  console.log(`- '${kw}': ${matches}`);
});
