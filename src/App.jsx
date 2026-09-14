import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import {
  bulkIngestQuestions,
  getQuestionById,
  getQuestions,
  getTopicQuestions,
  getTopics,
  patchQuestion,
  renameSubtopic,
  renameTopic,
} from './api/client'
import Navbar from './components/Navbar'
import QuestionCard from './components/QuestionCard'
import TopicSidebar from './components/TopicSidebar'

const PAGE_SIZE = 8
const ALL_TOPICS = 'All Topics'

const sampleBulkPayload = `[
  {
    "id": "demo-1",
    "topic": "JavaScript",
    "subtopic": "Arrays",
    "question_text": "Which method creates a new array by calling a function on every element?",
    "options": [
      { "index": 0, "text": "map()" },
      { "index": 1, "text": "filter()" },
      { "index": 2, "text": "reduce()" },
      { "index": 3, "text": "forEach()" }
    ],
    "correct_option_indices": [0],
    "explanation": "map() transforms each element and returns a new array with the same length.",
    "difficulty": "EASY"
  }
]`

function normalizeQuestionArray(payload) {
  if (Array.isArray(payload)) {
    return payload.flatMap((item) => {
      if (Array.isArray(item?.questions)) {
        return item.questions
      }

      return item ? [item] : []
    })
  }

  if (Array.isArray(payload?.questions)) {
    return payload.questions
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  if (Array.isArray(payload?.items)) {
    return payload.items
  }

  return []
}

function normalizeSubtopics(payload) {
  const groups = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.subtopics)
      ? payload.subtopics
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.topics)
          ? payload.topics
          : Array.isArray(payload?.groups)
            ? payload.groups
            : []

  return groups
    .flatMap((group) => {
      if (typeof group === 'string') {
        return [group]
      }

      if (typeof group?.subtopic === 'string') {
        return [group.subtopic]
      }

      if (typeof group?.name === 'string') {
        return [group.name]
      }

      return []
    })
    .filter(Boolean)
}

function getQuestionId(question) {
  return question?.id ?? question?.question_id ?? question?._id ?? `${question?.topic ?? 'question'}-${question?.question_text ?? ''}`
}

