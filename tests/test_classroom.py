import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import classroom
import server


class ClassroomTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = classroom.Store(Path(self.directory.name) / 'classroom.sqlite3')
        self.teacher = self.store.create_user({'username':'teacher','password':'teacher-test-password','name':'Teacher'})
        self.student = self.store.create_user({'username':'reader','password':'student-test-password','name':'Reader'}, self.teacher)
        self.library = {'cards':[{'id':'cat-card','word':'cat','folder':'Animals','sentence':'The cat naps.'}], 'folders':['Animals']}
        self.store.save_library(self.teacher, self.library)
        self.store.assign(self.teacher, {'studentId':self.student['id'],'cardIds':['cat-card']})

    def test_login_session_expiry_and_logout(self):
        user, token = self.store.login({'username':'TEACHER','password':'teacher-test-password'})
        self.assertEqual(user, self.teacher)
        self.assertEqual(self.store.user(token), self.teacher)
        with self.store.connect() as db:
            row = db.execute('SELECT * FROM users WHERE id=?', (user['id'],)).fetchone()
            self.assertNotEqual(row['password_hash'], 'teacher-test-password')
            self.assertNotIn(token, str(tuple(db.execute('SELECT * FROM sessions').fetchone())))
            db.execute('UPDATE sessions SET expires=0')
        self.assertIsNone(self.store.user(token))
        token=self.store.new_session(user['id']);self.store.logout(token)
        self.assertIsNone(self.store.user(token))
        with self.assertRaises(classroom.ClassroomError):
            self.store.login({'username':'teacher','password':'incorrect-password'})

    def test_progress_persists_and_success_is_not_undone_or_duplicated(self):
        self.store.record_result(self.student,'cat-card','retry')
        self.store.record_result(self.student,'cat-card','unclear')
        progress=self.store.record_result(self.student,'cat-card','correct')
        self.assertEqual(progress['misses'],1)
        self.assertEqual(progress['attempts'],2)
        self.assertTrue(progress['correct'])
        self.assertIsNotNone(progress['earnedAt'])
        self.assertEqual(self.store.record_result(self.student,'cat-card','retry'), progress)
        reopened=classroom.Store(self.store.path)
        self.assertEqual(reopened.workspace(self.student)['progress']['cat-card'],progress)
        self.assertTrue(reopened.dashboard(self.teacher)['students'][0]['words'][0]['correct'])
        self.assertEqual(reopened.dashboard(self.teacher)['students'][0]['words'][0]['earnedAt'],progress['earnedAt'])

    def test_student_cannot_mutate_teacher_data(self):
        for operation in [lambda:self.store.save_library(self.student,self.library),
                          lambda:self.store.dashboard(self.student),
                          lambda:self.store.assign(self.student,{'studentId':self.student['id'],'cardIds':['cat-card']}),
                          lambda:self.store.create_user({'username':'new','password':'student-password','name':'Other'},self.student)]:
            with self.assertRaises(classroom.ClassroomError) as caught:operation()
            self.assertEqual(caught.exception.status,403)

    def test_teacher_and_student_isolation(self):
        other=self.store.create_user({'username':'other','password':'other-teacher-password','name':'Other'})
        other_student=self.store.create_user({'username':'other-reader','password':'student-password','name':'Other reader'},other)
        self.assertEqual(self.store.dashboard(other)['students'][0]['words'],[])
        self.assertIsNone(self.store.workspace(other)['library'])
        with self.assertRaises(classroom.ClassroomError):
            self.store.assign(other,{'studentId':self.student['id'],'cardIds':['cat-card']})
        for operation in [lambda:self.store.assigned_card(other_student,'cat-card'),
                          lambda:self.store.record_result(other_student,'cat-card','correct')]:
            with self.assertRaises(classroom.ClassroomError):operation()

    def test_assignment_is_snapshot_and_reassignment_keeps_progress(self):
        self.store.record_result(self.student,'cat-card','correct')
        self.library['cards'][0]['word']='dog'
        self.store.save_library(self.teacher,self.library)
        self.assertEqual(self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['cat-card']})['assigned'],0)
        self.assertEqual(self.store.assigned_card(self.student,'cat-card')['word'],'cat')
        self.assertTrue(self.store.workspace(self.student)['progress']['cat-card']['correct'])

    def test_unassign_ring_is_scoped_and_reassign_restores_progress(self):
        self.library['cards'][0]['folder']='Animals'
        self.library['cards'].append({'id':'sun-card','word':'sun','folder':'Space'})
        self.library['folders'].append('Space')
        self.store.save_library(self.teacher,self.library)
        self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['sun-card']})
        self.store.record_result(self.student,'cat-card','correct')
        second=self.store.create_user({'username':'reader-two','password':'student-test-password','name':'Second'},self.teacher)
        self.store.assign(self.teacher,{'studentId':second['id'],'cardIds':['cat-card']})
        report=self.store.dashboard(self.teacher)
        self.assertEqual(report['students'][0]['words'][0]['folder'],'Animals')
        result=self.store.unassign_ring(self.teacher,{'studentId':self.student['id'],'ring':'Animals'})
        self.assertEqual(result['removed'],1)
        self.assertEqual([card['word'] for card in self.store.workspace(self.student)['library']['cards']],['sun'])
        self.assertEqual(len(self.store.workspace(second)['library']['cards']),1)
        self.assertEqual(len(self.store.workspace(self.teacher)['library']['cards']),2)
        with self.assertRaises(classroom.ClassroomError):self.store.assigned_card(self.student,'cat-card')
        with self.assertRaises(classroom.ClassroomError):self.store.record_result(self.student,'cat-card','correct')
        self.assertEqual(self.store.unassign_ring(self.teacher,{'studentId':self.student['id'],'ring':'Animals'})['removed'],0)
        self.assertEqual(self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['cat-card']})['assigned'],1)
        self.assertTrue(self.store.workspace(self.student)['progress']['cat-card']['correct'])

    def test_unassign_requires_teacher_ownership_and_http_route(self):
        other=self.store.create_user({'username':'other-owner','password':'teacher-test-password','name':'Other'})
        for user in [self.student,other]:
            with self.assertRaises(classroom.ClassroomError):self.store.unassign_ring(user,{'studentId':self.student['id'],'ring':'Animals'})
        token=self.store.new_session(self.teacher['id'])
        handler=self.handler('/api/classroom/unassign-ring',{'studentId':self.student['id'],'ring':'Animals'},token)
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,200)
        self.assertEqual(json.loads(handler.wfile.getvalue())['removed'],1)

    def test_invalid_library_and_credentials(self):
        self.library['cards'][0]['imageUrl']='javascript:alert(1)'
        with self.assertRaises(classroom.ClassroomError):self.store.save_library(self.teacher,self.library)
        with self.assertRaises(classroom.ClassroomError):self.store.create_user({'username':'teacher','password':'teacher-test-password','name':'Duplicate'})
        with self.assertRaises(classroom.ClassroomError):self.store.create_user({'username':'short','password':'short','name':'Short'})

    def handler(self,path,data,token='',origin='http://127.0.0.1:8765'):
        raw=json.dumps(data).encode();handler=server.Handler.__new__(server.Handler)
        handler.path=path;handler.client_address=('127.0.0.1',1234)
        handler.headers={'Content-Length':str(len(raw)),'Content-Type':'application/json','Host':'127.0.0.1:8765','Origin':origin,'Cookie':'wordring_session='+token}
        
        if token:
            user=self.store.user(token)
            if user:handler.headers['X-WordRing-User']=user['id']
        handler.rfile=io.BytesIO(raw);handler.wfile=io.BytesIO();handler.sent_headers={}
        handler.send_response=lambda status:setattr(handler,'status',status)
        handler.send_header=lambda name,value:handler.sent_headers.update({name:value})
        handler.end_headers=lambda:None
        return handler

    def test_http_cookie_and_cross_origin_rejection(self):
        server.LOGIN_ATTEMPTS.clear()
        handler=self.handler('/api/account/login',{'username':'reader','password':'student-test-password'})
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,200)
        cookie=handler.sent_headers['Set-Cookie'];self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Strict',cookie)
        self.assertEqual(handler.sent_headers['Cache-Control'],'no-store')
        handler=self.handler('/api/account/login',{},origin='https://other.example')
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,403)

    def test_server_scores_assigned_word_not_client_word(self):
        token=self.store.new_session(self.student['id'])
        handler=self.handler('/api/reading-check',{'word':'dog','cardId':'cat-card','audio':'fake','mime':'audio/webm'},token)
        with patch('server.STORE',self.store), patch('reading_check.check',return_value={'outcome':'correct','message':'Great!','transcript':'cat'}) as check:
            handler.do_POST()
        self.assertEqual(handler.status,200)
        self.assertEqual(check.call_args.args[0]['word'],'cat')
        self.assertTrue(json.loads(handler.wfile.getvalue())['progress']['correct'])
        handler=self.handler('/api/reading-check',{'word':'cat','cardId':'not-assigned'},token)
        with patch('server.STORE',self.store),patch('reading_check.check') as check:handler.do_POST()
        self.assertEqual(handler.status,404);check.assert_not_called()

    def test_student_creation_endpoints_and_generation_are_forbidden(self):
        token=self.store.new_session(self.student['id'])
        for path in ('/api/classroom/library','/api/classroom/students','/api/classroom/assign','/api/classroom/unassign-ring','/api/lesson','/api/image'):
            handler=self.handler(path,{},token)
            with patch('server.STORE',self.store):handler.do_POST()
            self.assertEqual(handler.status,403,path)

    def test_rate_limit_and_unauthenticated_access(self):
        server.LOGIN_ATTEMPTS.clear()
        server.LOGIN_ATTEMPTS['127.0.0.1']=(__import__('time').time(),20)
        handler=self.handler('/api/account/login',{'username':'reader','password':'student-test-password'})
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,429)
        server.LOGIN_ATTEMPTS.clear()
        handler=self.handler('/api/classroom/assign',{})
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,401)

    def test_stale_account_tab_cannot_write_or_score(self):
        token=self.store.new_session(self.student['id'])
        handler=self.handler('/api/reading-check',{'word':'cat','cardId':'cat-card'},token)
        handler.headers['X-WordRing-User']='another-account'
        with patch('server.STORE',self.store),patch('reading_check.check') as check:handler.do_POST()
        self.assertEqual(handler.status,409);check.assert_not_called()

    def test_assignments_exclude_unreviewed_images(self):
        card={'id':'new-card','word':'dog','folder':'Animals', 'pendingImageUrl':'/generated/'+'a'*64+'.png'}
        self.library['cards'].append(card);self.store.save_library(self.teacher,self.library)
        self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['new-card']})
        self.assertNotIn('pendingImageUrl',self.store.assigned_card(self.student,'new-card'))

    def test_removing_teacher_ring_preserves_student_assignments_and_progress(self):
        self.store.record_result(self.student,'cat-card','correct')
        self.store.save_library(self.teacher,{'cards':[],'folders':[]})
        self.assertEqual(self.store.workspace(self.teacher)['library']['cards'],[])
        workspace=self.store.workspace(self.student)
        self.assertEqual(workspace['library']['cards'][0]['word'],'cat')
        self.assertTrue(workspace['progress']['cat-card']['correct'])

    def test_bulk_assignment_reaches_only_own_students_and_preserves_progress(self):
        second=self.store.create_user({'username':'second-reader','password':'student-password','name':'Second'},self.teacher)
        other=self.store.create_user({'username':'other-teacher','password':'other-teacher-password','name':'Other'})
        outsider=self.store.create_user({'username':'outsider','password':'student-password','name':'Outside'},other)
        earned=self.store.record_result(self.student,'cat-card','correct')
        result=self.store.assign(self.teacher,{'allStudents':True,'cardIds':['cat-card','cat-card']})
        self.assertEqual(result,{'assigned':1,'students':2,'wordsPerStudent':1})
        self.assertEqual(self.store.workspace(self.student)['progress']['cat-card'],earned)
        self.assertEqual(len(self.store.workspace(second)['library']['cards']),1)
        self.assertEqual(self.store.workspace(outsider)['library']['cards'],[])
        self.assertEqual(self.store.assign(self.teacher,{'allStudents':True,'cardIds':['cat-card']})['assigned'],0)

    def test_bulk_assignment_rejects_invalid_targets_and_unknown_cards_without_writes(self):
        second=self.store.create_user({'username':'second-reader','password':'student-password','name':'Second'},self.teacher)
        for data in ({'allStudents':'true','cardIds':['cat-card']},
                     {'allStudents':True,'studentId':second['id'],'cardIds':['cat-card']},
                     {'allStudents':True,'cardIds':['cat-card','missing']}):
            with self.assertRaises(classroom.ClassroomError):self.store.assign(self.teacher,data)
        self.assertEqual(self.store.workspace(second)['library']['cards'],[])
        with self.assertRaises(classroom.ClassroomError):
            self.store.assign(self.student,{'allStudents':True,'cardIds':['cat-card']})
        empty=self.store.create_user({'username':'empty-teacher','password':'empty-classroom-password','name':'Empty'})
        with self.assertRaises(classroom.ClassroomError):
            self.store.assign(empty,{'allStudents':True,'cardIds':['cat-card']})

    def test_ring_request_http_workflow_and_role_permissions(self):
        student_token=self.store.new_session(self.student['id'])
        teacher_token=self.store.new_session(self.teacher['id'])
        handler=self.handler('/api/classroom/requests',{'topic':'Animals'},student_token)
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,201)
        request_id=json.loads(handler.wfile.getvalue())['id']
        handler=self.handler('/api/classroom/request-review',{'requestId':request_id,'decision':'approved'},student_token)
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,403)
        handler=self.handler('/api/classroom/request-review',{'requestId':request_id,'decision':'approved'},teacher_token)
        with patch('server.STORE',self.store):handler.do_POST()
        self.assertEqual(handler.status,200)
        handler=self.handler('/api/classroom/requests',{},student_token)
        with patch('server.STORE',self.store):handler.do_GET()
        self.assertEqual(json.loads(handler.wfile.getvalue())['requests'][0]['status'],'approved')

    def test_lesson_count_and_exclusion_preferences_reach_gemma(self):
        card={'word':'cat','definition':'A pet.','sentence':'The cat sat.','imagePrompt':'A cat.','hint':'Meow.',
              'quiz':{'question':'Which animal says meow?','choices':['cat','dog','bird'],'answer':0}}
        handler=self.handler('/api/lesson',{'count':2,'exclude':['sun'],'grade':'K'})
        with patch('server.STORE',self.store),patch('server.gemma_configured',return_value=True),patch('server.request_gemma',return_value=json.dumps({'cards':[card,{**card,'word':'dog'}]})) as generate:
            handler.do_POST()
        self.assertEqual(handler.status,200)
        self.assertIn('Create exactly 2',generate.call_args.args[0])
        self.assertIn('"alreadyCreated": ["sun"]',generate.call_args.args[0])
        handler=self.handler('/api/lesson',{'count':200})
        with patch('server.STORE',self.store),patch('server.gemma_configured',return_value=True),patch('server.request_gemma') as generate:handler.do_POST()
        self.assertEqual(handler.status,400);generate.assert_not_called()

    def test_grade_two_activity_endpoint_and_voice_cannot_bypass_it(self):
        card={'id':'advanced','word':'fox','grade':'2','folder':'Animals','emoji':'🦊',
              'comprehension':{'passage':'The fox sits by a tree.','questions':[{'question':'Where does the fox sit?','choices':['By a tree','On a bed','In a shop'],'answer':0}]}}
        self.store.save_library(self.teacher,{'cards':[card],'folders':['Animals']})
        self.store.assign(self.teacher,{'studentId':self.student['id'],'cardIds':['advanced']})
        token=self.store.new_session(self.student['id'])
        handler=self.handler('/api/reading-check',{'cardId':'advanced','word':'fox','audio':'fake'},token)
        with patch('server.STORE',self.store),patch('reading_check.check') as recognize:handler.do_POST()
        self.assertEqual(handler.status,409);recognize.assert_not_called()
        for payload,complete in [({'activity':'spelling','answer':'fox'},False),({'activity':'comprehension','questionIndex':0,'answer':0},True)]:
            handler=self.handler('/api/classroom/activity-check',{'cardId':'advanced',**payload},token)
            with patch('server.STORE',self.store):handler.do_POST()
            self.assertEqual(handler.status,200)
            self.assertEqual(json.loads(handler.wfile.getvalue())['progress']['correct'],complete)

    def test_generated_grade_two_lessons_require_valid_comprehension_content(self):
        card={'word':'fox','definition':'A wild animal.','sentence':'The fox runs.','imagePrompt':'A fox.','hint':'A bushy tail.',
              'quiz':{'question':'Which animal has a bushy tail?','choices':['fox','cat','hen'],'answer':0}}
        for content,expected in [({},502),({'comprehension':{'passage':'The fox runs to a tree.','questions':[{'question':'Where does the fox run?','choices':['A tree','A bed','A shop'],'answer':0}]}},200)]:
            handler=self.handler('/api/lesson',{'grade':'2','words':'fox','count':1})
            with patch('server.STORE',self.store),patch('server.gemma_configured',return_value=True),patch('server.request_gemma',return_value=json.dumps({'cards':[{**card,**content}]})) as generate:handler.do_POST()
            self.assertEqual(handler.status,expected)
            self.assertIn('For EACH card also include a comprehension object',generate.call_args.args[0])

    def test_upper_grade_generation_rejects_beginner_passages(self):
        card={'word':'fox','definition':'A wild animal.','sentence':'The fox runs.',
              'imagePrompt':'A fox.','hint':'A bushy tail.',
              'quiz':{'question':'Which animal has a bushy tail?','choices':['fox','cat','hen'],'answer':0},
              'comprehension':{'passage':'The fox runs to a tree.', 'questions':[
                  {'question':'Where does the fox run?','choices':['A tree','A bed','A shop'],'answer':0}]}}
        for grade in ('4','5'):
            handler=self.handler('/api/lesson',{'grade':grade,'words':'fox','count':1})
            with patch('server.STORE',self.store),patch('server.gemma_configured',return_value=True),patch('server.request_gemma',return_value=json.dumps({'cards':[card]})) as generate:
                handler.do_POST()
            self.assertEqual(handler.status,502)
            prompt=generate.call_args.args[0]
            self.assertIn('exactly two questions',prompt)
            self.assertNotIn('answerable directly from it',prompt)
            self.assertIn('strongest passage evidence' if grade=='4' else 'competing explanations',prompt)
