-- MINIMAL DATABASE FIX FOR TRUE/FALSE QUESTIONS
-- Only the essential changes needed to fix the True/False issue

-- ============================================================================
-- STEP 1: CLEAN UP EXISTING TRUE/FALSE DATA
-- ============================================================================

-- Fix any existing True/False questions with inconsistent answers
UPDATE questions 
SET correct_answer = CASE 
    WHEN LOWER(TRIM(correct_answer)) IN ('true', '1', 'yes', 't') THEN 'True'
    WHEN LOWER(TRIM(correct_answer)) IN ('false', '0', 'no', 'f') THEN 'False'
    ELSE 'True'  -- Default to True for any unclear values
END
WHERE question_type = 'true_false' 
AND correct_answer NOT IN ('True', 'False');

-- Fix options column - set to NULL for True/False and Identification questions
UPDATE questions 
SET options = NULL 
WHERE question_type IN ('true_false', 'identification') 
AND options IS NOT NULL;

-- ============================================================================
-- STEP 2: ADD SIMPLE CONSTRAINT FOR TRUE/FALSE VALIDATION
-- ============================================================================

-- Add constraint to ensure True/False questions only have 'True' or 'False' answers
-- Drop existing constraint if it exists, then recreate it
ALTER TABLE questions DROP CONSTRAINT IF EXISTS chk_true_false_answer;

ALTER TABLE questions 
ADD CONSTRAINT chk_true_false_answer 
CHECK (
    question_type != 'true_false' OR 
    correct_answer IN ('True', 'False')
);

-- ============================================================================
-- STEP 3: CREATE SIMPLE TRIGGER FOR AUTOMATIC NORMALIZATION
-- ============================================================================

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_questions_before_insert;
DROP TRIGGER IF EXISTS trg_questions_before_update;

-- Simple trigger to normalize True/False answers on INSERT
DELIMITER //
CREATE TRIGGER trg_questions_before_insert
    BEFORE INSERT ON questions
    FOR EACH ROW
BEGIN
    -- Handle True/False questions
    IF NEW.question_type = 'true_false' THEN
        -- Normalize the answer to 'True' or 'False'
        IF LOWER(TRIM(NEW.correct_answer)) IN ('true', '1', 'yes', 't') THEN
            SET NEW.correct_answer = 'True';
        ELSE
            SET NEW.correct_answer = 'False';
        END IF;
        -- Clear options for True/False questions
        SET NEW.options = NULL;
    END IF;
    
    -- Handle Identification questions
    IF NEW.question_type = 'identification' THEN
        -- Clear options for Identification questions
        SET NEW.options = NULL;
    END IF;
END //
DELIMITER ;

-- Simple trigger to normalize True/False answers on UPDATE
DELIMITER //
CREATE TRIGGER trg_questions_before_update
    BEFORE UPDATE ON questions
    FOR EACH ROW
BEGIN
    -- Handle True/False questions
    IF NEW.question_type = 'true_false' THEN
        -- Normalize the answer to 'True' or 'False'
        IF LOWER(TRIM(NEW.correct_answer)) IN ('true', '1', 'yes', 't') THEN
            SET NEW.correct_answer = 'True';
        ELSE
            SET NEW.correct_answer = 'False';
        END IF;
        -- Clear options for True/False questions
        SET NEW.options = NULL;
    END IF;
    
    -- Handle Identification questions
    IF NEW.question_type = 'identification' THEN
        -- Clear options for Identification questions
        SET NEW.options = NULL;
    END IF;
END //
DELIMITER ;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that the changes work
SELECT 'Database fix completed!' as status;

-- Show any True/False questions to verify
SELECT 
    question_id,
    question_type,
    correct_answer,
    SUBSTRING(question_text, 1, 50) as question_preview
FROM questions 
WHERE question_type = 'true_false' 
LIMIT 5;
