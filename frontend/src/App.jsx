import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000"
).replace(/\/$/, "");

const stages = [
  {
    name: "Opening",
    purpose: "Identify the caller and establish who is speaking.",
    responses: [
      { text: "Yes, who's this?", source: "T005" },
      { text: "Who is calling from?", source: "T016" },
      { text: "Which company are you talking about?", source: "T045" },
    ],
  },
  {
    name: "Purpose",
    purpose: "Understand why the caller is contacting the prospect.",
    responses: [
      {
        text: "So what is that regarding? What do I need to help you with in this?",
        source: "T007",
      },
      { text: "I am sorry. What is this regarding?", source: "T012" },
      { text: "What kind of report?", source: "T049" },
    ],
  },
  {
    name: "Permission",
    purpose: "Determine whether the prospect can speak now.",
    responses: [
      { text: "Ah, yes. Go ahead.", source: "T001" },
      { text: "Can you call me in an hour?", source: "T005" },
      { text: "Yeah, please go ahead.", source: "T038" },
    ],
  },
  {
    name: "Their business",
    purpose: "Understand the prospect's role and business context.",
    responses: [
      {
        text: "We are only manufacturing. We do only manufacturing. But what do you do, by the way?",
        source: "T081",
      },
      {
        text: "Actually, I'm not into growth. I take care of another domain.",
        source: "T065",
      },
      {
        text: "Oh, we are ourselves in the same business, because you are a media house.",
        source: "T073",
      },
    ],
  },
  {
    name: "Their need",
    purpose: "Capture the prospect's priorities and questions without assuming a need.",
    responses: [
      {
        text: "The biggest challenge is manpower requirement. Skilled manpower.",
        source: "T089",
      },
      {
        text: "Our company is the market leader. So it doesn't fall in the category of growing faster than the market leader.",
        source: "T048",
      },
      {
        text: "So I don't know what area you are trying to look at, because there are a lot of different things, a lot of different people.",
        source: "T088",
      },
    ],
  },
  {
    name: "Objection",
    purpose: "Understand concerns and respect a clear refusal.",
    responses: [
      {
        text: "I am sorry. I am not interested in this at the moment.",
        source: "T012",
      },
      {
        text: "No, we are working with consultants actually, so we don't require anything.",
        source: "T077",
      },
      {
        text: "We have an internal business model, actually, and we are following it. Definitely.",
        source: "T009",
      },
    ],
  },
  {
    name: "Next step",
    purpose: "Record the follow-up the prospect actually requested or agreed to.",
    responses: [
      { text: "Can you call me in an hour?", source: "T005" },
      {
        text: "It would be better if you can send me on WhatsApp. I will reply to you on WhatsApp.",
        source: "T019",
      },
      { text: "Can you call me tomorrow?", source: "T035" },
    ],
  },
  {
    name: "Close",
    purpose: "Record the conversation's actual ending, not an assumed outcome.",
    responses: [
      { text: "Tuesday is a good day.", source: "T001" },
      {
        text: "I'm not really interested in doing so. Thank you.",
        source: "T007",
      },
      {
        text: "Okay, maybe I think you have got the wrong number.",
        source: "T004",
      },
    ],
  },
];

const outcomes = [
  "Next step agreed",
  "Follow-up required",
  "Interested",
  "Not interested",
  "Wrong person",
  "Do not call",
  "Call ended early",
];

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function getCallStages(call) {
  return [...(call.call_stages || [])].sort(
    (a, b) => Number(a.stage) - Number(b.stage)
  );
}

function formatDate(date) {
  if (!date) return "Date unavailable";

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : parsed.toLocaleString();
}

