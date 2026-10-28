export const CHEST_CENTER = { x: 650, y: 570 };
export const CHEST_FRAME_SIZE = 260;
export function chestDrop(elapsed:number) {
  const fall=Math.max(0,Math.min(1,(elapsed-420)/620));
  if(fall<1)return -760*(1-fall*fall);
  const landed=elapsed-1040;
  return -Math.abs(Math.sin(landed/70))*20*Math.exp(-landed/145);
}
export function lidFrame(elapsed:number) {
  return Math.min(5,Math.max(0,Math.floor((elapsed-280)/115)));
}
export function collectionPosition(progress:number,start:{x:number;y:number},end:{x:number;y:number}) {
  const p=Math.max(0,Math.min(1,progress)), pull=p**2.5;
  return {x:start.x+(end.x-start.x)*pull,y:start.y+(end.y-start.y)*pull-Math.sin(p*Math.PI)*p*48,size:110*(1-pull)+25*pull};
}
export function screenToWorld(x:number,y:number,width:number,height:number) {
  const scale=Math.max(width/1280,height/720)*1.04;
  return {x:(x-(width-1280*scale)/2)/scale,y:(y-(height-720*scale)/2)/scale};
}
// Outline of the original V8 open book, including its bookmark and contact shadow.
export function bookOutline() {
  return new Path2D('M439 599 L468 518 L490 474 Q571 448 640 456 Q672 454 690 464 Q742 449 795 455 L875 462 L932 581 L934 606 Q865 615 793 603 L712 597 L700 611 L677 611 L666 601 Q610 602 564 607 L497 608 L439 608 Z');
}

// Register the generated atlas on its feet so lid frames never make the body
// float. Ignore tiny neighboring-cell flecks when measuring the silhouette.
export function registerChestFrames(image:HTMLImageElement) {
  const cw=Math.floor(image.naturalWidth/3),ch=Math.floor(image.naturalHeight/2);
  const source=document.createElement('canvas');source.width=image.naturalWidth;source.height=image.naturalHeight;
  const sc=source.getContext('2d',{willReadFrequently:true})!;sc.drawImage(image,0,0);
  const output=document.createElement('canvas');output.width=cw*3;output.height=ch*2;
  const c=output.getContext('2d')!;c.imageSmoothingEnabled=false;
  for(let frame=0;frame<6;frame++){
    const ox=frame%3*cw,oy=Math.floor(frame/3)*ch,data=sc.getImageData(ox,oy,cw,ch).data;
    const seen=new Uint8Array(cw*ch),stack=new Int32Array(cw*ch);
    let largest=0,bounds={left:0,right:cw-1,top:0,bottom:ch-1};
    for(let seed=0;seed<cw*ch;seed++){
      if(seen[seed]||data[seed*4+3]<60)continue;
      let size=0,top=1,left=cw,right=0,upper=ch,lower=0;stack[0]=seed;seen[seed]=1;
      while(top){
        const index=stack[--top],x=index%cw,y=Math.floor(index/cw);size++;
        left=Math.min(left,x);right=Math.max(right,x);upper=Math.min(upper,y);lower=Math.max(lower,y);
        for(const next of [x>0?index-1:-1,x<cw-1?index+1:-1,y>0?index-cw:-1,y<ch-1?index+cw:-1]){
          if(next>=0&&!seen[next]&&data[next*4+3]>=60){seen[next]=1;stack[top++]=next;}
        }
      }
      if(size>largest){largest=size;bounds={left,right,top:upper,bottom:lower};}
    }
    const w=bounds.right-bounds.left+1,h=bounds.bottom-bounds.top+1;
    c.save();c.beginPath();c.rect(ox,oy,cw,ch);c.clip();
    c.drawImage(source,ox+bounds.left,oy+bounds.top,w,h,ox+(cw-w)/2,oy+ch*450/512-h,w,h);c.restore();
  }
  return output;
}
