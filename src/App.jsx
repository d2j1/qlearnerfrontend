import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronRight, Loader2 } from 'lucide-react'
import {
  getMe,
  getQuestions,
  getSubtopicQuestions,
  getSubtopics,
  getTopics,
  logout,
  setOnUnauthorized,
  tokenStore,
} from './api/client'
import AuthModal from './components/AuthModal'
import { isAdminPath } from './components/admin/helpers'
import Navbar from './components/Navbar'
import QuestionCard from './components/QuestionCard'
import RenameTaxonomyPanel from './components/RenameTaxonomyPanel'
import TopicSidebar from './components/TopicSidebar'
import { navigate, useLocation } from './lib/router'

// Admin screens pull in markdown + syntax highlighting; learners never download them.
const AdminShell = lazy(() => import('./components/admin/AdminShell'))
const PracticeQuestionActions = lazy(() => import('./components/admin/PracticeQuestionActions'))

const PAGE_SIZE = 8
const ALL_TOPICS = 'All Topics'

function isAnswerCorrect(question, selected) {
  const correct = new Set(question.correct_option_indices ?? [])
  return selected.length === correct.size && selected.every((index) => correct.has(index))
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
  const [questionAction, setQuestionAction] = useState(null) // { type: 'edit' | 'delete', question }
  const [user, setUser] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authNotice, setAuthNotice] = useState('')
  const userRef = useRef(null)
  const [topicDrawerOpen, setTopicDrawerOpen] = useState(false)
  const [focusModeOpen, setFocusModeOpen] = useState(false)
  const spinnerTimerRef = useRef(null)
  const { pathname, query } = useLocation()
  const onAdminPage = isAdminPath(pathname)
  const practiceTopicParam = pathname === '/' ? query.get('topic') : null
  const wasOnAdminPageRef = useRef(onAdminPage)

  const currentQuestion = questions[currentIndex]
  const currentAnswer = currentQuestion ? answerMap[getQuestionId(currentQuestion)] : null

  const selectedTopicLabel = useMemo(() => {
    if (selectedTopic === ALL_TOPICS) {
      return 'Pick a topic'
    }

    if (!selectedSubtopic) {
      return selectedTopic
    }

    return `${selectedTopic} / ${selectedSubtopic}`
  }, [selectedSubtopic, selectedTopic])

  useEffect(() => {
    userRef.current = user
  }, [user])

  // Any 401 on an authenticated call: the client has already cleared the token.
  useEffect(() => {
    setOnUnauthorized(() => {
      const wasLoggedIn = Boolean(userRef.current)
      setUser(null)
      setAdminOpen(false)
      if (wasLoggedIn) {
        setAuthNotice('Your session expired. Please log in again.')
        setAuthOpen(true)
      }
    })
    return () => setOnUnauthorized(() => {})
  }, [])

  // Restore the session once the backend is awake.
  useEffect(() => {
    if (appState !== 'ready' || !tokenStore.get()) {
      return
    }
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
  }, [appState])

  const handleAuthenticated = (nextUser) => {
    setUser(nextUser)
    setAuthOpen(false)
    setAuthNotice('')
  }

  const handleLogout = () => {
    logout()
    setUser(null)
    setAdminOpen(false)
  }

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
      setTopics(Array.isArray(payload?.topics) ? payload.topics : [])
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
      const payload = await runWithWarmup(() => getSubtopics(topic))
      setSubtopics(Array.isArray(payload?.subtopics) ? payload.subtopics : [])
      return true
    } catch (loadError) {
      setSubtopics([])
      if (loadError.status === 404) {
        // Topic was renamed or emptied: go back to the topic list.
        setError(`Topic "${topic}" no longer exists.`)
        setSelectedTopic(ALL_TOPICS)
        setSelectedSubtopic('')
        await loadTopics()
        return false
      }
      return true
    }
  }, [loadTopics, runWithWarmup])

  const loadQuestions = useCallback(async ({ topic, subtopic, offset = 0, append = false } = {}) => {
    setQuestionsLoading(true)
    setError('')

    try {
      const payload = await runWithWarmup(() =>
        topic !== ALL_TOPICS && subtopic
          ? getSubtopicQuestions(topic, subtopic, { limit: PAGE_SIZE, offset })
          : getQuestions({
              topic: topic === ALL_TOPICS ? undefined : topic,
              limit: PAGE_SIZE,
              offset,
            }),
      )

      const nextQuestions = Array.isArray(payload?.items) ? payload.items : []
      const total = typeof payload?.total === 'number' ? payload.total : 0

      setQuestions((previousQuestions) => {
        const mergedQuestions = append ? [...previousQuestions, ...nextQuestions] : nextQuestions
        return mergedQuestions
      })
      setHasMore(offset + nextQuestions.length < total)
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
    setError('')

    // Picking a topic only lists its subtopics; questions load once a subtopic is chosen.
    if (topic === ALL_TOPICS) {
      setSubtopics([])
      return
    }

    await loadSubtopics(topic)
  }

  const handleSelectSubtopic = async (subtopic) => {
    setSelectedSubtopic(subtopic)
    setQuestions([])
    setCurrentIndex(0)
    setHasMore(true)
    setAnswerMap({})

    if (!subtopic) {
      setHasMore(false)
      return
    }

    setTopicDrawerOpen(false)
    await loadQuestions({ topic: selectedTopic, subtopic, offset: 0, append: false })
  }

  const handleSelectOption = (question, optionIndex) => {
    const questionId = getQuestionId(question)
    const existing = answerMap[questionId]
    if (existing?.submitted) {
      return
    }

    const isMultiSelect = (question.correct_option_indices?.length ?? 0) > 1

    if (!isMultiSelect) {
      const selected = [optionIndex]
      setAnswerMap((previous) => ({
        ...previous,
        [questionId]: { selected, submitted: true, isCorrect: isAnswerCorrect(question, selected) },
      }))
      return
    }

    const current = existing?.selected ?? []
    const selected = current.includes(optionIndex)
      ? current.filter((index) => index !== optionIndex)
      : [...current, optionIndex]
    setAnswerMap((previous) => ({
      ...previous,
      [questionId]: { selected, submitted: false, isCorrect: false },
    }))
  }

  const handleSubmitAnswer = (question) => {
    const questionId = getQuestionId(question)
    const selected = answerMap[questionId]?.selected ?? []
    if (!selected.length) {
      return
    }

    setAnswerMap((previous) => ({
      ...previous,
      [questionId]: { selected, submitted: true, isCorrect: isAnswerCorrect(question, selected) },
    }))
  }

  const refreshAfterWrite = async () => {
    await loadTopics()
    if (selectedTopic !== ALL_TOPICS) {
      await loadSubtopics(selectedTopic)
    }
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
    await loadTopics()
    if (selectedTopic !== ALL_TOPICS) {
      await loadSubtopics(selectedTopic)
    }
    if (selectedTopic !== ALL_TOPICS && selectedSubtopic) {
      await loadQuestions({ topic: selectedTopic, subtopic: selectedSubtopic, offset: 0, append: false })
    }
  }

  // Back from the admin screens: approvals change topics and subtopic counts. "?topic=" opens that topic.
  useEffect(() => {
    const cameFromAdmin = wasOnAdminPageRef.current
    wasOnAdminPageRef.current = onAdminPage
    if (appState !== 'ready' || onAdminPage || (!cameFromAdmin && !practiceTopicParam)) {
      return undefined
    }

    let cancelled = false
    const sync = async () => {
      await Promise.resolve()
      if (cancelled) {
        return
      }
      if (practiceTopicParam) {
        navigate('/', { replace: true })
        await loadTopics()
        await handleSelectTopic(practiceTopicParam)
      } else {
        await refreshAfterWrite()
      }
    }
    void sync()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState, onAdminPage, practiceTopicParam])

  const handleQuestionSaved = (previous, updated) => {
    setQuestions((list) => list.map((question) => (question.id === updated.id ? updated : question)))
    const answerChanged =
      JSON.stringify(previous.options) !== JSON.stringify(updated.options) ||
      JSON.stringify(previous.correct_option_indices) !== JSON.stringify(updated.correct_option_indices)
    if (answerChanged) {
      // The old selection was graded against the old answer; let the user answer again.
      setAnswerMap((map) => {
        const next = { ...map }
        delete next[getQuestionId(updated)]
        return next
      })
    }
  }

  const handleQuestionDeleted = async (questionId) => {
    setQuestions((previous) => previous.filter((question) => question.id !== questionId))
    setCurrentIndex((previous) => Math.max(0, Math.min(previous, questions.length - 2)))
    await refreshAfterWrite()
  }

  // Keep the practice view on the renamed topic/subtopic and refresh counts.
  const handleRenamed = async ({ kind, topic, from, to }) => {
    if (kind === 'topic') {
      await loadTopics()
      if (selectedTopic !== from) {
        return
      }
      setSelectedTopic(to)
      setQuestions((list) => list.map((question) => ({ ...question, topic: to })))
      await loadSubtopics(to)
      return
    }

    if (selectedTopic !== topic) {
      return
    }
    await loadSubtopics(topic)
    if (selectedSubtopic === from) {
      setSelectedSubtopic(to)
      // A merge can bring in more questions, so reload the list.
      await loadQuestions({ topic, subtopic: to, offset: 0, append: false })
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
        onOpenStudio={() => navigate('/admin/notes')}
        isFocusMode={focusModeOpen}
        user={user}
        onLogin={() => {
          setAuthNotice('')
          setAuthOpen(true)
        }}
        onLogout={handleLogout}
      />

      {onAdminPage ? (
        user || !tokenStore.get() ? (
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            }
          >
            <AdminShell user={user} pathname={pathname} query={query} />
          </Suspense>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 p-6 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your session…
          </div>
        )
      ) : (
      <main className="mx-auto flex w-full max-w-7xl flex-1 min-h-0 flex-col gap-4 overflow-hidden px-4 pb-4 pt-3 lg:flex-row lg:gap-6 lg:px-6">
        <TopicSidebar
          className="hidden lg:block"
          allTopicsLabel={ALL_TOPICS}
          currentTopic={selectedTopic}
          currentSubtopic={selectedSubtopic}
          loading={topicsLoading}
          onSelectSubtopic={handleSelectSubtopic}
          onSelectTopic={handleSelectTopic}
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
                canManage={user?.role === 'admin'}
                currentIndex={currentIndex}
                currentQuestion={currentQuestion}
                currentSelection={currentAnswer}
                hasMore={hasMore}
                isLoading={questionsLoading}
                onDelete={(question) => setQuestionAction({ type: 'delete', question })}
                onEdit={(question) => setQuestionAction({ type: 'edit', question })}
                onNext={handleNext}
                onPrevious={handlePrevious}
                onSelectOption={handleSelectOption}
                onSubmitAnswer={handleSubmitAnswer}
                questionsCount={questions.length}
              />
            ) : (
              <div className="flex h-full min-h-0 items-center justify-center rounded-[2rem] border border-slate-700/60 bg-slate-950/70 p-6 text-center shadow-2xl shadow-cyan-950/10 backdrop-blur-xl sm:p-8">
                <div>
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan-300">
                    <BookOpen className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-semibold text-white">
                    {questionsLoading
                      ? 'Loading questions...'
                      : selectedTopic === ALL_TOPICS
                        ? 'Pick a topic to start practicing'
                        : selectedSubtopic
                          ? 'No questions in this subtopic yet'
                          : `Pick a subtopic in ${selectedTopic}`}
                  </h2>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-300">
                    Choose a topic to see its subtopics, then choose a subtopic to load its questions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      )}

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
                  canManage={user?.role === 'admin'}
                  currentIndex={currentIndex}
                  currentQuestion={currentQuestion}
                  currentSelection={currentAnswer}
                  hasMore={hasMore}
                  immersive
                  isLoading={questionsLoading}
                  onDelete={(question) => setQuestionAction({ type: 'delete', question })}
                  onEdit={(question) => setQuestionAction({ type: 'edit', question })}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                  onSelectOption={handleSelectOption}
                  onSubmitAnswer={handleSubmitAnswer}
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
                subtopics={subtopics}
                topics={topics}
              />
            </div>
          </aside>
        </div>
      ) : null}

      {authOpen ? (
        <AuthModal notice={authNotice} onClose={() => setAuthOpen(false)} onAuthenticated={handleAuthenticated} />
      ) : null}

      {questionAction && user?.role === 'admin' ? (
        <Suspense fallback={null}>
          <PracticeQuestionActions
            action={questionAction}
            onClose={() => setQuestionAction(null)}
            onSaved={handleQuestionSaved}
            onDeleted={handleQuestionDeleted}
          />
        </Suspense>
      ) : null}

      {adminOpen && user?.role === 'admin' ? (
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
                <p className="mt-2 text-sm text-slate-400">Manage questions and rename topics or subtopics.</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition hover:border-cyan-400 hover:text-cyan-200"
                onClick={() => setAdminOpen(false)}
              >
                Close
              </button>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-between rounded-3xl border border-slate-700 bg-slate-900/60 p-4 text-left transition hover:border-cyan-400"
              onClick={() => {
                setAdminOpen(false)
                navigate('/admin/questions')
              }}
            >
              <span>
                <span className="block text-lg font-semibold text-white">Manage questions</span>
                <span className="mt-1 block text-sm text-slate-400">Search, edit and delete questions. Edit and Delete are also on each practice card.</span>
              </span>
              <ChevronRight className="h-5 w-5 text-slate-400" />
            </button>

            <div className="mt-4">
              <RenameTaxonomyPanel onRenamed={handleRenamed} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default App
