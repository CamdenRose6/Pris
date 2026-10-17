"""Local classroom persistence. No recordings or transcripts are stored here."""
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
import learning
from contextlib import contextmanager
from pathlib import Path

DATABASE = Path(__file__).parent / '.wordring' / 'classroom.sqlite3'
ITERATIONS = 600_000
SESSION_SECONDS = 12 * 60 * 60


class ClassroomError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def credentials(data, minimum=8):
    username, password = data.get('username'), data.get('password')
    if not isinstance(username, str) or not re.fullmatch(r'[a-zA-Z0-9_.-]{3,40}', username):
        raise ClassroomError('Use a username of 3–40 letters, numbers, dots, dashes, or underscores.')
    if not isinstance(password, str) or not minimum <= len(password) <= 128:
        raise ClassroomError(f'Use a password of {minimum}–128 characters.')
    return username.lower(), password


def public_user(row):
    return {key: row[key] for key in ('id', 'username', 'name', 'role')}


def teacher_only(user):
    if not user or user['role'] != 'teacher':
        raise ClassroomError('A teacher account is required.', 403)


class Store:
    def __init__(self, path=None):
        self.path = Path(path or DATABASE)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher','student')),
                    teacher_id TEXT REFERENCES users(id), salt TEXT NOT NULL, password_hash TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS libraries (
                    teacher_id TEXT PRIMARY KEY REFERENCES users(id), content TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS activity_progress (
                    student_id TEXT NOT NULL, card_id TEXT NOT NULL, content TEXT NOT NULL,
                    PRIMARY KEY(student_id,card_id), FOREIGN KEY(student_id,card_id) REFERENCES assignments(student_id,card_id)
                );
                CREATE TABLE IF NOT EXISTS ring_requests (
                    id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id),
                    teacher_id TEXT NOT NULL REFERENCES users(id), topic TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending','approved','denied')),
                    created_at REAL NOT NULL, reviewed_at REAL, ring TEXT
                );
                CREATE TABLE IF NOT EXISTS assignments (
                    student_id TEXT NOT NULL REFERENCES users(id), card_id TEXT NOT NULL,
                    card TEXT NOT NULL, misses INTEGER NOT NULL DEFAULT 0,
                    correct INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0,
                    earned_at REAL, active INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(student_id, card_id)
                );
            ''')
            if 'active' not in {row['name'] for row in db.execute('PRAGMA table_info(assignments)')}:
                db.execute('ALTER TABLE assignments ADD COLUMN active INTEGER NOT NULL DEFAULT 1')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA foreign_keys=ON')
        try:
            with db:
                yield db
        finally:
            db.close()

    def create_user(self, data, teacher=None):
        role = 'student' if teacher else 'teacher'
        if teacher:
            teacher_only(teacher)
        username, password = credentials(data, 8 if teacher else 12)
        name = data.get('name')
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 60:
            raise ClassroomError('Enter a display name of 1–60 characters.')
        salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), ITERATIONS).hex()
        user_id = secrets.token_hex(16)
        try:
            with self.connect() as db:
                db.execute('INSERT INTO users VALUES (?,?,?,?,?,?,?)',
                           (user_id, username, name.strip(), role, teacher['id'] if teacher else None, salt, hashed))
        except sqlite3.IntegrityError:
            raise ClassroomError('That username is already taken.', 409)
        return {'id': user_id, 'username': username, 'name': name.strip(), 'role': role}

    def login(self, data):
        username, password = credentials(data)
        with self.connect() as db:
            user = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
        # Perform the same expensive hash even for an unknown username.
        salt = bytes.fromhex(user['salt']) if user else bytes(16)
        hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, ITERATIONS).hex()
        if not user or not hmac.compare_digest(hashed, user['password_hash']):
            raise ClassroomError('Username or password is incorrect.', 401)
        token = self.new_session(user['id'])
        return public_user(user), token

    def new_session(self, user_id):
        token = secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
            db.execute('INSERT INTO sessions VALUES (?,?,?)',
                       (hashlib.sha256(token.encode()).hexdigest(), user_id, time.time() + SESSION_SECONDS))
        return token

    def user(self, token):
        if not token:
            return None
        with self.connect() as db:
            row = db.execute('''SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id
                                WHERE s.token_hash=? AND s.expires>?''',
                             (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
        return public_user(row) if row else None

    def logout(self, token):
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE token_hash=?', (hashlib.sha256(token.encode()).hexdigest(),))

    def save_library(self, user, content):
        teacher_only(user)
        content = clean_library(content)
        with self.connect() as db:
            db.execute('INSERT INTO libraries VALUES (?,?) ON CONFLICT(teacher_id) DO UPDATE SET content=excluded.content',
                       (user['id'], json.dumps(content)))
        return content

    def workspace(self, user):
        with self.connect() as db:
            if user['role'] == 'teacher':
                row = db.execute('SELECT content FROM libraries WHERE teacher_id=?', (user['id'],)).fetchone()
                return {'library': json.loads(row['content']) if row else None}
            rows = db.execute('SELECT * FROM assignments WHERE student_id=? AND active=1 ORDER BY rowid', (user['id'],)).fetchall()
            activity_rows = {row['card_id']:json.loads(row['content']) for row in db.execute('SELECT * FROM activity_progress WHERE student_id=?',(user['id'],))}
        cards, progress = [], {}
        for row in rows:
            card=json.loads(row['card'])
            if row['card_id'] in activity_rows:card['activityProgress']=activity_rows[row['card_id']]
            cards.append(card)
            progress[row['card_id']] = {'misses': row['misses'], 'correct': bool(row['correct']),
                                        'attempts': row['attempts'], 'earnedAt': row['earned_at']}
        return {'library': {'cards': cards, 'folders': list(dict.fromkeys(c.get('folder', 'Assigned words') for c in cards))},
                'progress': progress}

    def dashboard(self, user):
        teacher_only(user)
        with self.connect() as db:
            students = db.execute("SELECT * FROM users WHERE teacher_id=? AND role='student' ORDER BY name", (user['id'],)).fetchall()
            result = []
            for student in students:
                assignments = db.execute('SELECT * FROM assignments WHERE student_id=? AND active=1 ORDER BY rowid', (student['id'],)).fetchall()
                result.append({**public_user(student), 'words': [
                    {'id': row['card_id'], 'word': json.loads(row['card'])['word'], 'folder': json.loads(row['card']).get('folder', 'Assigned words'), 'correct': bool(row['correct']),
                     'misses': row['misses'], 'attempts': row['attempts'], 'earnedAt': row['earned_at']} for row in assignments]})
        return {'students': result}

    def assign(self, user, data):
        teacher_only(user)
        ids = data.get('cardIds')
        if not isinstance(ids, list) or not 1 <= len(ids) <= 200 or not all(isinstance(i, str) for i in ids):
            raise ClassroomError('Choose at least one word to assign.')
        all_students = data.get('allStudents', False)
        if type(all_students) is not bool or (all_students and data.get('studentId')):
            raise ClassroomError('Choose one student or everyone in the class.')
        with self.connect() as db:
            if all_students:
                students = db.execute("SELECT id FROM users WHERE teacher_id=? AND role='student'", (user['id'],)).fetchall()
                if not students:
                    raise ClassroomError('Add a student before assigning a ring to everyone.')
            else:
                student = db.execute('SELECT id FROM users WHERE id=? AND teacher_id=? AND role=?',
                                     (data.get('studentId'), user['id'], 'student')).fetchone()
                if not student:
                    raise ClassroomError('Student not found in your classroom.', 404)
                students = [student]
            library = db.execute('SELECT content FROM libraries WHERE teacher_id=?', (user['id'],)).fetchone()
            cards = {c['id']: c for c in json.loads(library['content'])['cards']} if library else {}
            if any(card_id not in cards for card_id in ids):
                raise ClassroomError('Save these words before assigning them.')
            for card_id in ids:
                if learning.advanced(cards[card_id]):
                    try:learning.ready(cards[card_id])
                    except ValueError as error:raise ClassroomError(str(error))
            count = 0
            for card_id in dict.fromkeys(ids):
                # Snapshot assignments: future teacher edits never change the word being scored.
                card = dict(cards[card_id])
                card.pop('pendingImageUrl', None)
                card.pop('pendingImageModel', None)
                if not card.get('imageApproved'):
                    card.pop('imageUrl', None)
                    card.pop('imageModel', None)
                for student in students:
                    cursor = db.execute('INSERT INTO assignments(student_id,card_id,card) VALUES (?,?,?) ON CONFLICT(student_id,card_id) DO UPDATE SET active=1 WHERE assignments.active=0',
                                        (student['id'], card_id, json.dumps(card)))
                    count += cursor.rowcount
        return {'assigned': count, 'students': len(students), 'wordsPerStudent': len(set(ids))}

    def unassign_ring(self, user, data):
        teacher_only(user)
        student_id, ring = data.get('studentId'), data.get('ring')
        if not isinstance(student_id, str) or not isinstance(ring, str) or not ring:
            raise ClassroomError('Choose a student and an assigned ring.')
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            student = db.execute("SELECT id FROM users WHERE id=? AND teacher_id=? AND role='student'", (student_id, user['id'])).fetchone()
            if not student:
                raise ClassroomError('Student not found in your classroom.', 404)
            rows = db.execute('SELECT card_id,card FROM assignments WHERE student_id=? AND active=1', (student_id,)).fetchall()
            ids = [row['card_id'] for row in rows if json.loads(row['card']).get('folder', 'Assigned words') == ring]
            for card_id in ids:
                db.execute('UPDATE assignments SET active=0 WHERE student_id=? AND card_id=?', (student_id, card_id))
        return {'removed': len(ids)}

    def assigned_card(self, user, card_id):
        if not isinstance(card_id, str):
            raise ClassroomError('Choose an assigned word.', 400)
        with self.connect() as db:
            row = db.execute('SELECT card FROM assignments WHERE student_id=? AND card_id=? AND active=1', (user['id'], card_id)).fetchone()
        if not row:
            raise ClassroomError('Assigned word not found.', 404)
        return json.loads(row['card'])

    def record_result(self, user, card_id, outcome):
        if outcome not in ('correct', 'retry', 'unclear'):
            raise ClassroomError('Invalid reading outcome.')
        with self.connect() as db:
            row = db.execute('SELECT * FROM assignments WHERE student_id=? AND card_id=? AND active=1', (user['id'], card_id)).fetchone()
            if not row:
                raise ClassroomError('Assigned word not found.', 404)
            if learning.advanced(json.loads(row['card'])):
                raise ClassroomError('Complete spelling and comprehension for this word.',409)
            if not row['correct'] and outcome != 'unclear':
                db.execute('''UPDATE assignments SET attempts=attempts+1, misses=misses+?, correct=?, earned_at=?
                              WHERE student_id=? AND card_id=? AND correct=0''',
                           (int(outcome == 'retry'), int(outcome == 'correct'), time.time() if outcome == 'correct' else None,
                            user['id'], card_id))
            updated = db.execute('SELECT * FROM assignments WHERE student_id=? AND card_id=? AND active=1', (user['id'], card_id)).fetchone()
        return {'misses': updated['misses'], 'correct': bool(updated['correct']),
                'attempts': updated['attempts'], 'earnedAt': updated['earned_at']}


def clean_library(content):
    if not isinstance(content, dict) or not isinstance(content.get('cards'), list) or not isinstance(content.get('folders'), list):
        raise ClassroomError('Invalid word library.')
    if len(content['cards']) > 200 or len(content['folders']) > 40:
        raise ClassroomError('This local classroom supports up to 200 words and 40 folders.')
    if any(not isinstance(f, str) or not 1 <= len(f) <= 50 for f in content['folders']):
        raise ClassroomError('Invalid folder name.')
    cards, seen = [], set()
    for original in content['cards']:
        if not isinstance(original, dict):
            raise ClassroomError('Invalid word card.')
        card = {}
        for key in ('id', 'word', 'folder', 'grade', 'definition', 'sentence', 'hint', 'imagePrompt', 'emoji', 'source', 'imageModel', 'pendingImageModel'):
            value = original.get(key, '')
            if not isinstance(value, str) or len(value) > 600:
                raise ClassroomError('Invalid card field: ' + key)
            card[key] = value
        if not card['id'] or len(card['id']) > 100 or card['id'] in seen or not card['word'].strip() or len(card['word']) > 100:
            raise ClassroomError('Each word needs a unique ID and a short spelling.')
        if card['folder'] not in content['folders']:
            raise ClassroomError('Each word must belong to a folder.')
        seen.add(card['id'])
        for field in ('imageUrl', 'pendingImageUrl'):
            if original.get(field):
                if not isinstance(original[field], str) or not re.fullmatch(r'/generated/[a-f0-9]{64}\.(png|jpg|webp)', original[field]):
                    raise ClassroomError('Invalid picture URL.')
                card[field] = original[field]
        if original.get('imageApproved') is True:
            card['imageApproved'] = True
        if original.get('comprehension') is not None:
            try:card['comprehension']=learning.comprehension(original['comprehension'])
            except ValueError as error:raise ClassroomError(str(error))
        quiz = original.get('quiz')
        if quiz is not None:
            if (not isinstance(quiz, dict) or not isinstance(quiz.get('question'), str) or len(quiz['question']) > 600
                or not isinstance(quiz.get('choices'), list) or len(quiz['choices']) != 3
                or any(not isinstance(c, str) or len(c) > 600 for c in quiz['choices'])
                or type(quiz.get('answer')) is not int or not 0 <= quiz['answer'] < 3):
                raise ClassroomError('Invalid practice question.')
            card['quiz'] = quiz
        cards.append(card)
    return {'cards': cards, 'folders': content['folders']}
