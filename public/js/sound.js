/**
 * A simple manager for the Sound object
 */

class Sounds {
    /**
     * Stop all registered sounds
     */
    stop() {
        for (const sound in Sounds.Sounds) {
            if (Sounds.Sounds.hasOwnProperty(sound)) {
                Sounds.Sounds[sound].stop();
            }
        }
    }

    /**
     * Get a sound according to its created name
     * - Only available if created via static method `Sounds.Create(...)`, and not via `new Sound(...)`
     * @param  {String} name    Associated name of sound
     * @return {Sound | undefined}
     */
    static get(name) {
        return Sounds.Sounds[name];
    }

    /**
     * Get a sound using Sounds.Get, clone and play it
     * - Cloning allows multiple of this sound to play simultaneously
     * @param  {String} name    Associated name of sound
     * @return {Boolean} Sound played?
     */
    static play(name) {
        const sound = Sounds.get(name);
        if (sound) {
            const obj = sound.clone();
            obj.play();
            return true;
        } else {
            return false;
        }
    }

    /**
     * Create a new Sound object
     * @param  {String} name    Name of sound
     * @param  {String} path    Path to sound file
     * @param  {Boolean} loadNow    Fetch sound data from file now?
     * @return {Sound} Sound object
     */
    static async create(name, path, loadNow = true) {
        if (Sounds.Sounds[name] == undefined) {
            Sounds.Sounds[name] = new Sound(path);
            if (loadNow) {
                return await Sounds.Sounds[name].load();
            } else {
                return void 0;
            }
        } else {
            throw new Error(`Key '${name}' already exists`);
        }
    }

    /**
     * Say something using Speech Utterance
     * @param {String} speech   What to say
     * @param {String} lang     Language of voice
     * @default lang = "en-Gb"
     */
    static say(speech, lang = 'en-GB') {
        if (Sounds.isEnabled) {
            let msg = new SpeechSynthesisUtterance();
            msg.lang = lang;
            msg.text = speech;
            window.speechSynthesis.speak(msg);
        }
    }

    /**
     * Enable sound to be played
     */
    static enable() {
        Sounds.isEnabled = true;
    }

    /**
     * Disable sound from being played
     * - Pause all active sounds
     */
    static disable() {
        Sounds.isEnabled = false;
        for (const sound in Sounds.Sounds) {
            if (Sounds.Sounds.hasOwnProperty(sound)) {
                Sounds.Sounds[sound].pause();
            }
        }
    }
}

/**
 * Created Sound objects
 * @type {{[name: string]: Sound}}
*/
Sounds.Sounds = {};

/**
 * Is sound enabled?
 */
Sounds.isEnabled = true;

/**
 * Contains an indivdual track or sound
 */
class Sound {
    /**
     * @param {String} path     Path to sound file
     * @param {Boolean} fetch   Fetch sound data immediatly
     */
    constructor(path, fetch = true) {
        this.path = path;

        /**
         * Audio Data for sound
         * @type AudioBuffer
         */
        this.buffer = undefined;

        /**
         * Array of all active sounds
         * @type AudioBufferSourceNode
         */
        this.activeAudio = null;

        /**
         * Loop sounds?
         * - Change via this.loop() for desired effect
         */
        this._loop = false;

        /**
         * Is this sound playing?
         */
        this.isPlaying = false;

        /**
         * When paused; what time were we paused at?
         */
        this.pausedAt = NaN;

        this._volume = 1;

        this._loadInternal();

        if (fetch) {
            this.load();
        }
    }

    clone() {
        const obj = new Sound(this.path, false);
        obj.buffer = this.buffer;
        return obj;
    }

    _loadInternal() {
        this.ctx = new AudioContext();
        this.gainNode = this.ctx.createGain();
        this.gainNode.connect(this.ctx.destination);
        this.gainNode.gain.value = this._volume;
    }

    /**
     * Load audio data from this.path
     * @return {Sound} this
     * @async
     * @chainable
     */
    async load() {
        // Get URL
        const response = await fetch(this.path);

        // Get raw binary data
        const arraybuffer = await response.arrayBuffer();

        // Decode to audio buffer
        const audioBuffer = await this.ctx.decodeAudioData(arraybuffer);
        this.buffer = audioBuffer;
    }

    /**
     * Create audio buffer from array buffer
     * @param {ArrayBuffer} data    Data to decode to audio data
     * @return {AudioBuffer} AUdio data 
     */
    async loadArrayBuffer(arraybuffer) {
        this.buffer = await this.ctx.decodeAudioData(arraybuffer);
        return this.buffer;
    }

    /**
     * Play sound from a buffer
     * @param  {Function} whenEnded     Function to execute when ended
     * @return {Boolean} Playing sound?
     */
    play(whenEnded = undefined) {
        if (!Sounds.isEnabled || this.isPlaying) {
            return false;
        }


        // If buffer does not exit, create it
        if (this.buffer == undefined) {
            // Load then play sound

            this.load().then(() => this.play(whenEnded));
        }

        // Create source buffer
        let source = this.ctx.createBufferSource();
        source.buffer = this.buffer;

        // Create filter for buffer
        let filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 5000; // Default frequency

        // Connect source to things needed to play sound
        source.connect(this.gainNode);
        source.connect(filter);

        // Event handlers for finishing
        source.onended = () => {
            if (source.stop) source.stop();
            if (source.disconnect) source.disconnect();
            this.isPlaying = false;

            if (typeof whenEnded == "function") whenEnded();

            // Remove from audio array
            this.activeAudio = null;
            this.isPlaying = false;
        };

        // Play buffer from time = 0s
        source.loop = this._loop;
        this.activeAudio = source;

        if (isNaN(this.pausedAt)) {
            // Start from beginning
            source.start(0);
        } else {
            // Start from stored time
            let time = this.pausedAt - 0.7;
            if (time < 0) time = 0;

            source.start(0, time);
            this.pausedAt = NaN;
        }

        this.isPlaying = true;
        return true;
    }