function App() {
  const [appState, setAppState] = useState('welcome') // 'welcome' | 'waking' | 'ready'
  const [wakeProgress, setWakeProgress] = useState(0)
  const [wakeStatus, setWakeStatus] = useState('Ready to boot')
  const [wakeError, setWakeError] = useState('')

  const [topics, setTopics] = useState([])
  const [subtopics, setSubtopics] = useState([])
  const [selectedTopic, setSelectedTopic] = useState(ALL_TOPICS)
  const [selectedSubtopic, setSelectedSubtopic] = useState('')
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [spinnerUp, setSpinnerUp] = useState(false)
  const [error, setError] = useState('')
  const [answerMap, setAnswerMap] = useState({})
  const [adminOpen, setAdminOpen] = useState(false)
  const [bulkJson, setBulkJson] = useState(sampleBulkPayload)
  const [adminMessage, setAdminMessage] = useState('')
  const [editForm, setEditForm] = useState({
    questionId: '',
    questionText: '',
    explanation: '',
  })
  const [questionLookupId, setQuestionLookupId] = useState('')
  const [questionLookupResult, setQuestionLookupResult] = useState(null)
  const [renameTopicForm, setRenameTopicForm] = useState({
    topic: '',
    nextName: '',
  })
  const [renameSubtopicForm, setRenameSubtopicForm] = useState({
    topic: '',
    subtopic: '',
    nextName: '',
  })
  const [topicDrawerOpen, setTopicDrawerOpen] = useState(false)
  const [focusModeOpen, setFocusModeOpen] = useState(false)
  const spinnerTimerRef = useRef(null)

  const currentQuestion = questions[currentIndex]
  const currentAnswer = currentQuestion ? answerMap[getQuestionId(currentQuestion)] : null

  const selectedTopicLabel = useMemo(() => {
    if (selectedTopic === ALL_TOPICS) {
      return ALL_TOPICS
    }

    if (!selectedSubtopic) {
      return selectedTopic
    }

    return `${selectedTopic} / ${selectedSubtopic}`
  }, [selectedSubtopic, selectedTopic])

  useEffect(() => {
    if (!focusModeOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setFocusModeOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusModeOpen])

  const stopWarmupTimer = useCallback(() => {
    if (spinnerTimerRef.current) {
      clearTimeout(spinnerTimerRef.current)
      spinnerTimerRef.current = null
    }

    setSpinnerUp(false)
  }, [])

  const runWithWarmup = useCallback(async (task) => {
    stopWarmupTimer()
    spinnerTimerRef.current = setTimeout(() => setSpinnerUp(true), 2000)

    try {
      return await task()
    } finally {
      stopWarmupTimer()
    }
  }, [stopWarmupTimer])

  const loadTopics = useCallback(async () => {
    setTopicsLoading(true)
    setError('')

    try {
      const payload = await runWithWarmup(() => getTopics())
      setTopics(normalizeSubtopics(payload))
    } catch (loadError) {
      setError(loadError.message || 'Failed to load topics.')
    } finally {
      setTopicsLoading(false)
    }
  }, [runWithWarmup])

  const loadSubtopics = useCallback(async (topic) => {
    if (topic === ALL_TOPICS) {
      setSubtopics([])
      return
    }

    try {
      const payload = await runWithWarmup(() => getTopicQuestions(topic, { limit: 250, offset: 0 }))
      setSubtopics(normalizeSubtopics(payload))
    } catch {
      setSubtopics([])
    }
  }, [runWithWarmup])

  const loadQuestions = useCallback(async ({ topic, subtopic, offset = 0, append = false } = {}) => {
    setQuestionsLoading(true)
    setError('')

    try {
      const payload = await runWithWarmup(() =>
        getQuestions({
          topic: topic === ALL_TOPICS ? undefined : topic,
          subtopic: subtopic || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
      )

      const nextQuestions = normalizeQuestionArray(payload)

      setQuestions((previousQuestions) => {
        const mergedQuestions = append ? [...previousQuestions, ...nextQuestions] : nextQuestions
        return mergedQuestions
      })
      setHasMore(nextQuestions.length === PAGE_SIZE)
      setCurrentIndex(append ? offset : 0)
    } catch (loadError) {
      setError(loadError.message || 'Failed to load questions.')
      if (!append) {
        setQuestions([])
      }
    } finally {
      setQuestionsLoading(false)
    }
  }, [runWithWarmup])

  const handleWakeUp = async () => {
    setAppState('waking')
    setWakeProgress(0)
    setWakeStatus('Sending wakeup signal to Render server...')
    setWakeError('')

    // Start simulated progress bar (takes about 50 seconds to hit ~95%)
    let currentProgress = 0
    const progressInterval = setInterval(() => {
      currentProgress += 2
      if (currentProgress > 95) {
        currentProgress = 95
      }
      setWakeProgress(currentProgress)

      // Change status text based on progress
      if (currentProgress < 20) {
        setWakeStatus('Sending wakeup signal to Render server...')
      } else if (currentProgress < 40) {
        setWakeStatus('Spinning up virtual environment containers...')
      } else if (currentProgress < 60) {
        setWakeStatus('Connecting to MongoDB database instance...')
      } else if (currentProgress < 80) {
        setWakeStatus('Synchronizing MCQ collections and indexes...')
      } else {
        setWakeStatus('Waiting for final server handshake...')
      }
    }, 1000)

    // Ping loop
    let attempts = 0
    const maxAttempts = 30
    let success = false
    let lastError = null

    while (attempts < maxAttempts && !success) {
      try {
        // Attempt to fetch topics - this pings the server
        // Provide a long timeout (75 seconds) specifically for the wakeup process
        await getTopics({ timeoutMs: 75000 })
        success = true
      } catch (err) {
        attempts++
        lastError = err
        // Wait 2.5 seconds before next attempt
        await new Promise((resolve) => setTimeout(resolve, 2500))
      }
    }

    clearInterval(progressInterval)

    if (success) {
      setWakeProgress(100)
      setWakeStatus('Connection established successfully!')
      // Wait a moment so the user sees 100% progress
      setTimeout(() => {
        setAppState('ready')
      }, 800)
    } else {
      const errorDetail = lastError?.message ? ` Details: ${lastError.message}` : '';
      setWakeError(`Server wakeup timed out or failed. ${errorDetail} Render free tier might be experiencing high load or blocked by CORS. Please try again.`);
      setAppState('welcome')
    }
  }

  useEffect(() => {
    if (appState !== 'ready') {
      return
    }

    let cancelled = false

    const bootstrap = async () => {
      await Promise.resolve()

      if (cancelled) {
        return
      }

      await loadTopics()

      if (cancelled) {
        return
      }

      await loadQuestions({ topic: ALL_TOPICS, subtopic: '', offset: 0, append: false })
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [appState, loadQuestions, loadTopics])

  const handleSelectTopic = async (topic) => {
    setSelectedTopic(topic)
    setSelectedSubtopic('')
    setQuestions([])
    setCurrentIndex(0)
    setHasMore(true)
    setAnswerMap({})
    setTopicDrawerOpen(false)

    if (topic === ALL_TOPICS) {
      setSubtopics([])
      await loadQuestions({ topic: ALL_TOPICS, subtopic: '', offset: 0, append: false })
      return
    }

    await loadSubtopics(topic)
    await loadQuestions({ topic, subtopic: '', offset: 0, append: false })
  }

  const handleSelectSubtopic = async (subtopic) => {
    setSelectedSubtopic(subtopic)
    setQuestions([])
    setCurrentIndex(0)
    setHasMore(true)
    setAnswerMap({})
    setTopicDrawerOpen(false)
    await loadQuestions({ topic: selectedTopic, subtopic, offset: 0, append: false })
  }

  const handleSelectOption = (question, optionIndex) => {
    const questionId = getQuestionId(question)
    if (answerMap[questionId]) {
      return
    }

    const isCorrect =
      question.correct_option_indices?.includes(optionIndex) ||
      optionIndex === question.correct_option_index
    setAnswerMap((previous) => ({
      ...previous,
      [questionId]: {
        optionIndex,
        isCorrect,
      },
    }))
  }

  const handleNext = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((previousIndex) => previousIndex + 1)
      return
    }

    if (!hasMore || questionsLoading) {
      return
    }

    const nextOffset = questions.length
    await loadQuestions({
      topic: selectedTopic,
      subtopic: selectedSubtopic,
      offset: nextOffset,
      append: true,
    })
  }

  const handlePrevious = () => {
    setCurrentIndex((previousIndex) => Math.max(previousIndex - 1, 0))
  }

  const handleRefresh = async () => {
    await Promise.all([
      loadTopics(),
      loadQuestions({ topic: selectedTopic, subtopic: selectedSubtopic, offset: 0, append: false }),
    ])
  }

  const handleBulkIngest = async (event) => {
    event.preventDefault()

    try {
      const parsed = JSON.parse(bulkJson)
      await bulkIngestQuestions(parsed)
      setAdminMessage('Bulk ingest request sent successfully.')
    } catch (ingestError) {
      setAdminMessage(ingestError.message || 'Bulk ingest failed.')
    }
  }

  const handlePatchQuestion = async (event) => {
    event.preventDefault()

    if (!editForm.questionId.trim()) {
      setAdminMessage('Question id is required for PATCH.')
      return
    }

    try {
      await patchQuestion(editForm.questionId.trim(), {
        question_text: editForm.questionText || undefined,
        explanation: editForm.explanation || undefined,
      })
      setAdminMessage('Question updated successfully.')
    } catch (patchError) {
      setAdminMessage(patchError.message || 'Question update failed.')
    }
  }

  const handleGetQuestionById = async (event) => {
    event.preventDefault()

    if (!questionLookupId.trim()) {
      setAdminMessage('Question id is required for GET by id.')
      return
    }

    try {
      const payload = await getQuestionById(questionLookupId.trim())
      setQuestionLookupResult(payload)
      setAdminMessage('Question fetched successfully.')
    } catch (fetchError) {
      setQuestionLookupResult(null)
      setAdminMessage(fetchError.message || 'Fetching question by id failed.')
    }
  }

  const handleRenameTopic = async (event) => {
    event.preventDefault()

    if (!renameTopicForm.topic.trim() || !renameTopicForm.nextName.trim()) {
      setAdminMessage('Both current topic and next topic name are required.')
      return
    }

    try {
      await renameTopic(renameTopicForm.topic.trim(), renameTopicForm.nextName.trim())
      setAdminMessage('Topic rename request sent successfully.')
      await loadTopics()
    } catch (renameError) {
      setAdminMessage(renameError.message || 'Topic rename failed.')
    }
  }

  const handleRenameSubtopic = async (event) => {
    event.preventDefault()

    if (!renameSubtopicForm.topic.trim() || !renameSubtopicForm.subtopic.trim() || !renameSubtopicForm.nextName.trim()) {
      setAdminMessage('Topic, subtopic, and next subtopic name are required.')
      return
    }

    try {
      await renameSubtopic(
        renameSubtopicForm.topic.trim(),
        renameSubtopicForm.subtopic.trim(),
        renameSubtopicForm.nextName.trim(),
      )
      setAdminMessage('Subtopic rename request sent successfully.')
      if (selectedTopic !== ALL_TOPICS) {
        await loadSubtopics(selectedTopic)
      }
    } catch (renameError) {
      setAdminMessage(renameError.message || 'Subtopic rename failed.')
    }
  }

  if (appState !== 'ready') {
    return (
      <div className="min-h-screen bg-[#07111f] text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,_rgba(14,165,233,0.15),_transparent_50%),linear-gradient(180deg,_#08101c_0%,_#050915_100%)]" />
        <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:32px_32px] opacity-25" />

        <div className="w-full max-w-xl text-center space-y-8 relative">
          {/* Logo & Header */}
          <div className="space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 text-cyan-300 shadow-[0_0_50px_rgba(34,211,238,0.25)] animate-pulse">
              <BookOpen className="h-10 w-10 text-cyan-300" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-300 via-sky-200 to-emerald-300 bg-clip-text text-transparent">
              QLearner App
            </h1>
            <p className="text-slate-400 text-base sm:text-lg max-w-md mx-auto leading-relaxed">
              Your advanced workspace for masterclass MCQ practice, flashcards, and step-by-step solutions.
            </p>
          </div>

          {/* Main Card */}
          <div className="rounded-[2rem] border border-slate-800 bg-slate-950/70 p-6 sm:p-8 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl space-y-6">
            {appState === 'welcome' ? (
              <>
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold text-white">Database Server Status</h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    The backend API is hosted on a Render free instance, which automatically goes to sleep after inactivity.
                    Waking it up takes about <span className="text-cyan-300 font-semibold">45-60 seconds</span>.
                  </p>
                </div>

                {wakeError && (
                  <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-left text-sm text-rose-200">
                    <span className="shrink-0 text-rose-400 font-bold">⚠️</span>
                    <p>{wakeError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleWakeUp}
                  className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 px-6 py-4 text-base font-bold shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  🚀 Wake Up Server & Start
                </button>
              </>
            ) : (
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">Initializing Environment</h3>
                  <p className="text-xs font-mono text-cyan-300 animate-pulse">{wakeStatus}</p>
                </div>

                {/* Progress Bar Container */}
                <div className="space-y-2">
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden p-[2px] border border-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-500 ease-out"
                      style={{ width: `${wakeProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-mono">
                    <span>PROGRESS</span>
                    <span className="text-cyan-300 font-semibold">{wakeProgress}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  <span>Please keep this page open. Waking virtual machines...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col overflow-hidden bg-[#07111f] text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(12,132,199,0.25),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.2),_transparent_30%),linear-gradient(180deg,_#08101c_0%,_#050915_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:42px_42px] opacity-30" />

      <Navbar
        currentSelection={selectedTopicLabel}
        isBusy={topicsLoading || questionsLoading}
        isWarmup={spinnerUp}
        onRefresh={handleRefresh}
        onToggleFocus={() => setFocusModeOpen((previous) => !previous)}
        onToggleAdmin={() => setAdminOpen((previous) => !previous)}
        isFocusMode={focusModeOpen}
      />

      <main className="mx-auto flex w-full max-w-7xl flex-1 min-h-0 flex-col gap-4 overflow-hidden px-4 pb-4 pt-3 lg:flex-row lg:gap-6 lg:px-6">
        <TopicSidebar
          className="hidden lg:block"
          allTopicsLabel={ALL_TOPICS}
          currentTopic={selectedTopic}
          currentSubtopic={selectedSubtopic}
          loading={topicsLoading}
          onSelectSubtopic={handleSelectSubtopic}
          onSelectTopic={handleSelectTopic}
          onSelectAllTopics={() => handleSelectTopic(ALL_TOPICS)}
          subtopics={subtopics}
          topics={topics}
        />

        <section className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-300 sm:mb-4 sm:gap-3 sm:text-sm">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-100 lg:hidden"
              onClick={() => setTopicDrawerOpen(true)}
            >
              Browse topics
            </button>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/50 px-3 py-1.5 backdrop-blur">
              <BookOpen className="h-4 w-4 text-cyan-300" />
              {questions.length ? `${currentIndex + 1} of ${questions.length}` : 'No questions loaded yet'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-950/50 px-3 py-1.5 backdrop-blur">
              <ChevronRight className="h-4 w-4 text-emerald-300" />
              {selectedTopicLabel}
            </span>
            {hasMore ? (
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-200">
                More questions available
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 sm:mb-4">
              {error}
            </div>
          ) : null}

          {spinnerUp ? (
            <div className="mb-3 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100 shadow-[0_0_40px_rgba(14,165,233,0.12)] sm:mb-4">
              Spinning up backend... this may take a moment on cold starts.
            </div>
          ) : null}

          <div className="min-h-0 flex-1">
            {currentQuestion ? (
              <QuestionCard
                currentIndex={currentIndex}
                currentQuestion={currentQuestion}
                currentSelection={currentAnswer}
                hasMore={hasMore}
                isLoading={questionsLoading}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onSelectOption={handleSelectOption}
                questionsCount={questions.length}
              />
            ) : (
              <div className="flex h-full min-h-0 items-center justify-center rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-6 text-center shadow-2xl shadow-cyan-950/10 backdrop-blur-xl sm:p-8">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-300">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white">Pick a topic to start practicing</h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
                    The app will fetch topics on load, then stream questions with instant feedback, explanation cards,
                    and pagination-aware navigation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {focusModeOpen ? (
        <div className="fixed inset-0 z-30 bg-slate-950/95 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-3 overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950/80 p-3 shadow-2xl shadow-black/40 sm:p-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Focus mode</p>
                <p className="mt-1 text-sm text-slate-400">Only the question, answers, explanation, and navigation are shown.</p>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200"
                onClick={() => setFocusModeOpen(false)}
              >
                Exit focus
              </button>
            </div>

            <div className="min-h-0 flex-1">
              {currentQuestion ? (
                <QuestionCard
                  currentIndex={currentIndex}
                  currentQuestion={currentQuestion}
                  currentSelection={currentAnswer}
                  hasMore={hasMore}
                  immersive
                  isLoading={questionsLoading}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                  onSelectOption={handleSelectOption}
                  questionsCount={questions.length}
                />
              ) : (
                <div className="flex h-full items-center justify-center rounded-[2rem] border border-dashed border-slate-700 bg-slate-950/60 p-8 text-center text-slate-300">
                  No question loaded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {topicDrawerOpen ? (
        <div className="fixed inset-0 z-20 flex lg:hidden">
          <button
            type="button"
            className="flex-1 bg-slate-950/75 backdrop-blur-sm"
            aria-label="Close topics drawer"
            onClick={() => setTopicDrawerOpen(false)}
          />
          <aside className="h-full w-full max-w-sm overflow-hidden border-l border-slate-700 bg-slate-950 p-4 shadow-2xl shadow-black/30">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Browse</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Topics & subtopics</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
                onClick={() => setTopicDrawerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)] overflow-y-auto pr-1">
              <TopicSidebar
                className="w-full"
                panelClassName="top-0 rounded-[1.5rem] border-slate-700/80 bg-slate-950/95 p-4 backdrop-blur-xl"
                topicListClassName="max-h-none"
                allTopicsLabel={ALL_TOPICS}
                currentTopic={selectedTopic}
                currentSubtopic={selectedSubtopic}
                loading={topicsLoading}
                onSelectSubtopic={handleSelectSubtopic}
                onSelectTopic={handleSelectTopic}
                onSelectAllTopics={() => handleSelectTopic(ALL_TOPICS)}
                subtopics={subtopics}
                topics={topics}
              />
            </div>
          </aside>
        </div>
      ) : null}

      {adminOpen ? (
        <div className="fixed inset-0 z-20 flex justify-end bg-slate-950/70 backdrop-blur-sm">
          <button
            type="button"
            className="flex-1 cursor-default"
            aria-label="Close admin drawer"
            onClick={() => setAdminOpen(false)}
          />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-700 bg-slate-950 p-5 shadow-2xl shadow-black/30 sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">Management</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Quick Admin Drawer</h2>
                <p className="mt-2 text-sm text-slate-400">Bulk ingest question sets or patch question content inline.</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
                onClick={() => setAdminOpen(false)}
              >
                Close
              </button>
            </div>

            {adminMessage ? (
              <div className="mb-4 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                {adminMessage}
              </div>
            ) : null}

            <form className="space-y-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-4" onSubmit={handleBulkIngest}>
              <div>
                <h3 className="text-lg font-semibold text-white">Bulk ingest</h3>
                <p className="mt-1 text-sm text-slate-400">Paste a JSON array matching the question schema.</p>
              </div>
              <textarea
                className="min-h-48 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                value={bulkJson}
                onChange={(event) => setBulkJson(event.target.value)}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Send bulk payload
              </button>
            </form>

            <form className="mt-4 space-y-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-4" onSubmit={handlePatchQuestion}>
              <div>
                <h3 className="text-lg font-semibold text-white">Patch question</h3>
                <p className="mt-1 text-sm text-slate-400">Update question text or explanation by id.</p>
              </div>
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Question id"
                value={editForm.questionId}
                onChange={(event) => setEditForm((previous) => ({ ...previous, questionId: event.target.value }))}
              />
              <textarea
                className="min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Question text"
                value={editForm.questionText}
                onChange={(event) => setEditForm((previous) => ({ ...previous, questionText: event.target.value }))}
              />
              <textarea
                className="min-h-24 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Explanation"
                value={editForm.explanation}
                onChange={(event) => setEditForm((previous) => ({ ...previous, explanation: event.target.value }))}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300 hover:bg-emerald-400/20"
              >
                Submit PATCH request
              </button>
            </form>

            <form className="mt-4 space-y-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-4" onSubmit={handleGetQuestionById}>
              <div>
                <h3 className="text-lg font-semibold text-white">Get question by id</h3>
                <p className="mt-1 text-sm text-slate-400">Calls GET /api/questions/{'{question_id}'}.</p>
              </div>
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Question id"
                value={questionLookupId}
                onChange={(event) => setQuestionLookupId(event.target.value)}
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20"
              >
                Fetch question
              </button>
              {questionLookupResult ? (
                <pre className="overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300">
                  {JSON.stringify(questionLookupResult, null, 2)}
                </pre>
              ) : null}
            </form>

            <form className="mt-4 space-y-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-4" onSubmit={handleRenameTopic}>
              <div>
                <h3 className="text-lg font-semibold text-white">Rename topic</h3>
                <p className="mt-1 text-sm text-slate-400">Calls PUT /api/topics/{'{topic}'}/rename.</p>
              </div>
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Current topic"
                value={renameTopicForm.topic}
                onChange={(event) =>
                  setRenameTopicForm((previous) => ({
                    ...previous,
                    topic: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="New topic name"
                value={renameTopicForm.nextName}
                onChange={(event) =>
                  setRenameTopicForm((previous) => ({
                    ...previous,
                    nextName: event.target.value,
                  }))
                }
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-500/15 px-4 py-2.5 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20"
              >
                Submit topic rename
              </button>
            </form>

            <form className="mt-4 space-y-4 rounded-3xl border border-slate-700 bg-slate-900/60 p-4" onSubmit={handleRenameSubtopic}>
              <div>
                <h3 className="text-lg font-semibold text-white">Rename subtopic</h3>
                <p className="mt-1 text-sm text-slate-400">Calls PUT /api/topics/{'{topic}'}/subtopics/{'{subtopic}'}/rename.</p>
              </div>
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Topic"
                value={renameSubtopicForm.topic}
                onChange={(event) =>
                  setRenameSubtopicForm((previous) => ({
                    ...previous,
                    topic: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="Current subtopic"
                value={renameSubtopicForm.subtopic}
                onChange={(event) =>
                  setRenameSubtopicForm((previous) => ({
                    ...previous,
                    subtopic: event.target.value,
                  }))
                }
              />
              <input
                className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                placeholder="New subtopic name"
                value={renameSubtopicForm.nextName}
                onChange={(event) =>
                  setRenameSubtopicForm((previous) => ({
                    ...previous,
                    nextName: event.target.value,
                  }))
                }
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-2xl border border-violet-400/40 bg-violet-500/15 px-4 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-300 hover:bg-violet-400/20"
              >
                Submit subtopic rename
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default App
