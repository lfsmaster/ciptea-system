export const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—';
export const maskCardNumber = (value?: string | null) => value ? `${value.slice(0, 9)}••••${value.slice(-4)}` : '—';
export const statusLabel: Record<string, string> = {
  draft: 'Rascunho', incomplete: 'Incompleto', awaiting_documents: 'Aguardando documentos', under_review: 'Em análise', pending: 'Com pendência', approved: 'Aprovado', rejected: 'Reprovado', awaiting_issuance: 'Aguardando emissão', issued: 'Emitido', printed: 'Impresso', delivered: 'Entregue', expired: 'Vencido', suspended: 'Suspenso', cancelled: 'Cancelado', replaced: 'Substituído', reissued: 'Reemitido'
};
