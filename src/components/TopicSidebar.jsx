import { ChevronRight } from 'lucide-react'

function TopicSidebar({
  allTopicsLabel,
  currentTopic,
  currentSubtopic,
  className = '',
  loading,
  onSelectAllTopics,
  onSelectSubtopic,
  onSelectTopic,
  panelClassName = '',
  topicListClassName = '',
  subtopics,
  topics,
}) {
  const topicItemClass = (isActive) =>
    `flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
      isActive
        ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-50 shadow-[0_0_24px_rgba(8,145,178,0.12)]'
        : 'border-slate-700 bg-slate-900/60 text-slate-200 hover:border-slate-500 hover:bg-slate-900'
    }`

  return (
    <aside className={`w-full lg:w-[320px] lg:shrink-0 ${className}`}>
      <div className={`sticky top-24 space-y-4 rounded-[1.75rem] border border-slate-700/80 bg-slate-950/75 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl ${panelClassName}`}>
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Browse</p>
          <h2 className="mt-1 text-xl font-semibold text-white">Topics & subtopics</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Start in All Topics mode or narrow down to a topic and subtopic.
          </p>
        </div>

        <button type="button" className={topicItemClass(currentTopic === allTopicsLabel)} onClick={onSelectAllTopics}>
          <span>All Topics</span>
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className={`max-h-[28rem] space-y-2 overflow-y-auto pr-1 ${topicListClassName}`}>
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
              Loading topics...
            </div>
          ) : topics.length ? (
            topics.map((topic) => {
              const isActive = currentTopic === topic

              return (
                <button
                  key={topic}
                  type="button"
                  className={topicItemClass(isActive)}
                  onClick={() => onSelectTopic(topic)}
                >
                  <span className="truncate">{topic}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              )
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-4 py-6 text-sm text-slate-400">
              Topics will appear here once the API responds.
            </div>
          )}
        </div>

        {currentTopic !== allTopicsLabel ? (
          <section className="rounded-[1.5rem] border border-slate-700 bg-slate-900/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Subtopics</p>
                <h3 className="mt-1 text-base font-semibold text-white">{currentTopic}</h3>
              </div>
              {currentSubtopic ? (
                <button
                  type="button"
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300 transition hover:border-cyan-400 hover:text-cyan-200"
                  onClick={() => onSelectSubtopic('')}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`rounded-full border px-3 py-2 text-xs transition ${
                  currentSubtopic
                    ? 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-cyan-400 hover:text-cyan-200'
                    : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                }`}
                onClick={() => onSelectSubtopic('')}
              >
                All subtopics
              </button>
              {subtopics.length ? (
                subtopics.map((subtopic) => {
                  const isActive = currentSubtopic === subtopic
                  return (
                    <button
                      key={subtopic}
                      type="button"
                      className={`rounded-full border px-3 py-2 text-xs transition ${
                        isActive
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                          : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-emerald-300 hover:text-emerald-100'
                      }`}
                      onClick={() => onSelectSubtopic(subtopic)}
                    >
                      {subtopic}
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-slate-500">Subtopics will populate after the topic data loads.</p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  )
}

export default TopicSidebar