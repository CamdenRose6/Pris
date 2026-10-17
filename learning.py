"""Validated Grade 2+ learning content shared by persistence and answer checking."""

def advanced(card):
    return str(card.get('grade', '')) in ('2', '3', '4', '5')


def comprehension(value):
    if not isinstance(value, dict):
        raise ValueError('Add a passage and comprehension questions.')
    passage = value.get('passage')
    questions = value.get('questions')
    if not isinstance(passage, str) or not 1 <= len(passage.strip()) <= 1200:
        raise ValueError('Use a reading passage of 1–1200 characters.')
    if not isinstance(questions, list) or not 1 <= len(questions) <= 2:
        raise ValueError('Add one or two comprehension questions.')
    cleaned = []
    for question in questions:
        if not isinstance(question, dict):
            raise ValueError('Invalid comprehension question.')
        text, choices, answer = question.get('question'), question.get('choices'), question.get('answer')
        if not isinstance(text, str) or not 1 <= len(text.strip()) <= 300:
            raise ValueError('Each question needs 1–300 characters.')
        if not isinstance(choices, list) or len(choices) != 3 or any(not isinstance(choice, str) or not 1 <= len(choice.strip()) <= 100 for choice in choices):
            raise ValueError('Each question needs three choices of 1–100 characters.')
        if type(answer) is not int or not 0 <= answer < 3:
            raise ValueError('Choose the correct answer for each question.')
        cleaned.append({'question': text.strip(), 'choices': [choice.strip() for choice in choices], 'answer': answer})
    return {'passage': passage.strip(), 'questions': cleaned}


def ready(card):
    if not (card.get('emoji') or (card.get('imageApproved') is True and card.get('imageUrl'))):
        raise ValueError('Add and approve a picture clue for ' + card['word'] + ' before assigning its spelling activity.')
    return comprehension(card.get('comprehension'))


def generation_guidance(grade):
    if grade not in ('4', '5'):
        return ('Write a short passage of 2–4 sentences appropriate to the grade, with one or two '
                'unambiguous questions answerable directly from it.')
    length = '100–140' if grade == '4' else '140–180'
    skills = ('Ask one inference question about motivation, cause and effect, or an implied main idea, '
              'then one question identifying the strongest passage evidence for that inference.'
              if grade == '4' else
              'Ask one question evaluating competing explanations, a claim, or the author’s purpose '
              'by combining details across paragraphs; then one question choosing the strongest '
              'evidence or identifying a limitation of that conclusion.')
    return (f'Grade {grade} reading comprehension must be challenging. The JSON examples show structure only, not difficulty. Write {length} words in '
            'two connected paragraphs, within 1200 characters. Include several relevant details, '
            'some nonessential details, varied sentence structures, and vocabulary understandable '
            'from context. Include exactly two questions. ' + skills +
            ' Neither question may be simple naming or copying a stated fact. Use three plausible, '
            'similarly sized choices: one fully supported answer and two distractors based on '
            'a partial reading, an unsupported inference, or a confused cause and effect. Avoid '
            'silly distractors, giveaway wording, and outside-knowledge requirements. Do not reveal '
            'one answer in the wording of the other question. Keep the spelling word concrete, '
            'but do not simplify the passage to the spelling word’s level.')


def generated_comprehension(value, grade):
    result = comprehension(value)
    if grade in ('4', '5'):
        minimum = 90 if grade == '4' else 120
        if len(result['passage'].split()) < minimum or len(result['questions']) != 2:
            raise ValueError(f'Grade {grade} needs a longer passage and two reasoning questions. Regenerate the lesson.')
    return result
