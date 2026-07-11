const fs = require('fs');
const fileText = fs.readFileSync('/home/disciple/.gemini/antigravity/brain/964bfad3-b9df-4163-b6a7-c9d2bc97cd66/scratch/floods_closed.json', 'utf8');

const pos = 228858;
console.log('--- Segment with indices ---');
for (let i = pos - 40; i <= pos + 40; i++) {
  console.log(`${i}: "${fileText[i]}" (${fileText.charCodeAt(i)})`);
}
