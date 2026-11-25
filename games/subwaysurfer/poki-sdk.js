/* Local stand-in for the Poki ad SDK: makes no network requests.
   init() rejects, which the game already handles as "ad blocker active" (no ads, game runs normally). */
(function(){
  var noop=function(){};
  window.PokiSDK={
    init:function(){return Promise.reject(new Error("PokiSDK disabled"))},
    initWithVideoHB:function(){return Promise.reject(new Error("PokiSDK disabled"))},
    commercialBreak:function(){return Promise.resolve()},
    rewardedBreak:function(){return Promise.resolve(false)},
    getLeaderboard:function(){return Promise.resolve()},
    displayAd:noop,destroyAd:noop,customEvent:noop,disableProgrammatic:noop,gameLoadingStart:noop,
    gameLoadingFinished:noop,gameInteractive:noop,roundStart:noop,roundEnd:noop,muteAd:noop,setDebug:noop,
    gameplayStart:noop,gameplayStop:noop,gameLoadingProgress:noop,happyTime:noop,setPlayerAge:noop,
    togglePlayerAdvertisingConsent:noop,toggleNonPersonalized:noop,setConsentString:noop,logError:noop,
    sendHighscore:noop,setDebugTouchOverlayController:noop
  };
})();
