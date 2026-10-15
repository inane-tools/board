import { expect, it } from 'vitest';
import { exportName, itemText } from './itemTransfer';
import { makeMoodItem } from './board';
it('copies readable notes and links instead of private item JSON', () => { expect(itemText(makeMoodItem('note', { text: 'Project idea' }))).toBe('Project idea'); expect(itemText(makeMoodItem('link', { url: 'https://example.com', text: 'Example' }))).toBe('https://example.com'); });
it('preserves imported filenames and uses useful types for generated exports', () => { expect(exportName(makeMoodItem('image', { name: 'Photo.jpg' }))).toBe('Photo.jpg'); expect(exportName(makeMoodItem('link'))).toBe('Link.url'); expect(exportName(makeMoodItem('note'))).toBe('Note.txt'); });
