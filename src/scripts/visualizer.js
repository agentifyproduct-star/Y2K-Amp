const spectrumCanvas = document.getElementById('mini-spectrum');
const spectrumCtx = spectrumCanvas.getContext('2d');
const spectrumData = new Uint8Array(audioEngine.analyser.frequencyBinCount);

let spectrumAnimationId = null;

function drawSpectrum() {
  audioEngine.analyser.getByteFrequencyData(spectrumData);

  spectrumCtx.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);

  const barCount = spectrumData.length;
  const barWidth = spectrumCanvas.width / barCount;

  for (let i = 0; i < barCount; i++) {
    const barHeight = (spectrumData[i] / 255) * spectrumCanvas.height;
    spectrumCtx.fillStyle = '#4fd6ff';
    spectrumCtx.fillRect(i * barWidth, spectrumCanvas.height - barHeight, barWidth - 1, barHeight);
  }

  // Stop rescheduling once playback pauses/ends instead of drawing an idle
  // spectrum forever; the 'play' listener below restarts the loop.
  spectrumAnimationId = audioElement.paused ? null : requestAnimationFrame(drawSpectrum);
}

audioElement.addEventListener('play', () => {
  if (spectrumAnimationId === null) spectrumAnimationId = requestAnimationFrame(drawSpectrum);
});
