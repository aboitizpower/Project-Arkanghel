const mysql = require('mysql2');
require('dotenv').config({ path: '../.env' });

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
});

const queries = [
  // module_chapters -> workstreams
  'ALTER TABLE module_chapters DROP FOREIGN KEY fk_module_chapters_workstream;',
  'ALTER TABLE module_chapters ADD CONSTRAINT fk_module_chapters_workstream FOREIGN KEY (workstream_id) REFERENCES workstreams(workstream_id) ON DELETE CASCADE;',
  
  // assessments -> module_chapters
  'ALTER TABLE assessments DROP FOREIGN KEY fk_assessments_chapter;',
  'ALTER TABLE assessments ADD CONSTRAINT fk_assessments_chapter FOREIGN KEY (chapter_id) REFERENCES module_chapters(chapter_id) ON DELETE CASCADE;',

  // assessment_questions -> assessments
  'ALTER TABLE assessment_questions DROP FOREIGN KEY fk_assessment_questions_assessment;',
  'ALTER TABLE assessment_questions ADD CONSTRAINT fk_assessment_questions_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(assessment_id) ON DELETE CASCADE;',

  // question_choices -> assessment_questions
  'ALTER TABLE question_choices DROP FOREIGN KEY fk_question_choices_question;',
  'ALTER TABLE question_choices ADD CONSTRAINT fk_question_choices_question FOREIGN KEY (question_id) REFERENCES assessment_questions(question_id) ON DELETE CASCADE;',
  
  // user_progress -> module_chapters
  'ALTER TABLE user_progress DROP FOREIGN KEY fk_user_progress_chapter;',
  'ALTER TABLE user_progress ADD CONSTRAINT fk_user_progress_chapter FOREIGN KEY (chapter_id) REFERENCES module_chapters(chapter_id) ON DELETE CASCADE;',

  // user_assessment_scores -> assessments
  'ALTER TABLE user_assessment_scores DROP FOREIGN KEY fk_user_assessment_scores_assessment;',
  'ALTER TABLE user_assessment_scores ADD CONSTRAINT fk_user_assessment_scores_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(assessment_id) ON DELETE CASCADE;',

  // assessment_answers -> assessments
  'ALTER TABLE assessment_answers DROP FOREIGN KEY fk_assessment_answers_assessment;',
  'ALTER TABLE assessment_answers ADD CONSTRAINT fk_assessment_answers_assessment FOREIGN KEY (assessment_id) REFERENCES assessments(assessment_id) ON DELETE CASCADE;'
];

connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database.');

  const executeQuery = (index) => {
    if (index >= queries.length) {
      console.log('All tables altered successfully.');
      connection.end();
      return;
    }

    connection.query(queries[index], (err, results) => {
      if (err) {
        // Ignore errors if the constraint doesn't exist to be dropped, or already exists when adding
        if (err.code === 'ER_CANNOT_DROP_FK' || err.code === 'ER_FK_DUP_NAME') {
          console.log(`Skipping query due to non-critical error: ${err.message}`);
          executeQuery(index + 1);
        } else {
          console.error(`Error altering table with query: ${queries[index]}`, err);
          connection.end();
        }
      } else {
        console.log(`Query executed successfully: ${queries[index]}`);
        executeQuery(index + 1);
      }
    });
  };

  executeQuery(0);
});
