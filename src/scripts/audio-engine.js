const EQ_BANDS = [
  { freq: 60, label: '60' },
  { freq: 170, label: '170' },
  { freq: 310, label: '310' },
  { freq: 600, label: '600' },
  { freq: 1000, label: '1K' },
  { freq: 3000, label: '3K' },
  { freq: 6000, label: '6K' },
  { freq: 12000, label: '12K' },
  { freq: 14000, label: '14K' },
  { freq: 16000, label: '16K' },
];

const audioContext = new AudioContext();
const sourceNode = audioContext.createMediaElementSource(document.getElementById('audio-player'));
const preampGain = audioContext.createGain();

const filterNodes = EQ_BANDS.map(({ freq }) => {
  const filter = audioContext.createBiquadFilter();
  filter.type = 'peaking';
  filter.frequency.value = freq;
  filter.Q.value = 1;
  filter.gain.value = 0;
  return filter;
});

preampGain.connect(filterNodes[0]);
for (let i = 0; i < filterNodes.length - 1; i++) {
  filterNodes[i].connect(filterNodes[i + 1]);
}

const analyser = audioContext.createAnalyser();
analyser.fftSize = 64;

let eqEnabled = true;

function applyBypassState() {
  sourceNode.disconnect();
  filterNodes[filterNodes.length - 1].disconnect();
  // Tap the raw source for the visualizer regardless of EQ bypass state -
  // the analyser is a dead-end node, it doesn't need to reach destination.
  sourceNode.connect(analyser);
  if (eqEnabled) {
    sourceNode.connect(preampGain);
    filterNodes[filterNodes.length - 1].connect(audioContext.destination);
  } else {
    sourceNode.connect(audioContext.destination);
  }
}

applyBypassState();

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

const audioEngine = {
  bands: EQ_BANDS,
  analyser,
  resume() {
    if (audioContext.state === 'suspended') audioContext.resume();
  },
  setBandGain(index, db) {
    filterNodes[index].gain.value = db;
  },
  setPreampGain(db) {
    preampGain.gain.value = dbToGain(db);
  },
  setEnabled(enabled) {
    eqEnabled = enabled;
    applyBypassState();
  },
};
