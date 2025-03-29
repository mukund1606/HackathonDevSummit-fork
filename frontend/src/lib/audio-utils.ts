// src/lib/audio-utils.ts
export const setupFrequencyAnalyzer = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyzer = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
  
    analyzer.fftSize = 256;
    source.connect(analyzer);
  
    return {
      audioContext,
      analyzer,
      cleanup: () => {
        source.disconnect();
        analyzer.disconnect();
      }
    };
  };