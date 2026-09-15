const fs = require('fs');
const path = require('path');

const logPath = 'C:\\Users\\Ahmad Affaq\\.gemini\\antigravity\\brain\\554543e9-5259-4134-a2bb-4d72f4577d15\\.system_generated\\logs\\overview.txt';

if (!fs.existsSync(logPath)) {
  console.error('Log file not found');
  process.exit(1);
}

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.tool_calls) {
      for (const call of data.tool_calls) {
        if (call.name === 'write_to_file') {
          const args = call.args;
          const targetFile = args.TargetFile.replace(/"/g, '').trim();
          let codeContent = args.CodeContent;
          
          // If codeContent is double-serialized, parse it again
          if (typeof codeContent === 'string' && codeContent.startsWith('"')) {
            try {
              codeContent = JSON.parse(codeContent);
            } catch (e) {
              // Ignore and use original
            }
          }
          
          console.log(`Writing file: ${targetFile}`);
          fs.mkdirSync(path.dirname(targetFile), { recursive: true });
          fs.writeFileSync(targetFile, codeContent, 'utf8');
        }
      }
    }
  } catch (e) {
    console.error('Error parsing line:', e.message);
  }
}
console.log('Extraction complete.');
