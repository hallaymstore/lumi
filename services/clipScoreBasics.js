'use strict';
function engagementQuality(p){
 const likes=Math.max(0,Number(p.likeCount)||0),comments=Math.max(0,Number(p.commentCount)||0),saves=Math.max(0,Number(p.saveCount)||0),shares=Math.max(0,Number(p.shareCount)||0),views=Math.max(0,Number(p.viewCount)||0);
 const numerator=likes*3+comments*5+saves*7+shares*9;
 return Math.log1p(numerator)*2.1+Math.min(9,numerator/Math.max(15,views)*2);
}
function freshness(hours){return 11*Math.exp(-hours/44)+2*Math.exp(-hours/168)}
module.exports={engagementQuality,freshness};
