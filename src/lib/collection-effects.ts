import type { RewardSounds } from './reward-effects';
/** One arrival acknowledgement shared by chest reveals and shop deliveries. */
export function collectionArrival(sounds:RewardSounds,reduced=false){
  sounds.arrive('xp',2);sounds.arrive('box',1);
  const target=document.querySelector('[data-collection-target]')?.closest('button');
  if(!target)return;
  target.animate(reduced
    ? [{filter:'brightness(1.6)'},{filter:'brightness(1)'}]
    : [{filter:'brightness(2)',transform:'translateY(-4px) scale(1.1)',boxShadow:'0 0 20px #e6c681aa'},{filter:'brightness(1)',transform:'none',boxShadow:'none'}],
    {duration:reduced?150:450,easing:'ease-out'});
}
export type DeliveryOrigin={x:number;y:number};
