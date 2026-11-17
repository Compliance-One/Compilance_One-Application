import { bestTranscript, freshFinal } from '../voice/speechResults';

describe('speech result de-dup', () => {
  it('uses the first alternative only', () => {
    expect(bestTranscript([{ transcript: 'rice' }, { transcript: 'rice' }, { transcript: 'rise' }])).toBe('rice');
    expect(bestTranscript(undefined)).toBe('');
  });
  it('drops a repeated final', () => {
    expect(freshFinal('', '2 kilo rice 60')).toBe('2 kilo rice 60');
    expect(freshFinal('2 kilo rice 60', '2 kilo rice 60')).toBeNull();
    expect(freshFinal('2 kilo rice 60', ' 2  Kilo rice 60 ')).toBeNull();
  });
  it('keeps only new words when earlier words are re-sent', () => {
    expect(freshFinal('2 kilo rice 60', '2 kilo rice 60 1 sugar 45')).toBe('1 sugar 45');
  });
  it('treats a different phrase as new', () => {
    expect(freshFinal('2 kilo rice 60', '1 sugar 45')).toBe('1 sugar 45');
  });
});
