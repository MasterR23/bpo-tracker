const fs = require('fs');

const file = 'C:\\Users\\Felip\\Downloads\\bpo_tracker.sql';
let sql = fs.readFileSync(file, 'utf8');

// 1. Add PRIMARY KEY inline to id columns
sql = sql.replace(/`id` int\(11\) NOT NULL,/g, '`id` int(11) NOT NULL PRIMARY KEY,');

// 2. Remove "ADD PRIMARY KEY (`id`)," for cases with following keys
sql = sql.replace(/ADD PRIMARY KEY \(`id`\),\r?\n/g, '');

// 3. Remove "ADD PRIMARY KEY (`id`);" and the empty ALTER TABLE if it's the only key
// For requisitions:
// ALTER TABLE `requisitions`
//   ADD PRIMARY KEY (`id`);
sql = sql.replace(/ALTER TABLE `.*?`\r?\n\s+ADD PRIMARY KEY \(`id`\);\r?\n/g, '');

fs.writeFileSync('C:\\Users\\Felip\\Downloads\\bpo_tracker_aiven.sql', sql);
console.log('Fixed SQL saved to bpo_tracker_aiven.sql');
