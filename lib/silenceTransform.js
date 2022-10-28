import { Transform as Transform } from "stream";
import util from "util";

class IsSilence extends Transform {
    constructor(options) {
        super();
        const that = this;
        if (options && options.debug) {
          that.debug = options.debug;
          delete options.debug;
        }
        Transform.call(that, options);
        let consecSilenceCount = 0;
        let numSilenceFramesExitThresh = 0;

        that.getNumSilenceFramesExitThresh = function getNumSilenceFramesExitThresh() {
            return numSilenceFramesExitThresh;
        };

        that.getConsecSilenceCount = function getConsecSilenceCount() {
            return consecSilenceCount;
        };

        that.setNumSilenceFramesExitThresh = function setNumSilenceFramesExitThresh(numFrames) {
            numSilenceFramesExitThresh = numFrames;
            return;
        };

        that.incrConsecSilenceCount = function incrConsecSilenceCount() {
            consecSilenceCount++;
            return consecSilenceCount;
        };

        that.resetConsecSilenceCount = function resetConsecSilenceCount() {
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
        const self = this;
        const debug = self.debug;
        let alreadyReset = false;
        let consecutiveSilence = self.getConsecSilenceCount();
        const numSilenceFramesExitThresh = self.getNumSilenceFramesExitThresh();
        const incrementConsecSilence = self.incrConsecSilenceCount;
        const resetConsecSilence = self.resetConsecSilenceCount;

        if(numSilenceFramesExitThresh) {
            for(i=0; i<chunk.length; i=i+2) {
                if(chunk[i+1] >= 128) {
                    speechSample = (chunk[i+1] - 256) * 256;
                } else {
                    speechSample = chunk[i+1] * 256;
                }
                speechSample += chunk[i];

                abs = Math.abs(speechSample);
                if(abs > 2000) {
                    if (!alreadyReset) {
                        if (debug) {
                          console.log("Found speech block");
                        }
                        //emit 'sound' if we hear a sound after a silence
                        if (consecutiveSilence > numSilenceFramesExitThresh) self.emit('sound');
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
            self.emit('soundLevel', Math.sqrt((1/chunk.length) * chunkAmplitudeSumOfSquares), 100 * chunkMax / 32768);
            if(silenceLength == chunk.length/2) {
                consecutiveSilence = incrementConsecSilence();
                if (debug) {
                  console.log("Found silence block: %d of %d", consecutiveSilence, numSilenceFramesExitThresh);
                }
                //emit 'silence' only once each time the threshold condition is met
                if(consecutiveSilence === numSilenceFramesExitThresh) {
                    self.emit('silence');
                }
            }
        }
        this.push(chunk);
        callback();
    }
}

export default IsSilence;
