const fs = require('fs');
const logPath = 'C:\\Users\\Ahmad Affaq\\.gemini\\antigravity\\brain\\554543e9-5259-4134-a2bb-4d72f4577d15\\.system_generated\\logs\\overview.txt';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('social.service.ts')) {
    console.log(`Line ${i} contains social.service.ts`);
    const match = line.match(/"CodeContent"\s*:\s*"((\\.|[^"])+)"/);
    if (match) {
      console.log('Match found! Length:', match[1].length);
      // Let's parse it as a JSON string
      try {
        const decoded = JSON.parse('"' + match[1] + '"');
        console.log('Decoded start:', decoded.substring(0, 100));
        // Parse again if it starts with quote
        if (decoded.startsWith('"')) {
          console.log('Starts with quote! Parsing again...');
          const secondDecoded = JSON.parse(decoded);
          console.log('Second decoded start:', secondDecoded.substring(0, 100));
        }
      } catch (e) {
        console.error('Error decoding:', e.message);
      }
    }
  }
}
