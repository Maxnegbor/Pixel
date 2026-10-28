-- Desk collectibles are normal server-validated catalog items. No dev grant exists in SQL.
alter table pixel_private.catalog drop constraint catalog_slot_check;
alter table pixel_private.catalog add constraint catalog_slot_check check(slot in ('pet','plant','lamp','rug','wall','desk','drink','desk_lamp','books','desk_plant','desk_runner','journal','stationery','study_book'));
insert into pixel_private.catalog(id,name,kind,slot,rarity,price,value,color,sprite) values
('brasslight','Brass study lamp','cosmetic','desk_lamp','Common',40,10.0,'#d9a456','brasslight'),
('greenlight','Pine enamel lamp','cosmetic','desk_lamp','Uncommon',100,25.0,'#759375','greenlight'),
('oldbooks','Gilded cabin books','cosmetic','books','Common',40,10.0,'#ac7955','oldbooks'),
('naturebooks','Naturalist’s library','cosmetic','books','Uncommon',100,25.0,'#8b9e72','naturebooks'),
('desk_pothos','Golden desk pothos','cosmetic','desk_plant','Common',40,10.0,'#a4ac59','desk_pothos'),
('desk_fern','Terracotta desk fern','cosmetic','desk_plant','Uncommon',100,25.0,'#72935b','desk_fern'),
('cabinrunner','Heritage desk runner','cosmetic','desk_runner','Common',40,10.0,'#ac785b','cabinrunner'),
('mossrunner','Moss woven runner','cosmetic','desk_runner','Uncommon',100,25.0,'#87936a','mossrunner'),
('maplejournal','Maple journal & pen','cosmetic','journal','Common',40,10.0,'#c4904d','maplejournal'),
('nightjournal','Stargazer journal & pen','cosmetic','journal','Rare',250,62.5,'#7c8ba9','nightjournal'),
('coppertools','Copper writing set','cosmetic','stationery','Common',40,10.0,'#b98956','coppertools'),
('greentools','Sage writing set','cosmetic','stationery','Uncommon',100,25.0,'#8e9b7b','greentools'),
('fieldguide','Open forest field guide','cosmetic','study_book','Common',40,10.0,'#ceb88c','fieldguide'),
('skyguide','Open night-sky atlas','cosmetic','study_book','Rare',250,62.5,'#8794b6','skyguide')
on conflict(id) do nothing;
-- Preserve the furnished starter cabin, while alternate styles must be earned.
insert into pixel_private.inventory(user_id,item_id,quantity,equipped)
 select p.id,c.id,1,not exists(select 1 from pixel_private.inventory i join pixel_private.catalog other on other.id=i.item_id where i.user_id=p.id and other.slot=c.slot and i.equipped)
 from pixel_private.profiles p cross join pixel_private.catalog c where c.id in ('brasslight','oldbooks','desk_pothos','cabinrunner','maplejournal','coppertools','fieldguide')
 on conflict(user_id,item_id) do nothing;
create function pixel_private.starter_desk() returns trigger language plpgsql security invoker set search_path='' as $$
 begin
 insert into pixel_private.inventory(user_id,item_id,quantity,equipped)
 select new.id,c.id,1,true from pixel_private.catalog c where c.id in ('brasslight','oldbooks','desk_pothos','cabinrunner','maplejournal','coppertools','fieldguide');
 return new;
 end;
$$;
revoke all on function pixel_private.starter_desk() from public,anon,authenticated;
create trigger starter_desk after insert on pixel_private.profiles for each row execute function pixel_private.starter_desk();
