import { QRCodeSVG } from 'qrcode.react';
import type { Beneficiary, Caregiver, EmergencyInformation } from '../../types/domain';
import { formatDate } from '../../lib/format';
import { TemplateRenderer } from '../templates/TemplateRenderer';
import { useActiveTemplate } from '../templates/useActiveTemplate';

interface Parentage { full_name?: string | null }

type Props = {
  beneficiary: Beneficiary;
  caregiver?: Caregiver;
  emergency?: EmergencyInformation;
  parentages?: Parentage[];
  cardNumber?: string;
  issuedAt?: string;
  verificationUrl?: string;
  photoUrl?: string;
};

function valuesFromProps(props: Props) {
  const beneficiary = props.beneficiary;
  return {
    'beneficiary.full_name': beneficiary.full_name,
    'beneficiary.birth_date': formatDate(beneficiary.birth_date),
    'beneficiary.sex': beneficiary.sex?.slice(0, 1),
    'parentage.0.full_name': props.parentages?.[0]?.full_name || '—',
    'parentage.1.full_name': props.parentages?.[1]?.full_name || '—',
    'card.number': props.cardNumber || 'PRÉVIA',
    'beneficiary.sus_number': beneficiary.sus_number,
    'card.issued_at': formatDate(props.issuedAt),
    'beneficiary.cid': beneficiary.cid,
    'beneficiary.support_level': beneficiary.support_level ? `NÍVEL ${beneficiary.support_level}` : '—',
    'caregiver.full_name': props.caregiver?.full_name || '—',
    'caregiver.phone': props.caregiver?.phone || '—',
    'caregiver.relationship': props.caregiver?.relationship || '—',
    'emergency.blood_type': props.emergency?.blood_type || '—',
    'emergency.allergies': props.emergency?.allergies || 'NÃO INFORMADO',
    'emergency.other_information': props.emergency?.other_information || '—',
  };
}

const legacyText = 'absolute overflow-hidden whitespace-nowrap font-bold uppercase text-[#07347a]';

function LegacyFront(props: Props) {
  const beneficiary = props.beneficiary;
  return (
    <div className="relative aspect-[954/1476] w-full overflow-hidden bg-white">
      <img className="absolute inset-0 h-full w-full" src="assets/templates/ciptea-front.png" alt="Modelo da frente CIPTEA" />
      <div className={`${legacyText} left-[18%] top-[67.2%] w-[78%] text-[1.55cqw]`}>{beneficiary.full_name}</div>
      <div className={`${legacyText} left-[44%] top-[70.2%] w-[25%] text-[1.45cqw]`}>{formatDate(beneficiary.birth_date)}</div>
      <div className={`${legacyText} left-[82%] top-[70.2%] w-[14%] text-[1.45cqw]`}>{beneficiary.sex?.slice(0, 1)}</div>
      <div className={`${legacyText} left-[7%] top-[75.7%] w-[89%] text-[1.4cqw]`}>{props.parentages?.[0]?.full_name || '—'}</div>
      <div className={`${legacyText} left-[7%] top-[79.2%] w-[89%] text-[1.4cqw]`}>{props.parentages?.[1]?.full_name || '—'}</div>
      <div className={`${legacyText} left-[28%] top-[83.4%] w-[26%] text-[1.4cqw]`}>{props.cardNumber || 'PRÉVIA'}</div>
      <div className={`${legacyText} left-[69%] top-[83.4%] w-[27%] text-[1.4cqw]`}>{beneficiary.sus_number}</div>
      <div className={`${legacyText} left-[31%] top-[87.1%] w-[22%] text-[1.4cqw]`}>{formatDate(props.issuedAt)}</div>
      <div className={`${legacyText} left-[66%] top-[87.1%] w-[30%] text-[1.4cqw]`}>{beneficiary.cid}</div>
      <div className={`${legacyText} left-[40%] top-[90.9%] w-[56%] text-[1.4cqw]`}>NÍVEL {beneficiary.support_level}</div>
      {props.photoUrl && <img src={props.photoUrl} alt="Foto 3x4" className="absolute left-[34%] top-[27.7%] h-[28.8%] w-[31.5%] rounded-[2%] object-cover" />}
    </div>
  );
}

function LegacyBack(props: Props) {
  const caregiver = props.caregiver;
  const emergency = props.emergency;
  return (
    <div className="relative aspect-[950/1476] w-full overflow-hidden bg-white">
      <img className="absolute inset-0 h-full w-full" src="assets/templates/ciptea-back.png" alt="Modelo do verso CIPTEA" />
      <div className={`${legacyText} left-[18%] top-[22.4%] w-[75%] text-[1.5cqw]`}>{caregiver?.full_name || '—'}</div>
      <div className={`${legacyText} left-[22%] top-[26.9%] w-[71%] text-[1.5cqw]`}>{caregiver?.phone || '—'}</div>
      <div className={`${legacyText} left-[25%] top-[31.1%] w-[68%] text-[1.5cqw]`}>{caregiver?.relationship || '—'}</div>
      <div className={`${legacyText} left-[27%] top-[42%] w-[66%] text-[1.4cqw]`}>{emergency?.blood_type || '—'}</div>
      <div className={`${legacyText} left-[39%] top-[46.2%] w-[54%] text-[1.25cqw]`}>{emergency?.allergies || 'NÃO INFORMADO'}</div>
      <div className={`${legacyText} left-[36%] top-[50.4%] w-[57%] text-[1.25cqw]`}>{emergency?.other_information || '—'}</div>
      <div className={`${legacyText} left-[64%] top-[60.2%] w-[21%] text-[1.35cqw]`}>{formatDate(props.issuedAt)}</div>
      {props.verificationUrl && <div className="absolute left-[54.2%] top-[68.3%] grid h-[21.7%] w-[38.8%] place-items-center bg-white p-[3%]"><QRCodeSVG value={props.verificationUrl} className="h-full w-full" level="H" /></div>}
    </div>
  );
}

export function CardFront(props: Props) {
  const { template } = useActiveTemplate();
  if (template?.front) {
    return (
      <TemplateRenderer
        template={template}
        side="front"
        values={valuesFromProps(props)}
        photoUrl={props.photoUrl}
        verificationUrl={props.verificationUrl}
      />
    );
  }
  return <LegacyFront {...props} />;
}

export function CardBack(props: Props) {
  const { template } = useActiveTemplate();
  if (template?.back) {
    return (
      <TemplateRenderer
        template={template}
        side="back"
        values={valuesFromProps(props)}
        photoUrl={props.photoUrl}
        verificationUrl={props.verificationUrl}
      />
    );
  }
  return <LegacyBack {...props} />;
}
