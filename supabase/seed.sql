-- Dados exclusivamente fictícios para desenvolvimento.
insert into public.administrative_units(name,code,city,state) values ('Unidade de Demonstração','MDO','Machadinho d''Oeste','RO') on conflict(code) do nothing;
-- Após criar o primeiro usuário no Auth, conceda o perfil administrador manualmente no SQL Editor:
-- update public.profiles set unit_id=(select id from public.administrative_units where code='MDO') where email='SEU_EMAIL';
-- insert into public.user_roles(user_id,role,unit_id) select id,'administrator',unit_id from public.profiles where email='SEU_EMAIL';
