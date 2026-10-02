const fs = require('fs');
let code = fs.readFileSync('packages/db/src/index.ts', 'utf8');

code = code.replace(/placeholders\.push\(\`\(\\\$\\\$\\{i\+\+\\},/g, 'placeholders.push(`(to_timestamp($${i++}::numeric / 1000.0),');

// If result.time is an ISO string, to_timestamp will fail!
// Let's check if it's a string or number in TS. Let's just do:
// values.push( new Date(result.time).toISOString(), ... ) and let PG parse the ISO string!
// Yes, that works for BOTH string and integer epoch!
