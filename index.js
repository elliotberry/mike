import { spawn } from 'child_process';
import * as os from 'os';
import IsSilence from './lib/silenceTransform.js';
import { PassThrough } from 'stream';

const isMac = os.type() === 'Darwin';
const isWindows = os.type().includes('Windows');

class Mike {
  constructor(options = {}) {
    const optionDefaults = {
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

    const actualOptions = { ...optionDefaults, ...options };
    const { rate, channels, debug, exitOnSilence, fileType, endian, bitwidth, encoding, device } = actualOptions;

    this.format = `${encoding === 'unsigned-integer' ? 'U' : 'S'}${bitwidth}_${endian === 'big' ? 'BE' : 'LE'}`;
    this.audioProcess = null;
    this.infoStream = new PassThrough();
    this.audioStream = new IsSilence({ debug });
    this.rate = rate;
    this.channels = channels;
    this.debug = debug;
    this.device = device;
    this.fileType = fileType;
    this.exitOnSilence = exitOnSilence;
    this.endian = endian;
    this.bitwidth = bitwidth;
    this.encoding = encoding;

    if (debug) {
      this.infoStream.on('data', data => console.log(`Received Info: ${data}`));
      this.infoStream.on('error', error => console.log(`Error in Info Stream: ${error}`));
    }

    this.audioProcessOptions = {
      stdio: ['ignore', 'pipe', debug ? 'pipe' : 'ignore'],
    };

    this.audioStream.setNumSilenceFramesExitThresh(parseInt(exitOnSilence, 10));
    this.start();
  }

  start() {
    console.log('Starting Audio Process');
    if (this.audioProcess === null) {
      const command = isWindows ? 'sox' : isMac ? 'rec' : 'arecord';
      const args = isWindows
        ? ['-b', this.bitwidth, '--endian', this.endian, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', 'waveaudio', 'default', '-p']
        : isMac
        ? ['-b', this.bitwidth, '--endian', this.endian, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', this.fileType, '-']
        : ['-t', this.fileType, '-c', this.channels, '-r', this.rate, '-f', this.format, '-D', this.device];

      this.audioProcess = spawn(command, args, this.audioProcessOptions);

      this.audioProcess.on('exit', (code, sig) => {
        if (code !== null && sig === null) {
          this.audioStream.emit('audioProcessExitComplete');
          if (this.debug) console.log(`Recording audioProcess has exited with code = ${code}`);
        }
      });

      this.audioProcess.stdout.pipe(this.audioStream);
      if (this.debug) {
        this.audioProcess.stderr.pipe(this.infoStream);
      }
      this.audioStream.emit('startComplete');
    } else if (this.debug) {
      console.warn('Duplicate calls to start(): Microphone already started!');
    }
  }

  stop() {
    if (this.audioProcess !== null) {
      this.audioProcess.kill('SIGTERM');
      this.audioProcess = null;
      this.audioStream.emit('stopComplete');
      if (this.debug) console.log('Microphone stopped');
    }
  }

  pause() {
    if (this.audioProcess !== null) {
      this.audioProcess.kill('SIGSTOP');
      this.audioStream.pause();
      this.audioStream.emit('pauseComplete');
      if (this.debug) console.log('Microphone paused');
    }
  }

  resume() {
    if (this.audioProcess !== null) {
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