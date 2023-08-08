import mike from '../index.js';
import fs from 'fs';

const micInstance = new mike({rate: '16000', channels: '1', debug: false, exitOnSilence: 6});
const micInputStream = micInstance.getAudioStream();

const outputFileStream = fs.WriteStream('output.raw');

micInputStream.pipe(outputFileStream);

let chunkCounter = 0;
micInputStream.on('data', ({length}) => {
  console.log('Recieved Input Stream of Size %d: %d', length, chunkCounter++);
});

micInputStream.on('error', err => {
  console.log(`Error in Input Stream: ${err}`);
});

micInputStream.on('startComplete', () => {
  console.log('Got SIGNAL startComplete');
  setTimeout(() => {
    micInstance.pause();
  }, 5000);
});

micInputStream.on('stopComplete', () => {
  console.log('Got SIGNAL stopComplete');
});

micInputStream.on('pauseComplete', () => {
  console.log('Got SIGNAL pauseComplete');
  setTimeout(() => {
    micInstance.resume();
  }, 5000);
});

micInputStream.on('resumeComplete', () => {
  console.log('Got SIGNAL resumeComplete');
  setTimeout(() => {
    micInstance.stop();
  }, 5000);
});

micInputStream.on('silence', () => {
  console.log('Got SIGNAL silence');
});

micInputStream.on('processExitComplete', () => {
  console.log('Got SIGNAL processExitComplete');
});

micInstance.start();
