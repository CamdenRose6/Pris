import tempfile
import unittest
from pathlib import Path
import classroom
import ring_requests

class RequestTests(unittest.TestCase):
    def setUp(self):
        directory=tempfile.TemporaryDirectory();self.addCleanup(directory.cleanup)
        self.store=classroom.Store(Path(directory.name)/'test.sqlite3')
        self.teacher=self.store.create_user({'username':'teacher','password':'teacher-password','name':'Teacher'})
        self.student=self.store.create_user({'username':'student','password':'student-password','name':'Student'},self.teacher)
        self.other=self.store.create_user({'username':'other-teacher','password':'other-teacher-password','name':'Other'})
        self.classmate=self.store.create_user({'username':'classmate','password':'student-password','name':'Classmate'},self.teacher)

    def test_request_survives_reopen_and_is_visible_only_to_own_teacher_and_student(self):
        result=ring_requests.create(self.store,self.student,{'topic':'Sports'})
        reopened=classroom.Store(self.store.path)
        self.assertEqual(ring_requests.listing(reopened,self.teacher)['requests'][0]['id'],result['id'])
        self.assertEqual(ring_requests.listing(reopened,self.student)['requests'][0]['topic'],'Sports')
        self.assertEqual(ring_requests.listing(reopened,self.other)['requests'],[])
        self.assertEqual(ring_requests.listing(reopened,self.classmate)['requests'],[])

    def test_review_is_teacher_owned_and_decision_is_stable(self):
        request=ring_requests.create(self.store,self.student,{'topic':'Animals'})
        for user in (self.other,self.student):
            with self.assertRaises(classroom.ClassroomError):ring_requests.review(self.store,user,{'requestId':request['id'],'decision':'approved'})
        ring_requests.review(self.store,self.teacher,{'requestId':request['id'],'decision':'approved'})
        ring_requests.review(self.store,self.teacher,{'requestId':request['id'],'decision':'approved'})
        with self.assertRaises(classroom.ClassroomError):ring_requests.review(self.store,self.teacher,{'requestId':request['id'],'decision':'denied'})
        self.assertEqual(ring_requests.listing(self.store,self.student)['requests'][0]['status'],'approved')

    def test_only_approved_requests_can_link_a_ring_from_the_same_teacher(self):
        request=ring_requests.create(self.store,self.student,{'topic':'Space'})
        self.store.save_library(self.teacher,{'cards':[],'folders':['Space']})
        with self.assertRaises(classroom.ClassroomError):ring_requests.link_ring(self.store,self.teacher,{'requestId':request['id'],'ring':'Space'})
        ring_requests.review(self.store,self.teacher,{'requestId':request['id'],'decision':'approved'})
        for user,ring in ((self.other,'Space'),(self.teacher,'Missing'),(self.student,'Space')):
            with self.assertRaises(classroom.ClassroomError):ring_requests.link_ring(self.store,user,{'requestId':request['id'],'ring':ring})
        ring_requests.link_ring(self.store,self.teacher,{'requestId':request['id'],'ring':'Space'})
        self.assertEqual(ring_requests.listing(self.store,self.student)['requests'][0]['ring'],'Space')
        self.assertEqual(self.store.workspace(self.student)['library']['cards'],[])

    def test_limits_duplicates_and_role_checks(self):
        with self.assertRaises(classroom.ClassroomError):ring_requests.create(self.store,self.teacher,{'topic':'Space'})
        for topic in ('', ' '*4, 'a'*81, 3):
            with self.assertRaises(classroom.ClassroomError):ring_requests.create(self.store,self.student,{'topic':topic})
        ring_requests.create(self.store,self.student,{'topic':'Sports'})
        with self.assertRaises(classroom.ClassroomError):ring_requests.create(self.store,self.student,{'topic':' sports '})
        for topic in ('Movies','Animals','Space','Music'):ring_requests.create(self.store,self.student,{'topic':topic})
        with self.assertRaises(classroom.ClassroomError):ring_requests.create(self.store,self.student,{'topic':'Ocean'})

    def test_denied_request_does_not_create_or_assign_any_words(self):
        request=ring_requests.create(self.store,self.student,{'topic':'Animals'})
        ring_requests.review(self.store,self.teacher,{'requestId':request['id'],'decision':'denied'})
        self.assertEqual(ring_requests.listing(self.store,self.student)['requests'][0]['status'],'denied')
        self.assertIsNone(self.store.workspace(self.teacher)['library'])
        self.assertEqual(self.store.workspace(self.student)['library']['cards'],[])
