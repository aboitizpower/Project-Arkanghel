const mysql = require('mysql2');
require('dotenv').config({ path: '../.env' });

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  multipleStatements: true
});

// List of foreign keys to update with ON DELETE CASCADE
// Each entry includes table, constraint name (and legacy names to try dropping), column, and referenced table/column.
const foreignKeys = [
  {
    table: 'module_chapters',
    constraint: 'fk_chapters_workstream',
    legacyConstraints: ['module_chapters_ibfk_1', 'fk_module_chapters_workstream'],
    column: 'workstream_id',
    refTable: 'workstreams',
    refColumn: 'workstream_id'
  },
  {
    table: 'assessments',
    constraint: 'fk_assessments_chapter',
    legacyConstraints: ['assessments_ibfk_1', 'fk_assessments_chapter'],
    column: 'chapter_id',
    refTable: 'module_chapters',
    refColumn: 'chapter_id'
  },
  {
    table: 'assessment_questions',
    constraint: 'fk_questions_assessment',
    legacyConstraints: ['assessment_questions_ibfk_1', 'fk_assessment_questions_assessment'],
    column: 'assessment_id',
    refTable: 'assessments',
    refColumn: 'assessment_id'
  },
  {
    table: 'question_choices',
    constraint: 'fk_choices_question',
    legacyConstraints: ['question_choices_ibfk_1', 'fk_question_choices_question'],
    column: 'question_id',
    refTable: 'assessment_questions',
    refColumn: 'question_id'
  },
  {
    table: 'user_progress',
    constraint: 'fk_progress_chapter',
    legacyConstraints: ['user_progress_ibfk_1', 'fk_user_progress_chapter'],
    column: 'chapter_id',
    refTable: 'module_chapters',
    refColumn: 'chapter_id'
  },
  {
    table: 'user_assessment_scores',
    constraint: 'fk_scores_assessment',
    legacyConstraints: ['user_assessment_scores_ibfk_1', 'fk_user_assessment_scores_assessment'],
    column: 'assessment_id',
    refTable: 'assessments',
    refColumn: 'assessment_id'
  },
  {
    table: 'assessment_answers',
    constraint: 'fk_answers_assessment',
    legacyConstraints: ['assessment_answers_ibfk_1', 'fk_assessment_answers_assessment'],
    column: 'assessment_id',
    refTable: 'assessments',
    refColumn: 'assessment_id'
  }
];

const runMigrations = async () => {
  for (const fk of foreignKeys) {
    // Drop all possible legacy constraints
    for (const legacyConstraint of fk.legacyConstraints) {
      try {
        const dropSql = `ALTER TABLE ${fk.table} DROP FOREIGN KEY ${legacyConstraint};`;
        await connection.promise().query(dropSql);
        console.log(`Dropped legacy constraint ${legacyConstraint} from ${fk.table}.`);
      } catch (err) {
        if (err.code === 'ER_CANNOT_DROP_FK') {
          // This is expected if the constraint doesn't exist
          console.log(`Constraint ${legacyConstraint} not found on ${fk.table}, skipping drop.`);
        } else {
          console.error(`Error dropping constraint ${legacyConstraint} from ${fk.table}:`, err.message);
        }
      }
    }

    // Add the new constraint with ON DELETE CASCADE
    try {
      const addSql = `ALTER TABLE ${fk.table} ADD CONSTRAINT ${fk.constraint} FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn}) ON DELETE CASCADE;`;
      await connection.promise().query(addSql);
      console.log(`Added constraint ${fk.constraint} to ${fk.table} with ON DELETE CASCADE.`);
    } catch (err) {
      if (err.code === 'ER_FK_DUP_NAME') {
        console.log(`Constraint ${fk.constraint} already exists on ${fk.table}.`);
      } else {
        console.error(`Error adding constraint ${fk.constraint} to ${fk.table}:`, err.message);
        // Stop execution if a critical error occurs
        return;
      }
    }
  }
  console.log('All foreign key constraints updated successfully.');
};

connection.connect(async (err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database.');
  await runMigrations();
  connection.end();
});
