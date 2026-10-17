"""Server-scored spelling and comprehension, with persistent component completion."""
import json
import time
import unicodedata
from classroom import ClassroomError
import learning


def initial(card):
    questions = card.get('comprehension', {}).get('questions', [])
    return {'spellingCorrect': False, 'spellingMisses': 0,
            'questionsCorrect': [False] * len(questions), 'comprehensionMisses': 0}


def stored(row, card):
    return json.loads(row['content']) if row else initial(card)


def check(store, user, data):
    if user['role'] != 'student':
        raise ClassroomError('Sign in as a student to answer assigned activities.', 403)
    card_id, kind = data.get('cardId'), data.get('activity')
    if not isinstance(card_id, str) or kind not in ('spelling', 'comprehension'):
        raise ClassroomError('Choose an assigned activity.')
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM assignments WHERE student_id=? AND card_id=? AND active=1', (user['id'], card_id)).fetchone()
        if not row:
            raise ClassroomError('Assigned activity not found.', 404)
        card = json.loads(row['card'])
        if not learning.advanced(card):
            raise ClassroomError('Use read-aloud practice for this word.', 409)
        try:
            content = learning.ready(card)
        except ValueError as error:
            raise ClassroomError('Your teacher needs to finish preparing this ring. ' + str(error), 409)
        saved = db.execute('SELECT content FROM activity_progress WHERE student_id=? AND card_id=?', (user['id'], card_id)).fetchone()
        progress = stored(saved, card)
        if len(progress['questionsCorrect']) != len(content['questions']):
            raise ClassroomError('This activity changed. Ask your teacher to assign a new card.', 409)
        counted, correct = False, True
        if kind == 'spelling':
            answer = data.get('answer')
            if not isinstance(answer, str) or not 1 <= len(answer.strip()) <= 100:
                raise ClassroomError('Type the word shown by the picture.')
            if not progress['spellingCorrect'] and not row['correct']:
                correct = unicodedata.normalize('NFKC', answer).strip().casefold() == unicodedata.normalize('NFKC', card['word']).strip().casefold()
                counted = True
                progress['spellingCorrect'] = correct
                if not correct:
                    progress['spellingMisses'] += 1
        else:
            if not progress['spellingCorrect'] and not row['correct']:
                raise ClassroomError('Finish spelling this word before its reading questions.', 409)
            index, answer = data.get('questionIndex'), data.get('answer')
            if type(index) is not int or not 0 <= index < len(content['questions']) or type(answer) is not int or not 0 <= answer < 3:
                raise ClassroomError('Choose an answer to the current question.')
            first = next((i for i, done in enumerate(progress['questionsCorrect']) if not done), len(content['questions']))
            if index > first:
                raise ClassroomError('Finish the current question first.', 409)
            if not progress['questionsCorrect'][index] and not row['correct']:
                correct = answer == content['questions'][index]['answer']
                counted = True
                progress['questionsCorrect'][index] = correct
                if not correct:
                    progress['comprehensionMisses'] += 1
        complete = bool(progress['spellingCorrect'] and all(progress['questionsCorrect']))
        if counted:
            db.execute('INSERT INTO activity_progress VALUES (?,?,?) ON CONFLICT(student_id,card_id) DO UPDATE SET content=excluded.content',
                       (user['id'], card_id, json.dumps(progress)))
            db.execute('UPDATE assignments SET attempts=attempts+1,misses=misses+?,correct=?,earned_at=? WHERE student_id=? AND card_id=? AND correct=0',
                       (int(not correct), int(complete), time.time() if complete else None, user['id'], card_id))
        updated = db.execute('SELECT * FROM assignments WHERE student_id=? AND card_id=?', (user['id'], card_id)).fetchone()
    message = ('Great spelling! Now read the passage.' if kind == 'spelling' else 'That’s right!') if correct else ('Let’s hear the word, then try spelling it again.' if kind == 'spelling' else 'Try again. Look back at the passage for a clue.')
    return {'outcome': 'correct' if correct else 'retry', 'message': message, 'activityProgress': progress,
            'progress': {'misses': updated['misses'], 'correct': bool(updated['correct']), 'attempts': updated['attempts'], 'earnedAt': updated['earned_at']}}
