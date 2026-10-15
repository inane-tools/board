import { expect, it } from 'vitest';
import { mediaUrl, droppedLink } from './mediaUrl';
it('recognizes image and video URL paths despite signed queries and fragments', () => {
  expect(mediaUrl('https://example.com/Photo.JPG?token=a#x')?.kind).toBe('image');
  expect(mediaUrl('https://example.com/cat.gif')?.kind).toBe('image');
  expect(mediaUrl('https://example.com/movie.webm?download=1')?.kind).toBe('video');
  expect(mediaUrl('https://example.com/photo%2Epng')?.kind).toBe('image');
});
it('keeps ordinary links and unsupported schemes out of the downloader', () => {
  expect(mediaUrl('https://example.com/page?file=photo.png')).toBeNull();
  expect(mediaUrl('file:///photo.jpg')).toBeNull(); expect(mediaUrl('javascript:photo.jpg')).toBeNull();
  expect(mediaUrl('https://example.com/invalid%name.png')).toBeNull();
});
it('uses the actual dragged URL instead of its display label', () => {
  expect(droppedLink('# A browser link\r\nhttps://example.com/cat.gif\r\n', 'Cute cat')).toBe('https://example.com/cat.gif');
  expect(droppedLink('', 'A note')).toBe('A note');
});
