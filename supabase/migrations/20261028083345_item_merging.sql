-- Five same-tier spare copies become one random item from the next tier.
-- Equipped copies are reserved; Legendary rerolls stay Legendary. No currency/XP grant.
create function pixel_private.merge_items(player uuid,payload jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 rows jsonb:=payload->'items'; entry jsonb; selected text[]:=array[]::text[];
 selected_id text; qty integer; copies integer:=0; source_tier text; target_tier text;
 it pixel_private.catalog%rowtype; inv pixel_private.inventory%rowtype;
 pool integer; roll double precision; won text;
begin
 if player is null or player is distinct from auth.uid() then raise exception 'Authentication required'; end if;
 if jsonb_typeof(rows) is distinct from 'array' then raise exception 'Select exactly five copies from one rarity'; end if;
 if jsonb_array_length(rows)<1 or jsonb_array_length(rows)>5 then raise exception 'Select exactly five copies from one rarity'; end if;
 for entry in select value from jsonb_array_elements(rows) loop
   if jsonb_typeof(entry) is distinct from 'object' or jsonb_typeof(entry->'item_id') is distinct from 'string' or jsonb_typeof(entry->'quantity') is distinct from 'number' or (entry->>'quantity') !~ '^[1-5]$' then raise exception 'Invalid merge selection'; end if;
   selected_id:=entry->>'item_id';qty:=(entry->>'quantity')::integer;
   if selected_id=any(selected) then raise exception 'Duplicate merge rows'; end if;
   selected:=array_append(selected,selected_id);copies:=copies+qty;
   select * into it from pixel_private.catalog c where c.id=selected_id;
   if not found then raise exception 'Unknown item'; end if;
   select * into inv from pixel_private.inventory i where i.user_id=player and i.item_id=selected_id for update;
   if not found or inv.quantity-(case when inv.equipped then 1 else 0 end)<qty then raise exception 'Not enough spare copies; unequip your last copy first'; end if;
   if source_tier is not null and source_tier<>it.rarity then raise exception 'All five items must have the same rarity'; end if;
   source_tier:=it.rarity;
 end loop;
 if copies<>5 then raise exception 'Select exactly five copies from one rarity'; end if;
 target_tier:=case source_tier when 'Common' then 'Uncommon' when 'Uncommon' then 'Rare' when 'Rare' then 'Epic' else 'Legendary' end;
 select count(*) into pool from pixel_private.catalog c where c.rarity=target_tier;
 if pool=0 then raise exception 'This merge tier is not configured'; end if;
 roll:=('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint/4294967296.0;
 select c.id into won from pixel_private.catalog c where c.rarity=target_tier order by c.id offset floor(roll*pool)::integer limit 1;
 for entry in select value from jsonb_array_elements(rows) loop
   update pixel_private.inventory set quantity=quantity-(entry->>'quantity')::integer where user_id=player and item_id=entry->>'item_id';
 end loop;
 insert into pixel_private.inventory(user_id,item_id) values(player,won) on conflict(user_id,item_id) do update set quantity=pixel_private.inventory.quantity+1;
 return jsonb_build_object('item_id',won);
end;
$$;
revoke all on function pixel_private.merge_items(uuid,jsonb) from public,anon,authenticated;
create or replace function pixel_private.dispatch(action text, payload jsonb, request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 p pixel_private.profiles%rowtype; s pixel_private.sessions%rowtype; cfg pixel_private.config%rowtype;
 it pixel_private.catalog%rowtype; inv pixel_private.inventory%rowtype; rec pixel_private.receipts%rowtype;
 n timestamptz := clock_timestamp(); total numeric; delta integer; dur integer; new_profile boolean := false;
 won text; tier text; roll double precision; pool integer; bonus jsonb; result jsonb := '{}'; uname text; grant_row pixel_private.rewards%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if request_id is null or action is null or payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid request'; end if;
 if action not in ('merge','claim','sync','start','pause','resume','end','open','buy','sell','equip','unequip','username') then raise exception 'Unknown action'; end if;
 insert into pixel_private.profiles(id,username) values(uid,'Wanderer') on conflict do nothing;
 new_profile := found;
 -- This lock serializes every action across all tabs/devices for this player.
 select * into strict p from pixel_private.profiles where id=uid for update;
 n := clock_timestamp();
 if new_profile then
   select raw_user_meta_data->>'username' into uname from auth.users where id=uid;
   if uname ~ '^[a-zA-Z0-9_ -]{3,24}$' then update pixel_private.profiles set username=uname where id=uid; end if;
   insert into pixel_private.inventory(user_id,item_id,equipped) values(uid,'miso',true),(uid,'fern',true);
 end if;
 select * into strict cfg from pixel_private.config where id=true;
 select * into s from pixel_private.sessions where user_id=uid and status in ('running','paused') for update;
 if s.status='running' then
   total := least(s.duration,s.elapsed+greatest(0,extract(epoch from n-s.running_since)));
   delta := case when s.kind='focus' and total>=s.duration then floor(total/60)::integer-s.credited_minutes else 0 end;
   if delta>0 then
     insert into pixel_private.rewards(session_id,user_id,minutes,xp,coins,boxes)
     values(s.id,uid,delta,delta*cfg.xp_per_minute,delta*cfg.coins_per_minute,
       ((p.focus_minutes+delta)/cfg.box_minutes)-(p.focus_minutes/cfg.box_minutes));
     update pixel_private.profiles set focus_minutes=focus_minutes+delta where id=uid;
   end if;
   update pixel_private.sessions set elapsed=total, running_since=case when total>=duration then null else n end,
     status=case when total>=duration then 'completed' else status end,
     credited_minutes=credited_minutes+delta,
     finished_at=case when total>=duration then n else null end where id=s.id returning * into s;
 end if;
 select * into rec from pixel_private.receipts r where r.user_id=uid and r.request_id=dispatch.request_id;
 if found then
   if rec.action<>dispatch.action or rec.payload<>dispatch.payload then raise exception 'Idempotency key reused for different request'; end if;
   result:=rec.result;
 else
   if action='start' then
     if s.status in ('running','paused') then raise exception 'Finish or end your current session first'; end if;
     if payload->>'kind'='focus' and exists(select 1 from pixel_private.rewards where user_id=uid and claimed_at is null) then
       raise exception 'Collect your completed session rewards first'; end if;
     dur := (payload->>'duration')::integer;
     if dur is null or dur<60 or dur>14400 or payload->>'kind' not in ('focus','break') or payload->>'kind' is null then raise exception 'Choose a valid 1–240 minute session'; end if;
     insert into pixel_private.sessions(user_id,kind,duration,running_since) values(uid,payload->>'kind',dur,n);
   elsif action='pause' and s.status='running' then
     update pixel_private.sessions set status='paused',running_since=null where id=s.id;
   elsif action='resume' and s.status='paused' then
     update pixel_private.sessions set status='running',running_since=n where id=s.id;
   elsif action='end' and s.status in ('running','paused') then
     update pixel_private.sessions set status='ended',running_since=null,finished_at=n where id=s.id;
   elsif action='claim' then
     if s.kind='focus' and s.status in ('running','paused') then raise exception 'Finish your focus session first'; end if;
     select * into grant_row from pixel_private.rewards where session_id=(payload->>'session_id')::uuid and user_id=uid for update;
     if not found then raise exception 'No completed reward belongs to this session'; end if;
     if grant_row.claimed_at is null then
       update pixel_private.profiles set xp=xp+grant_row.xp,coins=coins+grant_row.coins,boxes=boxes+grant_row.boxes where id=uid;
       update pixel_private.rewards set claimed_at=n where session_id=grant_row.session_id;
     end if;
     result:=jsonb_build_object('reward',to_jsonb(grant_row)-'user_id'-'claimed_at','already_claimed',grant_row.claimed_at is not null);
   elsif action='username' then
     uname:=trim(payload->>'username');
     if uname is null or uname !~ '^[a-zA-Z0-9_ -]{3,24}$' then raise exception 'Use 3–24 letters, numbers, spaces, or underscores'; end if;
     update pixel_private.profiles set username=uname where id=uid;
   elsif action='merge' then
     if s.kind='focus' and s.status in ('running','paused') then raise exception 'Merge items after your focus session'; end if;
     result:=pixel_private.merge_items(uid,payload);
   elsif action='open' then
     if s.kind='focus' and s.status in ('running','paused') then raise exception 'Your box can wait until after your focus session'; end if;
     update pixel_private.profiles set boxes=boxes-1 where id=uid and boxes>0;
     if not found then raise exception 'Study for 10 minutes to earn a box'; end if;
     -- gen_random_uuid uses PostgreSQL cryptographically strong randomness.
     -- First 32 random bits give a uniform fraction in [0,1); version bits are later.
     roll := ('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint / 4294967296.0 * 100;
     tier:=case when roll<60 then 'Common' when roll<85 then 'Uncommon' when roll<95 then 'Rare' when roll<99 then 'Epic' else 'Legendary' end;
     select count(*) into pool from pixel_private.catalog where rarity=tier;
     if pool=0 then raise exception 'This box tier is not configured'; end if;
     roll := ('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint / 4294967296.0;
     select id into won from pixel_private.catalog where rarity=tier order by id offset floor(roll*pool)::integer limit 1;
     insert into pixel_private.inventory(user_id,item_id) values(uid,won) on conflict(user_id,item_id) do update set quantity=pixel_private.inventory.quantity+1;
     bonus:=pixel_private.chest_bonus(tier);
     update pixel_private.profiles set coins=coins+(bonus->>'coins')::integer,xp=xp+(bonus->>'xp')::integer where id=uid;
     result:=jsonb_build_object('item_id',won,'chest_bonus',bonus);
   elsif action in ('buy','sell','equip','unequip') then
     select * into it from pixel_private.catalog where id=payload->>'item_id';
     if not found then raise exception 'Unknown item'; end if;
     select * into inv from pixel_private.inventory where user_id=uid and item_id=it.id;
     if action='buy' then
       if it.kind<>'cosmetic' then raise exception 'Companions are found in boxes'; end if;
       update pixel_private.profiles set coins=coins-it.price where id=uid and coins>=it.price;
       if not found then raise exception 'Not enough coins'; end if;
       insert into pixel_private.inventory(user_id,item_id) values(uid,it.id) on conflict(user_id,item_id) do update set quantity=pixel_private.inventory.quantity+1;
     else
       if inv.quantity is null or inv.quantity<1 then raise exception 'You do not own this item'; end if;
       if action='sell' then
         if inv.equipped and inv.quantity=1 then raise exception 'Unequip your last copy before selling'; end if;
         update pixel_private.inventory set quantity=quantity-1 where user_id=uid and item_id=it.id;
         update pixel_private.profiles set coins=coins+it.value where id=uid;
       elsif action='equip' then
         update pixel_private.inventory i set equipped=false from pixel_private.catalog c where i.item_id=c.id and c.slot=it.slot and i.user_id=uid;
         update pixel_private.inventory set equipped=true where user_id=uid and item_id=it.id;
       else
         update pixel_private.inventory set equipped=false where user_id=uid and item_id=it.id;
       end if;
     end if;
   end if;
   -- Sync is naturally idempotent and does not need an ever-growing receipt.
   if action<>'sync' then insert into pixel_private.receipts(user_id,request_id,action,payload,result) values(uid,request_id,action,payload,result); end if;
 end if;
 return jsonb_build_object(
   'profile',(select to_jsonb(pr)-'id' from pixel_private.profiles pr where id=uid),
   'sessions',coalesce((select jsonb_agg(to_jsonb(ss)-'user_id' order by ss.started_at desc) from pixel_private.sessions ss where user_id=uid),'[]'::jsonb),
   'inventory',coalesce((select jsonb_agg(to_jsonb(ii)-'user_id') from pixel_private.inventory ii where user_id=uid and quantity>0),'[]'::jsonb),
   'pending_rewards',coalesce((select jsonb_agg(to_jsonb(rr)-'user_id'-'claimed_at' order by rr.session_id) from pixel_private.rewards rr where rr.user_id=uid and claimed_at is null),'[]'::jsonb),
   'catalog',(select jsonb_agg(to_jsonb(cc) order by cc.id) from pixel_private.catalog cc),
   'config',to_jsonb(cfg)-'id','server_now',clock_timestamp(),'result',result
 );
end;
$$;
revoke all on function pixel_private.dispatch(text,jsonb,uuid) from public,anon,authenticated;
grant execute on function pixel_private.dispatch(text,jsonb,uuid) to authenticated;
