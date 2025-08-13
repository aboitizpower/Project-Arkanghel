const mysql = require('mysql2');
require('dotenv').config({ path: '../.env' });

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database.');

  const alterTableQuery = `
    ALTER TABLE assessments 
    ADD COLUMN workstream_id INT NULL, 
    ADD CONSTRAINT fk_assessment_workstream FOREIGN KEY (workstream_id) REFERENCES workstreams(workstream_id) ON DELETE CASCADE;
  `;

  connection.query(alterTableQuery, (err, results) => {
    if (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
        console.log('workstream_id column already exists. Skipping.');
      } else {
        console.error('Error altering assessments table:', err);
      }
    } else {
      console.log('Assessments table altered successfully.');
    }
    connection.end();
  });
});
