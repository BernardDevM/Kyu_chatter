import { describe, it, expect } from 'vitest';
import { toPresenceResponse } from '../../src/chat/dto/presence.response.js';

describe('toPresenceResponse (docs/API.md §5.1)', () => {
  it('maps the internal snapshot to a dictionary of ONLINE/OFFLINE statuses', () => {
    const res = toPresenceResponse({
      presence: {
        usr_1: { online: true, lastSeenAt: null },
        usr_2: { online: false, lastSeenAt: '2026-11-02T03:30:00.000Z' },
        usr_3: { online: false, lastSeenAt: null },
      },
    });

    expect(res).toEqual({
      usr_1: { status: 'ONLINE' },
      usr_2: { status: 'OFFLINE', lastSeenAt: '2026-11-02T03:30:00.000Z' },
      usr_3: { status: 'OFFLINE' },
    });
  });

  it('returns an empty dictionary for an empty snapshot', () => {
    expect(toPresenceResponse({ presence: {} })).toEqual({});
  });
});
