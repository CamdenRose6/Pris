import unittest
from server import validate

class LessonValidationTests(unittest.TestCase):
    def card(self):
        return dict(word='cat', definition='An animal.', sentence='A cat naps.', imagePrompt='A cat', hint='Meow', quiz=dict(question='Which says meow?', choices=['cat','dog','bird'], answer=0))

    def test_valid_lesson(self):
        self.assertEqual(validate({'cards':[self.card()]})['source'], 'gemma')

    def test_invalid_correct_answer_is_rejected(self):
        card=self.card()
        card['quiz']['answer']=3
        with self.assertRaises(ValueError): validate({'cards':[card]})

    def test_incomplete_lesson_is_rejected(self):
        with self.assertRaises(ValueError): validate({'cards':[{'word':'cat'}]})

    def test_empty_lesson_is_rejected(self):
        with self.assertRaises(ValueError): validate({'cards':[]})
