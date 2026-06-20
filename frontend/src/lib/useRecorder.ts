import { useCallback, useRef, useState } from "react";

// Minimal Web Speech API typings (not in lib.dom for all targets).
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: ((e: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): SpeechRecognitionLike | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const r: SpeechRecognitionLike = new Ctor();
  r.continuous = true;
  r.interimResults = true;
  r.lang = "en-US";
  return r;
}

export interface RecorderState {
  supported: boolean;
  recording: boolean;
  transcript: string;   // finalized text
  interim: string;      // in-progress text
  error: string | null;
  start: () => void;
  stop: () => void;
  setTranscript: (t: string) => void; // paste-transcript escape hatch
  reset: () => void;
}

export function useRecorder(): RecorderState {
  const [supported] = useState(() => getRecognition() !== null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscriptState] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const r = getRecognition();
    if (!r) { setError("Speech recognition is not supported in this browser (use Chrome)."); return; }
    recRef.current = r;
    setError(null);
    setInterim("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      let fin = "", inter = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += txt; else inter += txt;
      }
      if (fin) setTranscriptState((prev) => (prev ? prev + " " : "") + fin.trim());
      setInterim(inter);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onerror = (e: any) => setError(String(e?.error || "recognition error"));
    r.onend = () => setRecording(false);
    r.start();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setRecording(false);
    setInterim("");
  }, []);

  const setTranscript = useCallback((t: string) => setTranscriptState(t), []);
  const reset = useCallback(() => { setTranscriptState(""); setInterim(""); setError(null); }, []);

  return { supported, recording, transcript, interim, error, start, stop, setTranscript, reset };
}
