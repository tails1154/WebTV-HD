'use strict';
//Audioscope code forked from Sgeo's webtv-audioscope project - https://github.com/Sgeo/webtv-audioscope
(function(){
	function clamp(number,min,max){return Math.max(min,Math.min(number,max));}
	function fixColor(colorstr){return colorstr.replace(/^[0-9a-fA-F]+$/,'#$&');}
	function drawWithAlpha(ctx,callback){
		callback(0);
		ctx.globalAlpha=0.5;
		callback(-1);
		callback(1);
		ctx.globalAlpha=1.0;
	}
	function gain0bars(h){
		let left_center=Math.floor((h-1)/3);
		let right_center=Math.ceil(2*(h-1)/3);
		let center_to_edge=Math.floor((h-1)/8)+1;
		return({
			left:{
				start:left_center-center_to_edge,
				size:center_to_edge*2
			},
			right:{
				start:right_center-center_to_edge,
				size:center_to_edge*2
			}
		});
	}
	class WebTVAudioscope extends HTMLElement{
		static audioscopes=new Set();
		constructor(){super();}
		connectedCallback(){
			const shadow=this.attachShadow({mode:'open'});
			this.canvas=document.createElement('canvas');
			const canvasClass=this.getAttribute('canvasClass');
			const canvasID=this.getAttribute('canvasID');
			const canvasStyle=this.getAttribute('canvasStyle');
			if(canvasClass){this.canvas.classList.add(canvasClass);}
			if(canvasID){this.canvas.id=canvasID;}
			if(canvasStyle){this.canvas.style.cssText=canvasStyle;}
			this.ctx=this.canvas.getContext('2d');
			this.ctx.imageSmoothingEnabled=false;
			this.canvas.style.width=this.getAttribute('width')||'100px';
			this.canvas.style.height=this.getAttribute('height')||'80px';
			shadow.append(this.canvas);
			let computedStyle=getComputedStyle(this.canvas);
			this.canvas.width=computedStyle.width.replace(/px$/,'');
			this.canvas.height=computedStyle.height.replace(/px$/,'');
			this.bgcolor=fixColor(this.getAttribute('bgcolor')||'#7b7b7b');
			this.paintBackground();
			this.leftcolor=fixColor(this.getAttribute('leftcolor')||'#8ece10');
			this.rightcolor=fixColor(this.getAttribute('rightcolor')||'#ce8e10');
			this.leftoffset=parseInt(this.getAttribute('leftoffset')??'0');
			let bound=Math.floor(this.canvas.height/2.0);
			this.rightoffset=parseInt(this.getAttribute('rightoffset')??'1');
			this.gain=parseInt(this.getAttribute('gain')??'1');
			this.canvas.style.borderWidth=this.getAttribute('border')??'0';
			this.canvas.style.borderStyle='solid';
			this.canvas.style.borderColor='#1c1c1c94 #c9c9c99c #c9c9c99c #1c1c1c94';
			WebTVAudioscope.audioscopes.add(this);
		}
		disconnectedCallback(){WebTVAudioscope.audioscopes.delete(this);}
		paintBackground(){
			this.ctx.fillStyle=this.bgcolor;
			this.ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
		}
		drawLine(offset,color){
			this.ctx.strokeStyle=color;
			this.ctx.beginPath();
			this.ctx.moveTo(0,this.canvas.height/2+offset);
			this.ctx.lineTo(this.canvas.width,this.canvas.height/2+offset);
			this.ctx.stroke();
		}
		draw(leftData,rightData,leftVolume,rightVolume){
			this.paintBackground();
			if(this.gain!==0){
				this.drawAudioLine(leftData,this.leftoffset,this.leftcolor);
				this.drawAudioLine(rightData,this.rightoffset,this.rightcolor);
			}else{
				this.drawVolumeBar(leftVolume,gain0bars(this.canvas.height).left,this.leftcolor);
				this.drawVolumeBar(rightVolume,gain0bars(this.canvas.height).right,this.rightcolor);
				let horizontal_segment=Math.floor(this.canvas.width/20)*2;
				this.ctx.fillStyle=this.bgcolor;
				for(let x=0;x<this.canvas.width; x+=horizontal_segment){this.ctx.fillRect(x,0,1,this.canvas.height);}
			}
		}
		drawAudioLine(data,offset,color){
		 //Oscilloscope code stolen from https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
			this.ctx.fillStyle=color;
			let sliceWidth=data.length/this.canvas.width;
			for(let x=0;x<this.canvas.width;x++){
				let slice=data.subarray(x*sliceWidth,(x+1)*sliceWidth);
				let v=this.gain*slice.reduce((prev,cur)=>prev+cur,0.0)/slice.length;
				let y=-v*this.canvas.height/2+Math.floor(this.canvas.height/2)+offset;
				y=clamp(y,0,this.canvas.height-1);
				this.ctx.fillRect(x,y,1,1);
				this.ctx.globalAlpha=0.5;
				this.ctx.fillRect(x,y-1,1,1);
				this.ctx.fillRect(x,y+1,1,1);
				this.ctx.globalAlpha=1.0;
			}
		}
		drawVolumeBar(v,b,c){
			this.ctx.fillStyle=c;
			this.ctx.fillRect(0,b.start,this.canvas.width*v,b.size);
		}
	}
	window.addEventListener('DOMContentLoaded',function(){
		const iframe=document.getElementById('mainFrame');
		WebTVAudioscope.audioContext=new AudioContext();
		WebTVAudioscope.leftAnalyser=WebTVAudioscope.audioContext.createAnalyser();
		WebTVAudioscope.rightAnalyser=WebTVAudioscope.audioContext.createAnalyser();
		[WebTVAudioscope.leftAnalyser,WebTVAudioscope.rightAnalyser].forEach(analyser=>{analyser.smoothingTimeConstant=0.0;});
		let splitter=WebTVAudioscope.audioContext.createChannelSplitter(2);
		splitter.connect(WebTVAudioscope.leftAnalyser,0);
		splitter.connect(WebTVAudioscope.rightAnalyser,1);
		let merger=WebTVAudioscope.audioContext.createChannelMerger(2);
		WebTVAudioscope.leftAnalyser.connect(merger,0,0);
		WebTVAudioscope.rightAnalyser.connect(merger,0,1);
		merger.connect(WebTVAudioscope.audioContext.destination);
		let audioTags=document.querySelectorAll('audio');
		for(let audioTag of audioTags){
			audioTag.addEventListener('play',function(){WebTVAudioscope.audioContext.resume();});
			let source=WebTVAudioscope.audioContext.createMediaElementSource(audioTag);
			source.connect(splitter);
		}
		function handleAudiosInIframe(i){
			if(!i.contentDocument){console.warn(`Can't access iframe audios, probably because the page is cross-origin.`);return;}
			try{
				for(let audioTag of i.contentDocument.querySelectorAll('audio')){
					audioTag.addEventListener('play',function(){WebTVAudioscope.audioContext.resume();});
					let source;
					try{source=WebTVAudioscope.audioContext.createMediaElementSource(audioTag);}catch(error){console.error('Error creating MediaElementSource:',error);continue;}
					source.connect(splitter);
				}
			}catch(error){if(error===undefined){return;}console.error(`Couldn't add event listeners. Error: ${error}`);}
		}
		if(window.self===window.top){iframe.addEventListener('load',function(){handleAudiosInIframe(iframe);});}
		WebTVAudioscope.leftData=new Float32Array(WebTVAudioscope.leftAnalyser.fftSize);
		WebTVAudioscope.rightData=new Float32Array(WebTVAudioscope.rightAnalyser.fftSize);
		function drawAll(){
			requestAnimationFrame(drawAll);
			WebTVAudioscope.leftAnalyser.getFloatTimeDomainData(WebTVAudioscope.leftData);
			WebTVAudioscope.rightAnalyser.getFloatTimeDomainData(WebTVAudioscope.rightData);
			let leftVolume=Math.sqrt(WebTVAudioscope.leftData.reduce((prev,cur)=>{return prev+cur*cur},0)/WebTVAudioscope.leftData.length);
			let rightVolume=Math.sqrt(WebTVAudioscope.rightData.reduce((prev,cur)=>{return prev+cur*cur},0)/WebTVAudioscope.rightData.length);
			for(let audioscope of WebTVAudioscope.audioscopes){audioscope.draw(WebTVAudioscope.leftData,WebTVAudioscope.rightData,leftVolume,rightVolume);}
		}drawAll();
	});customElements.define('webtv-audioscope',WebTVAudioscope);
})();