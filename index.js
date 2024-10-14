import { spawn } from 'child_process';
import * as os from 'os';
import IsSilence from './lib/silenceTransform.js';
import { PassThrough } from 'stream';

const isMac = os.type() === 'Darwin';
const isWindows = os.type().includes('Windows');

class Mike {
  constructor(options = {}) {
    this._initializeOptions(options);
    this._initializeStreams();
    this._initializeAudioProcessOptions();
    this.start();
  }

  _initializeOptions(options) {
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
    this.rate = rate;
    this.channels = channels;
    this.debug = debug;
    this.device = device;
    this.fileType = fileType;
    this.exitOnSilence = exitOnSilence;
    this.endian = endian;
    this.bitwidth = bitwidth;
    this.encoding = encoding;
  }

  _initializeStreams() {
    this.infoStream = new PassThrough();
    this.audioStream = new IsSilence({ debug: this.debug });
    this.audioStream.setNumSilenceFramesExitThresh(parseInt(this.exitOnSilence, 10));

    if (this.debug) {
      this.infoStream.on('data', data => console.log(`Received Info: ${data}`));
      this.infoStream.on('error', error => console.log(`Error in Info Stream: ${error}`));
    }
  }

  _initializeAudioProcessOptions() {
    this.audioProcessOptions = {
      stdio: ['ignore', 'pipe', this.debug ? 'pipe' : 'ignore'],
    };
  }

  start() {
    console.log('Starting Audio Process');
    if (!this.audioProcess) {
      this._spawnAudioProcess();
      this.audioStream.emit('startComplete');
    } else if (this.debug) {
      console.warn('Duplicate calls to start(): Microphone already started!');
    }
  }

  _spawnAudioProcess() {
    const command = isWindows ? 'sox' : isMac ? 'rec' : 'arecord';
    const args = this._getCommandArgs(command);

    this.audioProcess = spawn(command, args, this.audioProcessOptions);
    this._setupAudioProcessHandlers();

    this.audioProcess.stdout.pipe(this.audioStream);
    if (this.debug) {
      this.audioProcess.stderr.pipe(this.infoStream);
    }
  }

  _getCommandArgs(command) {
    if (isWindows) {
      return ['-b', this.bitwidth, '--endian', this.endian, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', 'waveaudio', 'default', '-p'];
    } else if (isMac) {
      return ['-b', this.bitwidth, '--endian', this.endian, '-c', this.channels, '-r', this.rate, '-e', this.encoding, '-t', this.fileType, '-'];
    } else {
      return ['-t', this.fileType, '-c', this.channels, '-r', this.rate, '-f', this.format, '-D', this.device];
    }
  }

  _setupAudioProcessHandlers() {
    this.audioProcess.on('exit', (code, sig) => {
      if (code !== null && sig === null) {
        this.audioStream.emit('audioProcessExitComplete');
        if (this.debug) console.log(`Recording audioProcess has exited with code = ${code}`);
      }
    });
  }

  stop() {
    this._terminateAudioProcess('Microphone stopped', 'stopComplete');
  }

  pause() {
    this._controlAudioProcess('SIGSTOP', 'Microphone paused', 'pauseComplete', 'pause');
  }

  resume() {
    this._controlAudioProcess('SIGCONT', 'Microphone resumed', 'resumeComplete', 'resume');
  }

  _terminateAudioProcess(logMessage, event) {
    if (!this.audioProcess) {
      return;
    }
    this.audioProcess.kill('SIGTERM');
    this.audioProcess = null;
    this.audioStream.emit(event);
    if (this.debug) console.log(logMessage);
  }

  _controlAudioProcess(signal, logMessage, event, method) {
    if (!this.audioProcess) {
      return;
    }
    this.audioProcess.kill(signal);
    this.audioStream[method]();
    this.audioStream.emit(event);
    if (this.debug) console.log(logMessage);
  }

  getAudioStream() {
    return this.audioStream;
  }
}

export default Mike;
