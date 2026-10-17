import { ChevronRight, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import ExplanationBox from './ExplanationBox'
import OptionButton from './OptionButton'

const manageButtonClass =
  'rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 transition hover:text-white'

function QuestionCard({
  canManage = false,
  currentIndex,
  currentQuestion,
  currentSelection,
  hasMore,
  isLoading,
  immersive = false,
  onDelete,
  onEdit,
  onNext,
  onPrevious,
  onSelectOption,
  onSubmitAnswer,
  questionsCount,
}) {
  const isAnswered = Boolean(currentSelection?.submitted)
  const selected = currentSelection?.selected ?? []
  const isMultiSelect = (currentQuestion.correct_option_indices?.length ?? 0) > 1

  return (
    <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-700/80 bg-slate-950/75 shadow-2xl shadow-cyan-950/10 backdrop-blur-xl">
      <div className={`border-b border-slate-800 px-5 py-4 sm:px-6 ${immersive ? 'border-b-0 pb-2' : ''}`}>
        <div className="flex items-start gap-3">
          <h1 className={`min-w-0 flex-1 text-2xl font-semibold leading-tight text-white sm:text-3xl ${immersive ? 'sm:text-4xl' : 'mt-4'}`}>
            {currentQuestion.question_text}
          </h1>
          {canManage ? (
            <div className={`flex shrink-0 gap-2 ${immersive ? '' : 'mt-4'}`}>
              <button
                type="button"
                className={`${manageButtonClass} hover:border-cyan-400`}
                title="Edit question"
                aria-label="Edit question"
                onClick={() => onEdit(currentQuestion)}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`${manageButtonClass} hover:border-rose-400 hover:text-rose-200`}
                title="Delete question"
                aria-label="Delete question"
                onClick={() => onDelete(currentQuestion)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
        {isMultiSelect ? (
          <p className="text-xs uppercase tracking-[0.2em] text-amber-300">
            Select all that apply ({currentQuestion.correct_option_indices.length} correct)
          </p>
        ) : null}

        {currentQuestion.options?.map((option, position) => (
          <OptionButton
            key={option.index}
            correctOptionIndices={currentQuestion.correct_option_indices}
            disabled={isAnswered}
            isAnswered={isAnswered}
            isSelected={selected.includes(option.index)}
            label={String.fromCharCode(65 + position)}
            option={option}
            optionIndex={option.index}
            onClick={(optionIndex) => onSelectOption(currentQuestion, optionIndex)}
          />
        ))}

        {isMultiSelect && !isAnswered ? (
          <button
            type="button"
            className="rounded-2xl border border-cyan-400/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-400/20 disabled:opacity-50"
            disabled={!selected.length}
            onClick={() => onSubmitAnswer(currentQuestion)}
          >
            Submit answer
          </button>
        ) : null}

        <ExplanationBox explanation={currentQuestion.explanation} isVisible={isAnswered} />
      </div>

      <div className={`shrink-0 border-t border-slate-800 px-5 py-4 sm:px-6 ${immersive ? 'border-t-0 pt-2' : ''}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {immersive ? null : (
            <div className="flex items-center gap-3 text-sm text-slate-400">
              <span>
                Question {currentIndex + 1} of {questionsCount}
              </span>
              <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-slate-800 sm:block">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  style={{ width: `${Math.max((currentIndex + 1) / Math.max(questionsCount, 1), 0.05) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 transition hover:border-cyan-400 hover:text-cyan-200 disabled:opacity-50"
              disabled={currentIndex === 0 || isLoading}
              onClick={onPrevious}
            >
              Previous Question
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:from-cyan-400 hover:to-emerald-300 disabled:opacity-60"
              disabled={isLoading || (!hasMore && currentIndex === questionsCount - 1)}
              onClick={onNext}
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Next Question
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default QuestionCard