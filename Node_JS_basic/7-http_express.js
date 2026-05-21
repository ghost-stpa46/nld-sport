const express = require('express');
const fs = require('fs');

function countStudents(path) {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf-8', (err, data) => {
      if (err) {
        reject(new Error('Cannot load the database'));
        return;
      }

      const students = data.split('\n').filter((student) => student.trim() !== '');
      if (students.length === 0) {
        reject(new Error('Cannot load the database'));
        return;
      }

      students.shift();

      let response = `Number of students: ${students.length}\n`;

      const fields = {};
      students.forEach((student) => {
        const studentInfo = student.split(',');
        if (!fields[studentInfo[3]]) {
          fields[studentInfo[3]] = [];
        }
        fields[studentInfo[3]].push(studentInfo[0]);
      });

      for (const i of Object.keys(fields)) {
        response += `Number of students in ${i}: ${fields[i].length}. List: ${fields[i].join(', ')}\n`;
      }
      resolve(response.trim());
    });
  });
}

const port = 1245;
const app = express();

app.get('/', (req, res) => {
  res.send('Hello Holberton School!');
});

app.get('/students', (req, res) => {
  try {
    countStudents(process.argv[2])
      .then((response) => {
        res.send(`This is the list of our students\n${response}`);
      })
      .catch((error) => {
        res.status(500).send(error.message);
      });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(port, () => {
  console.log(`Server listen on port ${port}`);
});

module.exports = app;
