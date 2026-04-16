-- Seed 5 demo questions for each existing content_item so the quiz flow can be tested
-- without depending on Gemini (which is rate-limited).

DO $$
DECLARE
  ci RECORD;
BEGIN
  FOR ci IN SELECT id, title, COALESCE(subject, 'General') AS subject FROM content_items LOOP
    -- Skip if this content already has questions
    IF EXISTS (SELECT 1 FROM question_bank WHERE content_id = ci.id) THEN
      CONTINUE;
    END IF;

    INSERT INTO question_bank (content_id, subject, topic, difficulty, question_text, options, correct_id, hint, explanation) VALUES
    (ci.id, ci.subject, ci.title, -1.5,
     'What is the main idea of this lesson?',
     '[{"id":"A","label":"Understanding the core concept"},{"id":"B","label":"Memorizing random facts"},{"id":"C","label":"Skipping the details"},{"id":"D","label":"Ignoring examples"}]'::jsonb,
     'A',
     'Think about what the lesson introduces first.',
     'The main idea is always the core concept the lesson teaches.'),

    (ci.id, ci.subject, ci.title, -0.5,
     'Why is it useful to learn about this topic?',
     '[{"id":"A","label":"It helps you understand the world"},{"id":"B","label":"It has no use"},{"id":"C","label":"Only teachers need it"},{"id":"D","label":"It is a secret"}]'::jsonb,
     'A',
     'Consider how knowledge helps in everyday life.',
     'Learning new topics expands how we understand the world.'),

    (ci.id, ci.subject, ci.title, 0.0,
     'Which approach helps you remember what you learn?',
     '[{"id":"A","label":"Practicing and reviewing"},{"id":"B","label":"Ignoring the content"},{"id":"C","label":"Reading once quickly"},{"id":"D","label":"Memorizing without understanding"}]'::jsonb,
     'A',
     'Think about habits of good learners.',
     'Practice and review are proven techniques for retention.'),

    (ci.id, ci.subject, ci.title, 0.8,
     'What should you do when you encounter something unfamiliar in the lesson?',
     '[{"id":"A","label":"Ask a question or look it up"},{"id":"B","label":"Skip it completely"},{"id":"C","label":"Pretend you understand"},{"id":"D","label":"Give up on the lesson"}]'::jsonb,
     'A',
     'Curiosity is a learner superpower.',
     'Asking questions and seeking clarity is how learning happens.'),

    (ci.id, ci.subject, ci.title, 1.5,
     'How can you apply what you learned to a new situation?',
     '[{"id":"A","label":"Connect the idea to real examples"},{"id":"B","label":"Forget about it"},{"id":"C","label":"Only use it on tests"},{"id":"D","label":"Never talk about it again"}]'::jsonb,
     'A',
     'Transfer of learning is key.',
     'Connecting ideas to real contexts makes learning meaningful and transferable.');
  END LOOP;
END $$;

-- Report how many questions we have now
SELECT
  ci.title,
  COUNT(qb.id) AS question_count
FROM content_items ci
LEFT JOIN question_bank qb ON qb.content_id = ci.id
GROUP BY ci.title
ORDER BY ci.title;
