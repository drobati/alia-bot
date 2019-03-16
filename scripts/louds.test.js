import { listenForLouds } from './louds';

test('should respond to loud', () => {
    const mockChannelSend = jest.fn(x => x);
    const message = { content: 'fear', channel: { send: mockChannelSend } };
    listenForLouds(message);
    expect(mockChannelSend.mock.calls).toHaveLength(1);
});

test('should not respond to regular message', () => {
    const mockChannelSend = jest.fn(x => x);
    const message = { content: 'message', channel: { send: mockChannelSend } };
    listenForLouds(message);
    expect(mockChannelSend.mock.calls).toHaveLength(0);
});
