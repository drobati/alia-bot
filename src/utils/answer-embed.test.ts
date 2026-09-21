import { buildAnswerEmbed } from './answer-embed';

describe('buildAnswerEmbed', () => {
    it('shows the title, the body and the source', () => {
        const embed = buildAnswerEmbed({
            title: 'Paris',
            body: 'Paris is the capital of France.',
            url: 'https://en.wikipedia.org/wiki/Paris',
            sourceLabel: 'Wikipedia',
        });
        const json = embed.toJSON();

        expect(json.title).toBe('Paris');
        expect(json.description).toBe('Paris is the capital of France.');
        expect(json.url).toBe('https://en.wikipedia.org/wiki/Paris');
        expect(json.footer?.text).toBe('Source: Wikipedia');
    });

    it('omits the url when the tool has none', () => {
        const embed = buildAnswerEmbed({ title: '36', body: '15% of 240 is 36', sourceLabel: 'mathjs' });
        expect(embed.toJSON().url).toBeUndefined();
    });

    it('truncates a body past the Discord description limit', () => {
        const embed = buildAnswerEmbed({ title: 't', body: 'x'.repeat(5000), sourceLabel: 's' });
        expect(embed.toJSON().description!.length).toBeLessThanOrEqual(4096);
    });

    it('truncates a title past the Discord title limit', () => {
        const embed = buildAnswerEmbed({ title: 'x'.repeat(400), body: 'b', sourceLabel: 's' });
        expect(embed.toJSON().title!.length).toBeLessThanOrEqual(256);
    });
});
