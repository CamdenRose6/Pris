"""Student ring ideas and teacher decisions; no external messages are sent."""
import json
import secrets
import time
from classroom import ClassroomError, teacher_only


def listing(store, user):
    with store.connect() as db:
        field = 'r.teacher_id' if user['role'] == 'teacher' else 'r.student_id'
        rows = db.execute(f'''SELECT r.*,u.name student_name FROM ring_requests r
                              JOIN users u ON r.student_id=u.id WHERE {field}=?
                              ORDER BY r.created_at DESC LIMIT 200''', (user['id'],)).fetchall()
    return {'requests': [{'id': row['id'], 'topic': row['topic'], 'status': row['status'],
                          'studentName': row['student_name'], 'createdAt': row['created_at'],
                          'reviewedAt': row['reviewed_at'], 'ring': row['ring']} for row in rows]}


def create(store, user, data):
    if user['role'] != 'student':
        raise ClassroomError('Only students can request a ring.', 403)
    topic = data.get('topic')
    if not isinstance(topic, str) or not 1 <= len(topic.strip()) <= 80:
        raise ClassroomError('Choose a ring idea of 1–80 characters.')
    topic = topic.strip()
    with store.connect() as db:
        # Serialize the pending-limit check and insertion across simultaneous requests.
        db.execute('BEGIN IMMEDIATE')
        student = db.execute('SELECT teacher_id FROM users WHERE id=?', (user['id'],)).fetchone()
        if not student or not student['teacher_id']:
            raise ClassroomError('Your account needs a teacher before requesting rings.', 403)
        pending = db.execute("SELECT topic FROM ring_requests WHERE student_id=? AND status='pending'", (user['id'],)).fetchall()
        if len(pending) >= 5:
            raise ClassroomError('You already have five ideas waiting for your teacher.', 409)
        if any(row['topic'].casefold() == topic.casefold() for row in pending):
            raise ClassroomError('That idea is already waiting for your teacher.', 409)
        request_id = secrets.token_hex(16)
        db.execute('INSERT INTO ring_requests VALUES (?,?,?,?,?,?,?,NULL)',
                   (request_id, user['id'], student['teacher_id'], topic, 'pending', time.time(), None))
    return {'id': request_id, 'status': 'pending'}


def review(store, user, data):
    teacher_only(user)
    decision = data.get('decision')
    if decision not in ('approved', 'denied'):
        raise ClassroomError('Choose approve or deny.')
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM ring_requests WHERE id=? AND teacher_id=?', (data.get('requestId'), user['id'])).fetchone()
        if not row:
            raise ClassroomError('Request not found in your classroom.', 404)
        if row['status'] != 'pending' and row['status'] != decision:
            raise ClassroomError('This request has already been reviewed.', 409)
        if row['status'] == 'pending':
            db.execute('UPDATE ring_requests SET status=?,reviewed_at=? WHERE id=?', (decision, time.time(), row['id']))
    return {'status': decision}


def link_ring(store, user, data):
    teacher_only(user)
    ring = data.get('ring')
    if not isinstance(ring, str) or not 1 <= len(ring) <= 50:
        raise ClassroomError('Choose a valid ring.')
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM ring_requests WHERE id=? AND teacher_id=?', (data.get('requestId'), user['id'])).fetchone()
        if not row:
            raise ClassroomError('Request not found in your classroom.', 404)
        if row['status'] != 'approved':
            raise ClassroomError('Approve this idea before creating its ring.', 409)
        if row['ring'] and row['ring'] != ring:
            raise ClassroomError('A ring is already linked to this request.', 409)
        library = db.execute('SELECT content FROM libraries WHERE teacher_id=?', (user['id'],)).fetchone()
        if not library or ring not in json.loads(library['content'])['folders']:
            raise ClassroomError('Save the ring in your collection first.')
        db.execute('UPDATE ring_requests SET ring=? WHERE id=?', (ring, row['id']))
    return {'ring': ring}
