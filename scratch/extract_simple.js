const fs = require('fs');
const logPath = 'C:\\Users\\Ahmad Affaq\\.gemini\\antigravity\\brain\\554543e9-5259-4134-a2bb-4d72f4577d15\\.system_generated\\logs\\overview.txt';

const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.tool_calls) {
      for (const call of data.tool_calls) {
        if (call.name === 'write_to_file') {
          const args = call.args;
          const targetFile = args.TargetFile.replace(/"/g, '').trim();
          let codeContent = args.CodeContent;
          
          console.log(`File: ${targetFile}`);
          console.log(`Type: ${typeof codeContent}`);
          console.log(`Starts with quote: ${codeContent.startsWith('"')}`);
          console.log(`Ends with quote: ${codeContent.endsWith('"')}`);
          console.log(`Length: ${codeContent.length}`);
          console.log(`Last 10 chars: ${JSON.stringify(codeContent.slice(-10))}`);
        }
      }
    }
  } catch (e) {
  }
}
