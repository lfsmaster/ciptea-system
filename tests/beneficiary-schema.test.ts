import { describe,expect,it } from 'vitest';import { beneficiarySchema } from '../src/validation/beneficiary';
const valid={full_name:'Pessoa de Teste',birth_date:'2015-01-01',sex:'Não informado',sus_number:'123456789012345',city:'Município Teste',state:'RO',cid:'F84.0',support_level:'2',email:''};
describe('beneficiarySchema',()=>{it('aceita um cadastro fictício válido',()=>expect(beneficiarySchema.safeParse(valid).success).toBe(true));it('rejeita SUS incompleto',()=>expect(beneficiarySchema.safeParse({...valid,sus_number:'123'}).success).toBe(false));});
