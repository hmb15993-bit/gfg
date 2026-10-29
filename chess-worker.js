/* Runs the chess bot off the main thread so the page never freezes while it thinks. */
importScripts('chess-engine.js');
onmessage=function(e){var d=e.data;
 try{var g=new ChessEngine.Chess(d.fen);postMessage({id:d.id,move:g.think(d.level)})}
 catch(err){postMessage({id:d.id,move:null,error:String(err)})}};
