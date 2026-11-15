begin;
alter table public.resource_feedback alter column body drop not null;
alter table public.resource_feedback drop constraint if exists resource_feedback_body_check;
alter table public.resource_feedback add constraint resource_feedback_body_check
 check(body is null or char_length(body) between 8 and 1200);
create index if not exists resource_feedback_approved_comments on public.resource_feedback(resource_id,created_at desc)
 where status='approved' and body is not null;
commit;