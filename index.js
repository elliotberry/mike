import {spawn} from 'child_process';
import * as os from 'os';
const isMac = os.type() == 'Darwin';
const isWindows = os.type().includes('Windows');
import IsSilence from './lib/silenceTransform.js';
import {PassThrough as PassThrough} from 'stream';

class Mike {
  constructor(options) {
    let optionDefaults = {
      rate: '16000',
      channels: '1',
      debug: false,
      exitOnSilence: 6,
      fileType: 'raw',
      endian: 'little',
      bitwidth: '16',
      encoding: 'signed-integer',
      device: 'plughw:1,0',
    };

    let actualOptions = Object.assign({}, optionDefaults, options);
    const {rate, channels, debug, exitOnSilence, fileType, endian, bitwidth, encoding, device} = actualOptions;

    this.format = null;
    this.formatEndian = null;
    this.formatEncoding = null;
    this.audioProcess = null;
    this.infoStream = new PassThrough();
    this.audioStream = new IsSilence({debug});
    this.rate = rate;
    this.channels = channels;
    this.debug = true;
    this.device = device;
    this.fileType = fileType;
    this.exitOnSilence = exitOnSilence;
    this.endian = endian;
    this.bitwidth = bitwidth;
    this.encoding = encoding;

    if (debug) {
      this.infoStream.on('data', data => {
        console.log(`Received Info: ${data}`);
      });
      this.infoStream.on('error', error => {
        console.log(`Error in Info Stream: ${error}`);
      });
    }
    const audioProcessOptions = {
      stdio: ['ignore', 'pipe', 'ignore'],
    };

    if (debug) {
      audioProcessOptions.stdio[2] = 'pipe';
    }

    // Setup format variable for arecord call
    if (endian === 'big') {
      this.formatEndian = 'BE';
    } else {
      this.formatEndian = 'LE';
    }
    if (encoding === 'unsigned-integer') {
      this.formatEncoding = 'U';
    } else {
      this.formatEncoding = 'S';
    }
    this.format = `${this.formatEncoding + bitwidth}_${this.formatEndian}`;
    this.audioStream.setNumSilenceFramesExitThresh(parseInt(exitOnSilence, 10));
    this.start();
    return this;
  }

  start() {
    if (this.audioProcess === null) {
      if (isWindows) {
        this.audioProcess = spawn('sox', ['-b', this.bitwidth, '--endian', this.endian, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', 'waveaudio', 'default', '-p'], this.audioProcessOptions);
      } else if (isMac) {
        this.audioProcess = spawn('rec', ['-b', this.bitwidth, '--endian', this.endian, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', this.fileType, '-'], this.audioProcessOptions);
      } else {
        this.audioProcess = spawn('arecord', ['-t', this.fileType, '-c', this.channels, '-r', this.rate, '-f', this.format, '-D', this.device], this.audioProcessOptions);
      }

      this.audioProcess.on('exit', (code, sig) => {
        if (code != null && sig === null) {
          this.audioStream.emit('audioProcessExitComplete');
          if (this.debug) console.log('recording audioProcess has exited with code = %d', code);
        }
      });
      this.audioProcess.stdout.pipe(this.audioStream);
      if (this.debug) {
        this.audioProcess.stderr.pipe(this.infoStream);
      }
      this.audioStream.emit('startComplete');
    } else {
      if (this.debug) {
        throw new Error('Duplicate calls to start(): Microphone already started!');
      }
    }
  }

  stop() {
    if (this.audioProcess != null) {
      this.audioProcess.kill('SIGTERM');
      this.audioProcess = null;
      this.audioStream.emit('stopComplete');
      if (this.debug) console.log('Microphone stopped');
    }
  }

  pause() {
    if (this.audioProcess != null) {
      this.audioProcess.kill('SIGSTOP');
      this.audioStream.pause();
      this.audioStream.emit('pauseComplete');
      if (this.debug) console.log('Microphone paused');
    }
  }

  resume() {
    if (this.audioProcess != null) {
      this.audioProcess.kill('SIGCONT');
      this.audioStream.resume();
      this.audioStream.emit('resumeComplete');
      if (this.debug) console.log('Microphone resumed');
    }
  }

  getAudioStream() {
    return this.audioStream;
  }
}

export default Mike;
