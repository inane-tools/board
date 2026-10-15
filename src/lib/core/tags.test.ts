import { expect, it } from 'vitest';
import { normalizeTag, tagColor, collectTags } from './tags';
import { makeBoard, makeMoodItem } from './board';
it('normalizes searchable names without losing Unicode', () => { expect(normalizeTag(' @Project Ideas! ')).toBe('project-ideas'); expect(normalizeTag(' @café ')).toBe('café'); });
it('uses saved colors and gives legacy tags a stable fallback', () => { expect(tagColor('idea', [{ name: 'idea', color: '#123456' }])).toBe('#123456'); expect(tagColor('idea')).toBe(tagColor('idea')); expect(tagColor('idea')).toMatch(/^#[0-9a-f]{6}$/i); });
it('collects tags from boards, items and unused definitions', () => { const board = makeBoard('canvas', null); board.tags = ['work']; board.items = [makeMoodItem('note', { tags: ['idea', 'work'] })]; expect(collectTags([board], [{ name: 'unused', color: '#123456' }])).toEqual(['idea', 'unused', 'work']); });
