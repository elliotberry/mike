import { Transform as Transform } from "node:stream";


class IsSilence extends Transform {
    constructor(options) {
        super();
        if (options && options.debug) {
          this.debug = options.debug;
          delete options.debug;
        }
        Transform.call(this, options);
        let consecSilenceCount = 0;
        let numSilenceFramesExitThresh = 0;

        this.getNumSilenceFramesExitThresh = function getNumSilenceFramesExitThresh() {
            return numSilenceFramesExitThresh;
        };

        this.getConsecSilenceCount = function getConsecSilenceCount() {
            return consecSilenceCount;
        };

        this.setNumSilenceFramesExitThresh = function setNumSilenceFramesExitThresh(numFrames) {
            numSilenceFramesExitThresh = numFrames;
            return;
        };

        this.incrConsecSilenceCount = function incrConsecSilenceCount() {
            consecSilenceCount++;
            return consecSilenceCount;
        };

        this.resetConsecSilenceCount = function resetConsecSilenceCount() {
            consecSilenceCount = 0;
            return;
        };
    }

    _transform(chunk, encoding, callback) {
        let i;
        let speechSample;
        let silenceLength = 0;
        let abs = 0;
        let chunkMax = 0;
        let chunkAmplitudeSumOfSquares = 0;
        const debug = this.debug;
        let alreadyReset = false;
        let consecutiveSilence = this.getConsecSilenceCount();
        const numSilenceFramesExitThresh = this.getNumSilenceFramesExitThresh();
        const incrementConsecSilence = this.incrConsecSilenceCount;
        const resetConsecSilence = this.resetConsecSilenceCount;

        if(numSilenceFramesExitThresh) {
            for(i=0; i<chunk.length; i+=2) {
                speechSample = chunk[i+1] >= 128 ? (chunk[i+1] - 256) * 256 : chunk[i+1] * 256;
                speechSample += chunk[i];

                abs = Math.abs(speechSample);
                if(abs > 2000) {
                    if (!alreadyReset) {
                        if (debug) {
                          console.log("Found speech block");
                        }
                        //emit 'sound' if we hear a sound after a silence
                        if (consecutiveSilence > numSilenceFramesExitThresh) this.emit('sound');
                        resetConsecSilence();
                        alreadyReset = true;
                    }
                } else {
                    silenceLength++;
                }
                if (abs > chunkMax) {
                  chunkMax = abs;
                }
                chunkAmplitudeSumOfSquares += (abs * abs);
            }
            // Emit the root mean square of the chunk's amplitude and a simple percent
            // of the maximum amplitude in the chunk over the max possible amplitude
            // (16 bit PCM).
            this.emit('soundLevel', Math.sqrt((1/chunk.length) * chunkAmplitudeSumOfSquares), 100 * chunkMax / 32_768);
            if(silenceLength == chunk.length/2) {
                consecutiveSilence = incrementConsecSilence();
                if (debug) {
                  console.log("Found silence block: %d of %d", consecutiveSilence, numSilenceFramesExitThresh);
                }
                //emit 'silence' only once each time the threshold condition is met
                if(consecutiveSilence === numSilenceFramesExitThresh) {
                    this.emit('silence');
                }
            }
        }
        this.push(chunk);
        callback();
    }
}

export default IsSilence;
