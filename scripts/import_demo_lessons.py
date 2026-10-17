"""Add the public example rings to an existing local teacher, keeping other data."""
import argparse
import json
from pathlib import Path
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import classroom


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--teacher', required=True, help='Existing teacher username')
    args = parser.parse_args()
    fixture = json.loads((ROOT / 'demo' / 'example-lessons.json').read_text())
    store = classroom.Store()
    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        teacher = db.execute("SELECT id FROM users WHERE username=? AND role='teacher'", (args.teacher.strip().lower(),)).fetchone()
        if not teacher:
            parser.error('Create this teacher account in PRIS first.')
        row = db.execute('SELECT content FROM libraries WHERE teacher_id=?', (teacher['id'],)).fetchone()
        library = json.loads(row['content']) if row else {'cards': [], 'folders': []}
        missing = [name for name in fixture['folders'] if name not in library['folders']]
        cards = [{**card, 'id': str(uuid.uuid4())} for card in fixture['cards'] if card['folder'] in missing]
        content = classroom.clean_library({'cards': library['cards'] + cards, 'folders': library['folders'] + missing})
        db.execute('INSERT INTO libraries VALUES (?,?) ON CONFLICT(teacher_id) DO UPDATE SET content=excluded.content', (teacher['id'], json.dumps(content)))
    print(f'Added {len(missing)} example rings and {len(cards)} cards. Existing rings and assignments were kept. Refresh PRIS.')


if __name__ == '__main__':
    main()
