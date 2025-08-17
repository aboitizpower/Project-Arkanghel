const mysql = require('mysql2');
require('dotenv').config({ path: '../.env' });

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database.');

  const dropProcedureQuery = 'DROP PROCEDURE IF EXISTS DeleteWorkstream;';

  const createProcedureQuery = `
    CREATE PROCEDURE DeleteWorkstream(IN w_id INT)
    BEGIN
        -- Get IDs of related items
        DECLARE done INT DEFAULT FALSE;
        DECLARE c_id, a_id, q_id INT;
        DECLARE chapter_ids, assessment_ids, question_ids TEXT;

        -- Collect chapter IDs
        SELECT GROUP_CONCAT(chapter_id) INTO chapter_ids FROM module_chapters WHERE workstream_id = w_id;

        -- Collect assessment IDs
        IF chapter_ids IS NOT NULL THEN
            SELECT GROUP_CONCAT(assessment_id) INTO assessment_ids FROM assessments WHERE FIND_IN_SET(chapter_id, chapter_ids);
        END IF;

        -- Collect question IDs
        IF assessment_ids IS NOT NULL THEN
            SELECT GROUP_CONCAT(question_id) INTO question_ids FROM assessment_questions WHERE FIND_IN_SET(assessment_id, assessment_ids);
        END IF;

        -- Start transaction
        START TRANSACTION;

        -- Perform deletions in the correct order
        IF question_ids IS NOT NULL THEN
            DELETE FROM question_choices WHERE FIND_IN_SET(question_id, question_ids);
        END IF;
        IF assessment_ids IS NOT NULL THEN
            DELETE FROM assessment_answers WHERE FIND_IN_SET(assessment_id, assessment_ids);
            DELETE FROM assessment_questions WHERE FIND_IN_SET(assessment_id, assessment_ids);
            DELETE FROM user_assessment_scores WHERE FIND_IN_SET(assessment_id, assessment_ids);
        END IF;
        IF chapter_ids IS NOT NULL THEN
            DELETE FROM assessments WHERE FIND_IN_SET(chapter_id, chapter_ids);
            DELETE FROM user_progress WHERE FIND_IN_SET(chapter_id, chapter_ids);
        END IF;
        DELETE FROM module_chapters WHERE workstream_id = w_id;
        DELETE FROM workstreams WHERE workstream_id = w_id;

        -- Commit transaction
        COMMIT;
    END
  `;

  connection.query(dropProcedureQuery, (err, results) => {
    if (err) {
      console.error('Error dropping procedure:', err);
      connection.end();
      return;
    }
    console.log('Procedure `DeleteWorkstream` dropped if it existed.');

    connection.query(createProcedureQuery, (err, results) => {
      if (err) {
        console.error('Error creating procedure:', err);
      } else {
        console.log('Procedure `DeleteWorkstream` created successfully.');
      }
      connection.end();
    });
  });
});
