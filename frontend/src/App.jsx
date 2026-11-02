/**
 * App.jsx
 * 5-step workflow orchestrator.
 *
 * Step 0 — PropertyForm       : enter property details
 * Step 1 — ImageUpload        : upload 4–8 images
 * Step 2 — ScriptPreview      : review / edit AI-generated captions
 * Step 3 — VideoGenerationPanel : generate + poll for the MP4
 * Step 4 — VideoPreview       : watch and download the result
 */
import React, { useState } from 'react';
import Header           from './components/Header.jsx';
import StepIndicator    from './components/StepIndicator.jsx';
import PropertyForm     from './pages/PropertyForm.jsx';
import ImageUpload      from './pages/ImageUpload.jsx';
import ScriptPreview    from './pages/ScriptPreview.jsx';
import VideoGenerationPanel from './pages/VideoGenerationPanel.jsx';
import VideoPreview     from './pages/VideoPreview.jsx';
import './styles/app.css';

const STEPS = ['Property', 'Images', 'Script', 'Render', 'Video'];

export default function App() {
  const [step,     setStep]     = useState(0);
  const [property, setProperty] = useState(null);
  const [images,   setImages]   = useState([]);
  const [script,   setScript]   = useState(null);
  const [jobId,    setJobId]    = useState(null);

  function goNext() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function goBack() { setStep((s) => Math.max(s - 1, 0)); }

  function reset() {
    setStep(0);
    setProperty(null);
    setImages([]);
    setScript(null);
    setJobId(null);
  }

  return (
    <div className="app-shell">
      <Header />

      {/* Only show stepper for steps 0–3; hide on final video page */}
      {step < STEPS.length - 1 && <StepIndicator steps={STEPS} current={step} />}

      <main className="app-main">
        {step === 0 && (
          <PropertyForm
            initial={property}
            onSubmit={(data) => { setProperty(data); goNext(); }}
          />
        )}

        {step === 1 && (
          <ImageUpload
            imageCount={images.length}
            onSubmit={(files) => { setImages(files); goNext(); }}
            onBack={goBack}
          />
        )}

        {step === 2 && (
          <ScriptPreview
            property={property}
            imageCount={images.length}
            onScriptReady={(s) => { setScript(s); goNext(); }}
            onBack={goBack}
          />
        )}

        {step === 3 && (
          <VideoGenerationPanel
            property={property}
            images={images}
            script={script}
            onDone={(id) => { setJobId(id); goNext(); }}
            onBack={goBack}
          />
        )}

        {step === 4 && (
          <VideoPreview
            jobId={jobId}
            onReset={reset}
          />
        )}
      </main>

      <footer className="app-footer">
        PropertyStudio AI — Assignment project. All sample data is synthetic.
        No real personal information used. Audio uploads: ensure you hold rights to any music.
      </footer>
    </div>
  );
}
