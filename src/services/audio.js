(function () {
'use strict';
var root=typeof window!=='undefined'?window:global;
var CONFIG=root.CONFIG,Platform=root.Platform,Settings=root.Settings;
var AudioFX = {
    ctx: null,
    master: null,
    voices: [],
    last: -1,
    disabled: false,
    unlock: function () {
      if (this.disabled) return;
      try {
        if (!this.ctx) {
          this.ctx = Platform.createAudioContext();
          if (!this.ctx) {
            this.disabled = true;
            return;
          }
          this.master = this.ctx.createGain();
          this.master.connect(this.ctx.destination);
          for (var i = 0; i < CONFIG.POLISH.VOICES; i++) {
            var oscillator = this.ctx.createOscillator();
            var gain = this.ctx.createGain();
            oscillator.type = 'triangle';
            gain.gain.value = 0;
            oscillator.connect(gain);
            gain.connect(this.master);
            oscillator.start();
            this.voices.push({
              oscillator: oscillator,
              gain: gain,
              until: 0
            });
          }
          this.setEnabled();
        }
        // 微信 WebAudio 可能需要 resume
        if (this.ctx.state === 'suspended' && this.ctx.resume) {
          this.ctx.resume().catch(function () {});
        }
      } catch (error) {
        this.disabled = true;
      }
    },
    setEnabled: function () {
      if (this.master && Settings) {
        this.master.gain.value = Settings.sound ? CONFIG.POLISH.VOLUME : 0;
      }
    },
    play: function (name) {
      if (!this.ctx || !Settings || !Settings.sound) return;
      if (this.ctx.state !== 'running') return;
      var now = this.ctx.currentTime;
      if (now - this.last < CONFIG.POLISH.AUDIO_GAP && name !== 'level') return;
      for (var i = 0; i < this.voices.length; i++) {
        var voice = this.voices[i];
        if (voice.until > now) continue;
        var tone = CONFIG.POLISH.TONES[name];
        if (!tone) return;
        voice.oscillator.frequency.setValueAtTime(tone[0], now);
        voice.oscillator.frequency.exponentialRampToValueAtTime(tone[1], now + tone[2]);
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(1, now);
        voice.gain.gain.exponentialRampToValueAtTime(0.001, now + tone[2]);
        voice.gain.gain.setValueAtTime(0, now + tone[2]);
        voice.until = now + tone[2];
        this.last = now;
        return;
      }
    }
  };
root.AudioFX = AudioFX;
})();
