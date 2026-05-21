const fs = require('fs');

function countStudents(path) {
  let data;
  try {
    data = fs.readFileSync(path, 'utf8');
  } catch (error) {
    throw new Error('Cannot load the database');
  }

  const fields = {};
  const students = data.split('\n').filter((student) => student !== '');
  if (students.length === 0) {
    throw new Error('Cannot load the database');
  }

  students.shift();

  const count = students.length;
  console.log(`Number of students: ${count}`);

  for (const student of students) {
    const cols = student.split(',');
    const field = cols[3];
    if (!fields[field]) {
      fields[field] = [];
    }
    fields[field].push(cols[0]);
  }

  for (const i of Object.keys(fields)) {
    console.log(`Number of students in ${i}: ${fields[i].length}. List: ${fields[i].join(', ')}`);
  }
}

module.exports = countStudents;
