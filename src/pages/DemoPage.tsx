import { Card, PageHeader } from '../components/ui';
import { CardBack, CardFront } from '../features/cards/CardViews';

const beneficiary = {
  id: 'demo',
  full_name: 'Pessoa de Demonstração',
  birth_date: '2014-06-15',
  sex: 'Feminino',
  sus_number: '000 0000 0000 0000',
  city: "Machadinho d'Oeste",
  state: 'RO',
  cid: 'F84.0',
  support_level: '2',
  created_at: '2026-07-21',
  updated_at: '2026-07-21',
};

const caregiver = {
  full_name: 'Responsável de Demonstração',
  phone: '(69) 90000-0000',
  relationship: 'Responsável legal',
};

const emergency = {
  blood_type: 'O+',
  allergies: 'Não informado',
  other_information: 'Dados exclusivamente fictícios',
};

export function DemoPage() {
  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Demonstração visual da CIPTEA"
          description="Todos os dados apresentados nesta página são fictícios."
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <Card><CardFront beneficiary={beneficiary} cardNumber="CIPTEA-MDO-2026-000001" issuedAt="2026-07-21" /></Card>
          <Card><CardBack beneficiary={beneficiary} caregiver={caregiver} emergency={emergency} issuedAt="2026-07-21" verificationUrl="https://exemplo.invalid/#/verificar/token-ficticio" /></Card>
        </div>
      </div>
    </main>
  );
}
