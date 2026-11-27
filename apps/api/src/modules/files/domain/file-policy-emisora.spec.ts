import { describe, expect, it } from 'vitest';

import {
  EMISORA_AUDIO_DETECTED_ALIASES,
  EMISORA_AUDIO_MIME_LIST,
  emisoraAudioExtensionMatches,
  isEmisoraAudioMime,
  isEmisoraAudioPolicy,
} from './file-policy-emisora.js';

/** EM-PA-10: lista de audio cerrada, opt-in y sin efecto en la política `default`. */

describe('política opt-in de audio de la emisora', () => {
  it('admite solo mpeg, wav y ogg', () => {
    expect([...EMISORA_AUDIO_MIME_LIST].sort()).toEqual(
      ['audio/mpeg', 'audio/ogg', 'audio/wav'].sort(),
    );
    expect(isEmisoraAudioMime('audio/mpeg')).toBe(true);
    expect(isEmisoraAudioMime('audio/ogg')).toBe(true);
    expect(isEmisoraAudioMime('audio/wav')).toBe(true);
    for (const mime of ['application/pdf', 'image/png', 'audio/aac', '']) {
      expect(isEmisoraAudioMime(mime), mime).toBe(false);
    }
  });

  it('exige extensión coherente con el MIME declarado', () => {
    expect(emisoraAudioExtensionMatches('audio/mpeg', 'programa.MP3')).toBe(true);
    expect(emisoraAudioExtensionMatches('audio/wav', 'entrevista.wav')).toBe(true);
    expect(emisoraAudioExtensionMatches('audio/ogg', 'promo.ogg')).toBe(true);
    expect(emisoraAudioExtensionMatches('audio/mpeg', 'programa.wav')).toBe(false);
    expect(emisoraAudioExtensionMatches('audio/wav', 'entrevista')).toBe(false);
  });

  it('acepta los alias de detección y no activa la política por defecto', () => {
    expect(EMISORA_AUDIO_DETECTED_ALIASES['audio/wav']).toContain('audio/x-wav');
    expect(isEmisoraAudioPolicy('emisora-audio')).toBe(true);
    expect(isEmisoraAudioPolicy('default')).toBe(false);
    expect(isEmisoraAudioPolicy(undefined)).toBe(false);
  });
});
