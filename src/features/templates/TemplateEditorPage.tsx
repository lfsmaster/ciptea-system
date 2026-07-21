import { PageHeader } from '../../components/ui';
import { TemplateEditor } from './TemplateEditor';

export function TemplateEditorPage() {
  return (
    <>
      <PageHeader
        title="Modelos de carteirinha"
        description="Envie o arquivo original, defina os campos preenchíveis e posicione cada informação sobre a arte."
      />
      <TemplateEditor />
    </>
  );
}
