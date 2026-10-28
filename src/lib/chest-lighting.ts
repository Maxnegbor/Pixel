import { CHEST_CENTER, CHEST_FRAME_SIZE } from './chest-motion';
/** Derived from registered sprite alpha; light and shadows never spill beyond the chest. */
export class ChestLighting {
  private shadow:HTMLCanvasElement;
  private reflected:HTMLCanvasElement;
  constructor(private atlas:HTMLCanvasElement){
    const make=()=>{const canvas=document.createElement('canvas');canvas.width=atlas.width;canvas.height=atlas.height;return canvas;};
    this.shadow=make();this.reflected=make();
    const sc=this.shadow.getContext('2d')!;
    sc.drawImage(atlas,0,0);sc.globalCompositeOperation='source-in';sc.fillStyle='#1e100c';sc.fillRect(0,0,atlas.width,atlas.height);
    const rc=this.reflected.getContext('2d')!,cw=atlas.width/3,ch=atlas.height/2;
    for(let i=0;i<6;i++){
      const x=i%3*cw,y=Math.floor(i/3)*ch;
      const gradient=rc.createLinearGradient(x+cw*.46,0,x+cw*.94,0);
      gradient.addColorStop(0,'#ff983000');gradient.addColorStop(.45,'#ff98302b');gradient.addColorStop(1,'#ffae56dd');
      rc.fillStyle=gradient;rc.fillRect(x,y,cw,ch);
    }
    rc.globalCompositeOperation='destination-in';rc.drawImage(atlas,0,0);
  }
  private frame(c:CanvasRenderingContext2D,image:HTMLCanvasElement,index:number,x:number,y:number){
    const cw=this.atlas.width/3,ch=this.atlas.height/2;
    c.drawImage(image,index%3*cw,Math.floor(index/3)*ch,cw,ch,x,y,CHEST_FRAME_SIZE,CHEST_FRAME_SIZE);
  }
  drawShadow(c:CanvasRenderingContext2D,index:number,lift:number,shake:number){
    const grounded=Math.max(0,1-Math.abs(lift)/300),half=CHEST_FRAME_SIZE/2,feet=CHEST_FRAME_SIZE*450/512;
    c.save();
    // Fireplace at rear-right casts the silhouette gently forward-left over the grain.
    c.translate(CHEST_CENTER.x,CHEST_CENTER.y);c.rotate(shake*.35);
    c.globalAlpha=.19*grounded;c.filter='blur(1.6px)';
    c.transform(1,.025,.5,-.14,0,0);
    this.frame(c,this.shadow,index,-half,-feet);
    c.restore();
    // Soft penumbra with a darker, short contact core beneath the feet.
    c.save();c.translate(CHEST_CENTER.x,CHEST_CENTER.y+1);c.scale(105,8);
    const contact=c.createRadialGradient(0,0,.08,0,0,1);
    contact.addColorStop(0,`rgba(24,12,7,${.48*grounded})`);contact.addColorStop(.65,`rgba(24,12,7,${.22*grounded})`);contact.addColorStop(1,'#180c0700');
    c.fillStyle=contact;c.fillRect(-1,-1,2,2);c.restore();
  }
  drawReflection(c:CanvasRenderingContext2D,index:number,x:number,y:number,time:number){
    c.save();c.globalCompositeOperation='screen';
    // Same two fire frequencies as the cabin compositor; reduced motion passes time=0.
    c.globalAlpha=.19+.018*Math.sin(time*6.7)+.009*Math.sin(time*11.3);
    this.frame(c,this.reflected,index,x,y);c.restore();
  }
}
