insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('beneficiary-photos','beneficiary-photos',false,8388608,array['image/jpeg','image/png','image/webp']),
('application-documents','application-documents',false,15728640,array['application/pdf','image/jpeg','image/png']),
('card-templates','card-templates',false,15728640,array['image/jpeg','image/png','application/pdf']),
('issued-cards','issued-cards',false,20971520,array['application/pdf']) on conflict(id) do update set public=false;
create policy photos_unit_read on storage.objects for select to authenticated using(bucket_id='beneficiary-photos' and exists(select 1 from public.beneficiaries b where b.photo_path=name and b.unit_id=public.my_unit_id()));
create policy photos_operator_insert on storage.objects for insert to authenticated with check(bucket_id='beneficiary-photos' and (public.has_role('operator') or public.has_role('administrator')));
create policy docs_authorized_read on storage.objects for select to authenticated using(bucket_id='application-documents' and not public.has_role('support'));
create policy docs_authorized_insert on storage.objects for insert to authenticated with check(bucket_id='application-documents' and (public.has_role('operator') or public.has_role('administrator')));
create policy templates_admin on storage.objects for all to authenticated using(bucket_id='card-templates' and public.has_role('administrator')) with check(bucket_id='card-templates' and public.has_role('administrator'));
create policy issued_cards_read on storage.objects for select to authenticated using(bucket_id='issued-cards' and (public.has_role('issuer') or public.has_role('administrator') or public.has_role('auditor')));