    /**
    * Get/Set volume of sound
    * @param {Number} volume   Volume 0..1
    * @return {Number} Volume
    */
    volume(volume = undefined) {
        if (typeof volume === 'number') {
            volume = clamp(volume, 0, 1);
            this._volume = volume;
            this.gainNode.gain.value = volume;
        }
        return this._volume;
    }

    /**
     * Get/Set - Should we loop the sound?
     * @param {Boolean} value
     */
    loop(value = undefined) {
        if (typeof value == 'boolean') {
            this._loop = value;
            if (this.activeAudio) this.activeAudio.loop = value;
        }
        return this._loop;
    }

    /**
     * Pause the sound
     */
    pause() {
        if (this.isPlaying && this.activeAudio) {
            this.pausedAt = this.ctx.currentTime;
            this.stop();
        }
    }

    /**
     * Stop any sound
     * @async
     */
    async stop() {
        // Close current audio context
        await this.ctx.close();
        this.isPlaying = false;
        this.activeAudio = null;

        // Create new stuff
        this._loadInternal();

        return void 0;
    }
}

/**
 * Create a beeping noise
 *
 * @property _ctx           Audio context
 * @property _gain          Gain node
 * @property _oscillator    The oscillator which makes the noise
 * @property _volume        Volume of oscillator. 0..1
 * @property _frequency     Frequency of oscillator. 0..24000
 * @property _type          Type of oscillator.
 * @property _playing       Is the oscillator playing (bool)?
 *
 * @method volume(?vol)     Get or set volume (percentage)
 * @method frequency(?f)    Get or set frequency
 * @method form(?form)      Get or set waveform
 * @method start(...)       Start the oscillator
 * @method stop()           Stop the oscillator
 * @method update()         Update oscillator with new frequency etc...
 */

Sounds.Beep = class {
    constructor() {
        /** @type AudioContext */
        this._ctx = undefined;

        /** @type GainNode */
        this._gain = undefined;

        /** @type OscillatorNode */
        this._oscillator = undefined;

        this._volume = 1;
        this._frequency = 500;

        /** @type OscillatorType */
        this._type = "square";

        this._playing = false;

        // Initiate
        this._ctx = new AudioContext();
        this._gain = this._ctx.createGain();
        this._gain.connect(this._ctx.destination);

        this._oscillator = this._ctx.createOscillator();
        this.createNew();
    }

    /**
     * Create a new oscillator
     * @return {Beep} this
     */
    createNew() {
        if (this._playing) throw new Error(`Cannot create new oscillator whilst one is playing`);
        this._oscillator = this._ctx.createOscillator();
        this._oscillator.frequency.value = this._frequency;
        this._oscillator.type = this._type;
        this._oscillator.connect(this._gain);
        this._gain.gain.value = this._volume;
        return this;
    }

    /**
     * Get or set volume of beep. Percentage;
     * @param  {Number} [volume=undefined]   Percentage to set to (percentage), or blank to get
     * @return {Number} The volume
     */
    volume(volume = undefined) {
        if (typeof volume === "number") {
            volume = clamp(volume, 0, 100);
            this._volume = volume / 100;
            this.update();
        }
        return this._volume * 100;
    }

    /**
     * Get or set frequency of beep.
     * @param  {Number} [freq=undefined]   Frequency to set oscillator to, or blank to get
     * @return {Number} The frequency
     */
    frequency(freq = undefined) {
        if (typeof freq === "number") {
            freq = utils.clamp(freq, 0, 24000);
            this._frequency = freq;
            this.update();
        }
        return this._frequency;
    }

    /**
     * Get or set type of oscillator.
     * @param  {OscillatorType} [form=undefined]   Wave form to set oscillator to, or blank to get
     * @return {OscillatorType} The wave form
     */
    form(form) {
        if (form !== undefined) {
            this._type = form;
            this.update();
        }
        return this._type;
    }

    /**
     * Start the oscillator
     * @param  {Number} [duration=Infinity] Duration of the beep (ms)
     * @param  {Function} whenDone          Function to call when beep has stopped
     * @return {Boolean} Was successfull ?
     */
    start(duration = Infinity, whenDone = undefined) {
        if (this._playing) return false;

        this.createNew(); // Create new oscillator

        this._oscillator.start(this._ctx.currentTime);
        if (typeof duration == 'number' && !isNaN(duration) && !isFinite(duration)) {
            setTimeout(() => {
                this.stop();
                if (typeof whenDone === "function") whenDone(this);
            }, duration);
        }
        this._playing = true;

        return true;
    }

    /**
     * Update the oscillator with the current frequency and volume and wave form
     * @return {Boolean} Was successfull ?
     */
    update() {
        const playing = this._playing;
        if (playing) this.stop();

        this.createNew();
        this._oscillator.frequency.value = this._frequency;
        this._oscillator.type = this._type;
        this._gain.gain.value = this._volume;

        if (playing) this.start();

        return true;
    }

    /**
     * Stop the oscillator
     * @return {Boolean} Was successfull?
     */
    stop() {
        if (!this._playing) return false;
        this._oscillator.stop();
        this._playing = false;
        return true;
    }
};

function clamp(n, min, max) {
    if (typeof n !== 'number' || isNaN(n)) return (min + max) / 2;
    if (max < min) [max, min] = [min, max];
    if (n < min) return min;
    if (n > max) return max;
    return n;
}