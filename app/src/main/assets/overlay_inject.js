(function() {
    'use strict';

    // 1. Intercept Array.prototype.push to steal the BattleScene object
    let sceneCaptured = false;
    const origPush = Array.prototype.push;

    Array.prototype.push = function(...args) {
        const res = origPush.apply(this, args);
        if (!sceneCaptured) {
            for (let i = 0; i < args.length; i++) {
                const item = args[i];
                if (item && typeof item === 'object' && item.sys && item.sys.game && item.party) {
                    window.globalScene = item;
                    sceneCaptured = true;
                    console.log("[Thor Bridge] Successfully captured BattleScene!");
                    Array.prototype.push = origPush;
                    break;
                }
            }
        }
        return res;
    };

    // 2. Polling loop to send data to Android Kotlin UI
    setInterval(() => {
        if (!window.globalScene || typeof window.globalScene.getPlayerField !== 'function' || !window.AndroidInterface) return;

        try {
            const field = window.globalScene.getPlayerField();
            if (!field || field.length === 0) return;

            const activePokemon = field[0];
            if (!activePokemon || (!activePokemon.getMoveset && !activePokemon.moveset)) return;

            const moveset = activePokemon.getMoveset ? activePokemon.getMoveset() : activePokemon.moveset;
            if (!moveset || moveset.length === 0) return;

            let extractedMoves = [];

            for (let i = 0; i < 4; i++) {
                const moveObj = moveset[i];
                if (moveObj && moveObj.moveId !== 0) {
                    const move = moveObj.getMove ? moveObj.getMove() : null;
                    const name = moveObj.getName ? moveObj.getName() : (move ? move.name : "Unknown");
                    const maxPp = moveObj.getMovePp ? moveObj.getMovePp() : (move ? move.pp : 0);
                    const ppUsed = moveObj.ppUsed || 0;
                    const currentPp = Math.max(0, maxPp - ppUsed);

                    extractedMoves.push({
                        name: name,
                        pp: currentPp
                    });
                }
            }

            const payload = JSON.stringify({ moves: extractedMoves });
            window.AndroidInterface.receiveBattleData(payload);

        } catch (e) {
            // Silent catch to prevent WebView log spam
        }
    }, 500);
})();
