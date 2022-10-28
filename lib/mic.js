import { spawn as spawn } from "child_process";
import * as os from 'os';
const isMac = os.type() == 'Darwin';
const isWindows = os.type().includes('Windows');
import IsSilence from "./silenceTransform.js";
import { PassThrough as PassThrough } from "stream";

const mic = function mic(options = {}) {
    const that = {};


    let optionDefaults = {
        rate: '16000',
        channels: '1',
        debug: false,
        exitOnSilence: 6,
        fileType: 'raw',
        endian: 'little',
        bitwidth: '16',
        encoding: 'signed-integer',
        device: 'plughw:1,0'
    };

    let actualOptions = Object.assign({}, optionDefaults, options);
    const { rate, channels, debug, exitOnSilence, fileType, endian, bitwidth, encoding, device } = actualOptions;
    let format;
    let formatEndian;
    let formatEncoding;
    let audioProcess = null;
    const infoStream = new PassThrough;
    const audioStream = new IsSilence({debug});
    const audioProcessOptions = {
        stdio: ['ignore', 'pipe', 'ignore']
    };

    if(debug) {
        audioProcessOptions.stdio[2] = 'pipe';
    }

    // Setup format variable for arecord call
    if(endian === 'big') {
        formatEndian = 'BE';
    } else {
        formatEndian = 'LE';
    }
    if(encoding === 'unsigned-integer') {
        formatEncoding = 'U';
    } else {
        formatEncoding = 'S';
    }
    format = `${formatEncoding + bitwidth}_${formatEndian}`;
    audioStream.setNumSilenceFramesExitThresh(parseInt(exitOnSilence, 10));

    that.start = function start() {
          if(audioProcess === null) {
            if(isWindows){
              audioProcess = spawn('sox', ['-b', bitwidth, '--endian', endian,
                                   '-c', channels, '-r', rate, '-e', encoding,
                                   '-t', 'waveaudio', 'default', '-p'],
                                    audioProcessOptions)
            }
            else if(isMac){
              audioProcess = spawn('rec', ['-b', bitwidth, '--endian', endian,
                                    '-c', channels, '-r', rate, '-e', encoding,
                                    '-t', fileType, '-'], audioProcessOptions)
            }
            else {
              audioProcess = spawn('arecord', ['-t', fileType, '-c', channels, '-r', rate, '-f',
                                   format, '-D', device], audioProcessOptions);
            }

            audioProcess.on('exit', (code, sig) => {
                    if(code != null && sig === null) {
                        audioStream.emit('audioProcessExitComplete');
                        if(debug) console.log("recording audioProcess has exited with code = %d", code);
                    }
                });
            audioProcess.stdout.pipe(audioStream);
            if(debug) {
                audioProcess.stderr.pipe(infoStream);
            }
            audioStream.emit('startComplete');
        } else {
            if(debug) {
                throw new Error("Duplicate calls to start(): Microphone already started!");
            }
        }
    };

    that.stop = function stop() {
        if(audioProcess != null) {
            audioProcess.kill('SIGTERM');
            audioProcess = null;
            audioStream.emit('stopComplete');
            if(debug) console.log("Microphone stopped");
        }
    };

    that.pause = function pause() {
        if(audioProcess != null) {
            audioProcess.kill('SIGSTOP');
            audioStream.pause();
            audioStream.emit('pauseComplete');
            if(debug) console.log("Microphone paused");
        }
    };

    that.resume = function resume() {
        if(audioProcess != null) {
            audioProcess.kill('SIGCONT');
            audioStream.resume();
            audioStream.emit('resumeComplete');
            if(debug) console.log("Microphone resumed");
        }
    }

    that.getAudioStream = function getAudioStream() {
        return audioStream;
    }

    if(debug) {
        infoStream.on('data', data => {
                console.log(`Received Info: ${data}`);
            });
        infoStream.on('error', error => {
                console.log(`Error in Info Stream: ${error}`);
            });
    }

    return that;
}

export default mic;
