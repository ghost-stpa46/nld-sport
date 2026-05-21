const readDatabase = require('../utils');

class StudentsController {
  static getAllStudents(req, res) {
    const database = process.argv[2];
    readDatabase(database)
      .then((fields) => {
        let responseText = 'This is the list of our students\n';
        const sortedFields = Object.keys(fields)
          .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
        sortedFields.forEach((field) => {
          responseText += `Number of students in ${field}: ${fields[field].length}. List: ${fields[field].join(', ')}\n`;
        });
        res.status(200).send(responseText);
      })
      .catch(() => {
        res.status(500).send('Cannot load the database');
      });
  }

  static getAllStudentsByMajor(req, res) {
    const database = process.argv[2];
    const { major } = req.params;
    if (major !== 'CS' && major !== 'SWE') {
      res.status(500).send('Major parameter must be CS or SWE');
      return;
    }
    readDatabase(database)
      .then((fields) => {
        if (!fields[major]) {
          res.status(200).send('List: ');
        } else {
          res.status(200).send(`List: ${fields[major].join(', ')}`);
        }
      })
      .catch(() => {
        res.status(500).send('Cannot load the database');
      });
  }
}

module.exports = StudentsController;
