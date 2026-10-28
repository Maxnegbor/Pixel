-- Coffee and tea occupy one exclusive foreground drink surface.
alter table pixel_private.catalog drop constraint catalog_slot_check;
alter table pixel_private.catalog add constraint catalog_slot_check check(slot in ('pet','plant','lamp','rug','wall','desk','drink'));
insert into pixel_private.catalog(id,name,kind,slot,rarity,price,value,color,sprite)
 values('coffee','Cabin coffee','cosmetic','drink','Common',40,10,'#d7c59b','coffee') on conflict(id) do nothing;
update pixel_private.catalog set slot='drink' where id='mug';
-- Existing players keep an equipped tea set; everyone receives one coffee copy.
insert into pixel_private.inventory(user_id,item_id,quantity,equipped)
 select p.id,'coffee',1,not exists(select 1 from pixel_private.inventory i join pixel_private.catalog c on c.id=i.item_id where i.user_id=p.id and c.slot='drink' and i.equipped)
 from pixel_private.profiles p on conflict(user_id,item_id) do nothing;
-- New profiles receive the same starter once. Trigger runs with the invoking
-- guarded dispatcher; no new privileged or publicly callable endpoint is added.
create function pixel_private.starter_drink() returns trigger
 language plpgsql security invoker set search_path='' as $$
 begin
   insert into pixel_private.inventory(user_id,item_id,quantity,equipped) values(new.id,'coffee',1,true);
   return new;
 end;
 $$;
revoke all on function pixel_private.starter_drink() from public,anon,authenticated;
create trigger starter_drink after insert on pixel_private.profiles for each row execute function pixel_private.starter_drink();
