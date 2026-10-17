import json
import tempfile
import unittest
from pathlib import Path
import classroom
import activities


class ActivityTests(unittest.TestCase):
    def setUp(self):
        directory=tempfile.TemporaryDirectory();self.addCleanup(directory.cleanup)
        self.store=classroom.Store(Path(directory.name)/'test.sqlite3')
        self.teacher=self.store.create_user({'username':'teacher','password':'teacher-password','name':'Teacher'})
        self.student=self.store.create_user({'username':'reader','password':'student-password','name':'Reader'},self.teacher)
        self.other=self.store.create_user({'username':'other-reader','password':'student-password','name':'Other'},self.teacher)
        self.card={'id':'fox-card','word':'fox','grade':'2','folder':'Animals','emoji':'🦊',
          'comprehension':{'passage':'A fox runs to a tree. The fox sits in the shade.', 'questions':[
           {'question':'Where does the fox run?','choices':['A tree','A house','A shop'],'answer':0},
           {'question':'Where does the fox sit?','choices':['In a pond','In the shade','On a bed'],'answer':1}]}}
        self.store.save_library(self.teacher,{'cards':[self.card],'folders':['Animals']})
        self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['fox-card']})

    def answer(self,kind,answer,**extra):
        return activities.check(self.store,self.student,{'cardId':'fox-card','activity':kind,'answer':answer,**extra})

    def test_removed_ring_blocks_activity_until_reassigned_and_keeps_component_progress(self):
        self.answer('spelling','fox')
        self.store.unassign_ring(self.teacher,{'studentId':self.student['id'],'ring':'Animals'})
        with self.assertRaises(classroom.ClassroomError) as caught:self.answer('comprehension',0,questionIndex=0)
        self.assertEqual(caught.exception.status,404)
        self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['fox-card']})
        self.assertTrue(self.store.workspace(self.student)['library']['cards'][0]['activityProgress']['spellingCorrect'])
        self.assertEqual(self.answer('comprehension',0,questionIndex=0)['outcome'],'correct')

    def test_both_activities_required_and_progress_persists(self):
        wrong=self.answer('spelling','foks')
        self.assertEqual(wrong['outcome'],'retry');self.assertEqual(wrong['activityProgress']['spellingMisses'],1)
        self.assertFalse(wrong['progress']['correct'])
        spelling=self.answer('spelling',' FOX ')
        self.assertTrue(spelling['activityProgress']['spellingCorrect']);self.assertFalse(spelling['progress']['correct'])
        with self.assertRaises(classroom.ClassroomError):self.answer('comprehension',1,questionIndex=1)
        retry=self.answer('comprehension',2,questionIndex=0);self.assertEqual(retry['outcome'],'retry')
        first=self.answer('comprehension',0,questionIndex=0);self.assertFalse(first['progress']['correct'])
        last=self.answer('comprehension',1,questionIndex=1);self.assertTrue(last['progress']['correct'])
        self.assertIsNotNone(last['progress']['earnedAt']);self.assertEqual(last['progress']['attempts'],5)
        self.assertEqual(last['progress']['misses'],2)
        repeated=self.answer('comprehension',1,questionIndex=1);self.assertEqual(repeated['progress'],last['progress'])
        reopened=classroom.Store(self.store.path).workspace(self.student)
        self.assertEqual(reopened['library']['cards'][0]['activityProgress'],last['activityProgress'])
        self.assertTrue(reopened['progress']['fox-card']['correct'])

    def test_spelling_cannot_accept_articles_or_punctuation_or_skip_to_reading(self):
        self.assertEqual(self.answer('spelling','the fox')['outcome'],'retry')
        self.assertEqual(self.answer('spelling','fox!')['outcome'],'retry')
        with self.assertRaises(classroom.ClassroomError):self.answer('comprehension',0,questionIndex=0)
        self.assertFalse(self.store.workspace(self.student)['progress']['fox-card']['correct'])

    def test_assignment_and_content_ownership_and_no_voice_bypass(self):
        for user in (self.teacher,self.other):
            with self.assertRaises(classroom.ClassroomError):activities.check(self.store,user,{'cardId':'fox-card','activity':'spelling','answer':'fox'})
        with self.assertRaises(classroom.ClassroomError):self.store.record_result(self.student,'fox-card','correct')
        self.answer('spelling','fox')
        for data in ({'questionIndex':True,'answer':0},{'questionIndex':0,'answer':False},{'questionIndex':0,'answer':3}):
            with self.assertRaises(classroom.ClassroomError):activities.check(self.store,self.student,{'cardId':'fox-card','activity':'comprehension',**data})

    def test_preparation_required_before_assigning_and_answer_keys_are_snapshots(self):
        draft={**self.card,'id':'draft','emoji':'','comprehension':None}
        self.store.save_library(self.teacher,{'cards':[draft],'folders':['Animals']})
        with self.assertRaises(classroom.ClassroomError):self.store.assign(self.teacher,{'studentId':self.other['id'],'cardIds':['draft']})
        self.assertEqual(self.store.workspace(self.other)['library']['cards'],[])
        self.card['comprehension']['questions'][0]['answer']=2
        self.store.save_library(self.teacher,{'cards':[self.card],'folders':['Animals']})
        self.answer('spelling','fox')
        self.assertEqual(self.answer('comprehension',0,questionIndex=0)['outcome'],'correct')

    def test_one_question_and_wrong_answers_never_award_completion(self):
        single={**self.card,'id':'single','comprehension':{**self.card['comprehension'],'questions':self.card['comprehension']['questions'][:1]}}
        self.store.save_library(self.teacher,{'cards':[single],'folders':['Animals']});self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['single']})
        activities.check(self.store,self.student,{'cardId':'single','activity':'spelling','answer':'fox'})
        for _ in range(3):
            result=activities.check(self.store,self.student,{'cardId':'single','activity':'comprehension','questionIndex':0,'answer':2})
            self.assertFalse(result['progress']['correct'])
        result=activities.check(self.store,self.student,{'cardId':'single','activity':'comprehension','questionIndex':0,'answer':0})
        self.assertTrue(result['progress']['correct'])
