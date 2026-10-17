import { deleteQuestion } from '../../api/client'
import { QuestionEditForm } from './QuestionEditForm'
import { ConfirmDialog, Modal } from './ui'

// Edit / delete dialogs opened from the practice QuestionCard. Lazy-loaded so
// learners never download the admin editor.
function PracticeQuestionActions({ action, onClose, onSaved, onDeleted }) {
  const { type, question } = action

  if (type === 'edit') {
    return (
      <Modal title="Edit question" wide onClose={onClose}>
        <QuestionEditForm
          question={question}
          onCancel={onClose}
          onSaved={(updated) => {
            onSaved(question, updated)
            onClose()
          }}
        />
      </Modal>
    )
  }

  return (
    <ConfirmDialog
      title="Delete question?"
      body="This can't be undone. The question will disappear from practice for everyone."
      onCancel={onClose}
      onConfirm={async () => {
        await deleteQuestion(question.id)
        onDeleted(question.id)
        onClose()
      }}
    />
  )
}

export default PracticeQuestionActions