export default function App() {
  const [stageIndex, setStageIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [prospectWords, setProspectWords] = useState("");
  const [prospect, setProspect] = useState("");
  const [calls, setCalls] = useState([]);
  const [screen, setScreen] = useState("call");
  const [activeCall, setActiveCall] = useState(null);

  const [backendStatus, setBackendStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [outcome, setOutcome] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [showCloseForm, setShowCloseForm] = useState(false);

  const [expandedCallId, setExpandedCallId] = useState(null);

  const stage = stages[stageIndex];

  const checkBackend = useCallback(async () => {
    try {
      await apiRequest("/health");
      setBackendStatus("connected");
    } catch {
      setBackendStatus("disconnected");
    }
  }, []);

  const loadCalls = useCallback(async () => {
    try {
      const data = await apiRequest("/api/calls");
      const records = Array.isArray(data)
        ? data
        : data.calls || data.data || [];

      setCalls(records);
    } catch (err) {
      setError(`Could not load call history: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    checkBackend();
    loadCalls();
  }, [checkBackend, loadCalls]);

  function resetCallForm() {
    setStageIndex(0);
    setSelected([]);
    setProspectWords("");
    setProspect("");
    setActiveCall(null);
    setOutcome("");
    setNextStep("");
    setShowCloseForm(false);
    setAiSuggestion("");
    setAiError("");
    setError("");
  }

  function startCall() {
    resetCallForm();
    setScreen("call");
  }

  async function createCall() {
    if (backendStatus !== "connected") {
      setError("Backend is not connected. Start the backend and try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/api/calls", {
        method: "POST",
        body: JSON.stringify({
          prospect: prospect.trim() || "Unnamed prospect",
        }),
      });

      const call = data.call || data.data || data;

      if (!call.id) {
        throw new Error("The backend did not return a call ID.");
      }

      setActiveCall(call);
      setProspect(call.prospect || prospect.trim() || "Unnamed prospect");
      setError("");
    } catch (err) {
      setError(`Could not start call: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentStage() {
    if (!activeCall?.id) {
      throw new Error("Start a call before saving a stage.");
    }

    await apiRequest(`/api/calls/${activeCall.id}/stages`, {
      method: "POST",
      body: JSON.stringify({
        stage: stageIndex + 1,
        stage_name: stage.name,
        selected_response: selected.join(" | "),
        prospect_words: prospectWords.trim(),
      }),
    });
  }

  async function nextStage() {
    if (!activeCall || loading || showCloseForm) return;

    setLoading(true);
    setError("");

    try {
      await saveCurrentStage();

      if (stageIndex === stages.length - 1) {
        setOutcome("");
        setNextStep("");
        setShowCloseForm(true);
        await loadCalls();
        return;
      }

      setStageIndex((previous) => previous + 1);
      setSelected([]);
      setProspectWords("");
      setAiSuggestion("");
      setAiError("");
    } catch (err) {
      setError(`Could not save stage: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function openCloseForm() {
    if (!activeCall || loading || showCloseForm) return;

    setLoading(true);
    setError("");

    try {
      await saveCurrentStage();
      setOutcome("");
      setNextStep("");
      setShowCloseForm(true);
      await loadCalls();
    } catch (err) {
      setError(`Could not save the current stage: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function finishCall() {
    if (!activeCall?.id) {
      setError("There is no active call to finish.");
      return;
    }

    if (!outcome) {
      setError("Please select the actual call outcome.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest(`/api/calls/${activeCall.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          outcome,
          next_step: nextStep.trim(),
        }),
      });

      await loadCalls();
      setActiveCall(null);
      setShowCloseForm(false);
      setScreen("history");
    } catch (err) {
      setError(`Could not finish call: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function cancelCloseForm() {
    setShowCloseForm(false);
    setOutcome("");
    setNextStep("");
    setError("");
  }

  function toggleResponse(response) {
    setSelected((previous) =>
      previous.includes(response)
        ? previous.filter((item) => item !== response)
        : [...previous, response]
    );
  }

  async function getAiCoaching() {
    if (!activeCall) {
      setAiError("Start a call before requesting coaching.");
      return;
    }

    setAiLoading(true);
    setAiError("");
    setAiSuggestion("");

    try {
      const data = await apiRequest("/api/coach", {
        method: "POST",
        body: JSON.stringify({
          stage: stage.name,
          stagePurpose: stage.purpose,
          prospectWords: prospectWords.trim(),
          selectedResponses: selected,
        }),
      });

      if (!data.suggestion) {
        throw new Error("The AI service returned no coaching suggestion.");
      }

      setAiSuggestion(data.suggestion);
    } catch (err) {
      setAiError(err.message || "Could not generate coaching.");
    } finally {
      setAiLoading(false);
    }
  }

  function openHistory() {
    setError("");
    loadCalls();
    setScreen("history");
  }

  function openCallScreen() {
    setError("");
    setScreen("call");
  }

  function toggleCallDetails(callId) {
    setExpandedCallId((previous) =>
      previous === callId ? null : callId
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button
          className="brand"
          type="button"
          onClick={openCallScreen}
          aria-label="Go to call assistant"
        >
          <span className="brand-mark">C</span>
          <span>CallPilot</span>
        </button>

        <nav className="top-nav" aria-label="Main navigation">
          <button
            className={screen === "call" ? "nav-button active" : "nav-button"}
            type="button"
            onClick={openCallScreen}
          >
            Live call
          </button>

          <button
            className={
              screen === "history" ? "nav-button active" : "nav-button"
            }
            type="button"
            onClick={openHistory}
          >
            Call history
            <span className="nav-count">{calls.length}</span>
          </button>
        </nav>

        <div className={`connection-status ${backendStatus}`}>
          <span className="status-dot" />
          {backendStatus === "connected"
            ? "Backend connected"
            : backendStatus === "checking"
              ? "Checking backend"
              : "Backend disconnected"}
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {screen === "call" ? (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">REAL-TIME CONVERSATION WORKSPACE</p>
                <h1>Cold call assistant</h1>
                <p className="muted">
                  Follow the conversation, capture the prospect's own words,
                  and record the outcome accurately.
                </p>
              </div>

              <div className="heading-badge">
                <span className="status-dot" />
                {activeCall ? "Call in progress" : "Ready to start"}
              </div>
            </section>

            {!activeCall ? (
              <section className="panel start-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">NEW CONVERSATION</p>
                    <h2>Start a call</h2>
                  </div>
                  <span className="step-count">8 stages</span>
                </div>

                <p className="muted">
                  Add a prospect name if you have one. Your conversation
                  progress will be saved to the call history.
                </p>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    createCall();
                  }}
                >
                  <div className="field-group">
                    <label htmlFor="prospect">PROSPECT / COMPANY</label>
                    <input
                      id="prospect"
                      value={prospect}
                      onChange={(event) => setProspect(event.target.value)}
                      placeholder="e.g. Acme Technologies"
                      disabled={loading}
                    />
                  </div>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={loading || backendStatus !== "connected"}
                  >
                    {loading ? "Starting..." : "Start new call"}
                    <span aria-hidden="true">→</span>
                  </button>
                </form>

                {backendStatus !== "connected" && (
                  <p className="field-hint">
                    Make sure the backend is running on port 5000.
                  </p>
                )}
              </section>
            ) : showCloseForm ? (
              <section className="panel close-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">CALL SUMMARY</p>
                    <h2>How did the call end?</h2>
                  </div>
                  <span className="step-count">
                    {stageIndex + 1} / 8 stages reached
                  </span>
                </div>

                <p className="muted">
                  Prospect: <strong>{activeCall.prospect || prospect}</strong>.
                  Choose the actual outcome before saving the call.
                </p>

                <div className="field-group">
                  <label htmlFor="outcome">CALL OUTCOME</label>
                  <select
                    id="outcome"
                    value={outcome}
                    onChange={(event) => setOutcome(event.target.value)}
                    disabled={loading}
                    required
                  >
                    <option value="">Select the actual outcome</option>
                    {outcomes.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label htmlFor="next-step">NEXT STEP (OPTIONAL)</label>
                  <textarea
                    id="next-step"
                    rows={3}
                    value={nextStep}
                    onChange={(event) => setNextStep(event.target.value)}
                    placeholder="Example: Call Tuesday at 11 AM"
                    disabled={loading}
                  />
                </div>

                <p className="field-hint">
                  Record only what was actually agreed. Leave the next step
                  blank if there is no follow-up.
                </p>

                <div className="call-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={cancelCloseForm}
                    disabled={loading}
                  >
                    Back to call
                  </button>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={finishCall}
                    disabled={loading || !outcome}
                  >
                    {loading ? "Saving call..." : "Confirm & save call"}
                    <span aria-hidden="true">✓</span>
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="stage-overview panel">
                  <div className="stage-overview-top">
                    <div>
                      <p className="eyebrow">CONVERSATION PROGRESS</p>
                      <h2>
                        Stage {stageIndex + 1}{" "}
                        <span className="muted">of {stages.length}</span>
                      </h2>
                    </div>
                    <span className="stage-pill">{stage.name}</span>
                  </div>

                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={stages.length}
                    aria-valuenow={stageIndex + 1}
                    aria-label="Call stage progress"
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${((stageIndex + 1) / stages.length) * 100}%`,
                      }}
                    />
                  </div>

                  <div className="stage-steps">
                    {stages.map((item, index) => (
                      <button
                        key={item.name}
                        type="button"
                        className={[
                          "stage-step",
                          index === stageIndex ? "current" : "",
                          index < stageIndex ? "completed" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => {
                          if (index <= stageIndex) setStageIndex(index);
                        }}
                        disabled={loading || index > stageIndex}
                        title={
                          index > stageIndex
                            ? "Complete the current stage first"
                            : item.name
                        }
                      >
                        <span className="stage-step-number">
                          {index < stageIndex ? "✓" : index + 1}
                        </span>
                        <span className="stage-step-name">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <div className="workspace-grid">
                  <section className="panel conversation-panel">
                    <div className="panel-heading">
                      <div>
                        <p className="eyebrow">CURRENT STAGE</p>
                        <h2>{stage.name}</h2>
                      </div>
                      <span className="stage-number">
                        {String(stageIndex + 1).padStart(2, "0")}
                      </span>
                    </div>

                    <p className="muted">{stage.purpose}</p>

                    <div className="section-label">
                      <span>QUICK RESPONSE OPTIONS</span>
                      <span className="field-hint">Select what they said</span>
                    </div>

                    <div className="response-list">
                      {stage.responses.map((response) => {
                        const isSelected = selected.includes(response.text);

                        return (
                          <button
                            type="button"
                            key={`${response.source}-${response.text}`}
                            className={
                              isSelected
                                ? "response-option selected"
                                : "response-option"
                            }
                            onClick={() => toggleResponse(response.text)}
                            disabled={loading}
                            title={`Source transcript: ${response.source}`}
                          >
                            <span
                              className="response-check"
                              aria-hidden="true"
                            >
                              {isSelected ? "✓" : "+"}
                            </span>
                            <span className="response-content">
                              <span className="response-text">
                                {response.text}
                              </span>
                              <span className="response-source">
                                Transcript {response.source}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="field-group">
                      <label htmlFor="prospect-words">
                        PROSPECT'S OWN WORDS
                      </label>
                      <textarea
                        id="prospect-words"
                        rows={5}
                        value={prospectWords}
                        onChange={(event) =>
                          setProspectWords(event.target.value)
                        }
                        placeholder="Capture what the prospect actually said. Avoid adding assumptions."
                        disabled={loading}
                      />
                      <p className="field-hint">
                        This note is saved with the current stage.
                      </p>
                    </div>

                    <div className="call-actions">
                      <button
                        className="danger-button"
                        type="button"
                        onClick={openCloseForm}
                        disabled={loading}
                      >
                        End call
                      </button>

                      <button
                        className="primary-button"
                        type="button"
                        onClick={nextStage}
                        disabled={loading}
                      >
                        {loading
                          ? "Saving..."
                          : stageIndex === stages.length - 1
                            ? "Save stage & close"
                            : "Save & next stage"}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </section>

                  <aside className="panel coach-panel">
                    <div className="coach-heading">
                      <span className="coach-icon">✳</span>
                      <div>
                        <p className="eyebrow">AI-POWERED SUPPORT</p>
                        <h2>Call coach</h2>
                      </div>
                    </div>

                    <p className="muted">
                      Get a suggested response and next question based on the
                      current stage and the prospect's notes.
                    </p>

                    <button
                      className="secondary-button coach-button"
                      type="button"
                      onClick={getAiCoaching}
                      disabled={aiLoading || loading}
                    >
                      {aiLoading
                        ? "Generating coaching..."
                        : "Get AI coaching"}
                      {!aiLoading && <span aria-hidden="true">✦</span>}
                    </button>

                    {aiError && (
                      <div className="error-banner compact" role="alert">
                        {aiError}
                      </div>
                    )}

                    {aiSuggestion && (
                      <div className="ai-result">
                        <p className="eyebrow">COACHING SUGGESTION</p>
                        <div className="ai-suggestion">{aiSuggestion}</div>
                      </div>
                    )}

                    {!aiSuggestion && !aiError && (
                      <div className="coach-placeholder">
                        <span className="placeholder-symbol">✧</span>
                        <p>Your coaching suggestion will appear here.</p>
                        <span className="field-hint">
                          Keep the conversation natural and respectful.
                        </span>
                      </div>
                    )}

                    <div className="coach-note">
                      <strong>Remember</strong>
                      <p>
                        If a prospect clearly declines or asks not to be
                        contacted, respect that decision. Do not use coaching
                        to pressure them.
                      </p>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <section className="page-heading">
              <div>
                <p className="eyebrow">YOUR SAVED CONVERSATIONS</p>
                <h1>Call history</h1>
                <p className="muted">
                  Review saved stages, prospect notes, and call outcomes.
                </p>
              </div>

              <button
                className="primary-button"
                type="button"
                onClick={startCall}
              >
                + New call
              </button>
            </section>

            <section className="history-summary">
              <div className="summary-card">
                <span className="summary-label">TOTAL CALLS</span>
                <strong>{calls.length}</strong>
              </div>

              <div className="summary-card">
                <span className="summary-label">NEXT STEP AGREED</span>
                <strong>
                  {
                    calls.filter(
                      (call) => call.outcome === "Next step agreed"
                    ).length
                  }
                </strong>
              </div>

              <div className="summary-card">
                <span className="summary-label">FOLLOW-UP REQUIRED</span>
                <strong>
                  {
                    calls.filter(
                      (call) => call.outcome === "Follow-up required"
                    ).length
                  }
                </strong>
              </div>
            </section>

            {calls.length === 0 ? (
              <section className="panel empty-state">
                <span className="empty-icon">◷</span>
                <h2>No saved calls yet</h2>
                <p className="muted">
                  Start a conversation to see its progress and outcome here.
                </p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={startCall}
                >
                  Start your first call
                </button>
              </section>
            ) : (
              <section className="history-list">
                {calls.map((call) => {
                  const savedStages = getCallStages(call);
                  const expanded = expandedCallId === call.id;
                  const lastStage = savedStages[savedStages.length - 1];

                  return (
                    <article className="panel history-card" key={call.id}>
                      <button
                        className="history-card-header"
                        type="button"
                        onClick={() => toggleCallDetails(call.id)}
                        aria-expanded={expanded}
                      >
                        <div className="history-main">
                          <span className="history-avatar">
                            {(call.prospect || "U")
                              .trim()
                              .charAt(0)
                              .toUpperCase()}
                          </span>

                          <div>
                            <h3>{call.prospect || "Unnamed prospect"}</h3>
                            <p className="muted">
                              {formatDate(call.started_at)}
                            </p>
                          </div>
                        </div>

                        <div className="history-meta">
                          <span className="stage-pill">
                            {savedStages.length} / 8 stages
                          </span>

                          <span className="outcome-label">
                            {call.outcome || "Outcome not recorded"}
                          </span>

                          <span className="expand-icon">
                            {expanded ? "−" : "+"}
                          </span>
                        </div>
                      </button>

                      <div className="history-card-summary">
                        <span>
                          Last stage:{" "}
                          <strong>
                            {lastStage?.stage_name || "Not recorded"}
                          </strong>
                        </span>

                        {call.next_step && (
                          <span>
                            Next step: <strong>{call.next_step}</strong>
                          </span>
                        )}
                      </div>

                      {expanded && (
                        <div className="history-details">
                          {savedStages.length === 0 ? (
                            <p className="muted">
                              No stage details have been saved.
                            </p>
                          ) : (
                            savedStages.map((savedStage) => (
                              <div
                                className="saved-stage"
                                key={savedStage.id || savedStage.stage}
                              >
                                <div className="saved-stage-heading">
                                  <span className="saved-stage-number">
                                    {savedStage.stage}
                                  </span>
                                  <h4>{savedStage.stage_name}</h4>
                                </div>

                                <p>
                                  <strong>Selected response:</strong>{" "}
                                  {savedStage.selected_response ||
                                    "No response selected"}
                                </p>

                                <p>
                                  <strong>Prospect's words:</strong>{" "}
                                  {savedStage.prospect_words ||
                                    "No notes recorded"}
                                </p>
                              </div>
                            ))
                          )}

                          <div className="saved-stage final-outcome">
                            <h4>Final outcome</h4>
                            <p>{call.outcome || "Not recorded"}</p>
                            <p>
                              <strong>Next step:</strong>{" "}
                              {call.next_step || "None recorded"}
                            </p>
                            {call.ended_at && (
                              <p>
                                <strong>Ended:</strong>{" "}
                                {formatDate(call.ended_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}
      </div>

      <footer className="app-footer">
        <span>CallPilot</span>
        <span>Structured conversations. Better follow-through.</span>
      </footer>
    </main>
  );
}
