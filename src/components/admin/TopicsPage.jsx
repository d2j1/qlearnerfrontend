import RenameTaxonomyPanel from './RenameTaxonomyPanel'
import { PageHeader } from './ui'

function TopicsPage() {
  return (
    <>
      <PageHeader eyebrow="Admin" title="Topics" subtitle="Rename or merge topics and subtopics across questions, drafts and notes." />
      <RenameTaxonomyPanel />
    </>
  )
}

export default TopicsPage
